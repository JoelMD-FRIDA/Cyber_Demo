import { db, domainCheckCategories, domainCheckProviders } from '@/db';
import { eq } from 'drizzle-orm';
import { getCysmoConfigFromEnv } from '@/lib/runtime-env';
import type {
  CheckDomainOptions,
  CheckDomainResponse,
  StructuredDomainCheckResult,
} from './domain-check-types';
import { RateLimitError } from './domain-check-errors';
import { enforceCheckLimit, validateDisclaimer } from './domain-check-limits';
import { getOAuthToken } from './domain-check-oauth';
import { parseCheckResponse } from './domain-check-results';
import { storeCheckResults, storePartialResults } from './domain-check-storage';

export type {
  CheckDomainOptions,
  CheckDomainResponse,
  DomainCheckResult,
  OAuthTokenResponse,
  StructuredDomainCheckResult,
} from './domain-check-types';
export { CheckLimitError, DisclaimerError } from './domain-check-errors';
export {
  enforceCheckLimit,
  getMaximumChecks,
  getRemainingChecks,
  validateDisclaimer,
} from './domain-check-limits';
export { fetchOAuthToken, getOAuthToken } from './domain-check-oauth';
export { mapCysmoResponseToStructuredResult } from './domain-check-results';
export { storeCheckResults, storePartialResults } from './domain-check-storage';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1_000;
const CURRENT_DISCLAIMER_VERSION = '1.0';
const REPORT_POLL_INTERVAL_MS = 15_000;
const REPORT_POLL_TIMEOUT_MS = 120_000;
const REPORT_POLL_ATTEMPTS = 8;

interface CysmoJsonRequest {
  readonly apiBaseUrl: string;
  readonly token: string;
  readonly path: string;
  readonly method?: 'GET' | 'POST';
  readonly body?: string;
}

interface CysmoJsonResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly statusText: string;
  readonly headers: Headers;
  readonly body: unknown;
}

interface CysmoReportFetchRequest {
  readonly apiBaseUrl: string;
  readonly token: string;
  readonly domain: string;
  readonly company: unknown;
  readonly reportId: string;
}

async function sendCheckRequest(
  apiBaseUrl: string,
  token: string,
  url: string,
): Promise<Record<string, unknown>> {
  const domain = normalizeDomainName(url);
  const createResponse = await fetchCysmoJson({
    apiBaseUrl,
    token,
    path: '/v2/companies',
    method: 'POST',
    body: JSON.stringify({ domains: [domain] }),
  });

  const isAcknowledgementError =
    createResponse.status === 422 && isUnacknowledgedSubdomainsError(createResponse.body);

  if (!createResponse.ok && !isAcknowledgementError) {
    throw new Error(
      `Domain check request failed (${createResponse.status}): ${formatResponseBody(createResponse)}`,
    );
  }

  const companyId = getCompanyId(createResponse.body, createResponse.headers);
  if (!companyId) {
    return {
      domain,
      status: 'partial',
      createResponse: createResponse.body,
      unacknowledgedSubdomains: getUnacknowledgedSubdomains(createResponse.body),
      partialReason: 'Cysmo company creation did not include a company id.',
    };
  }

  const finishedReportId = findFinishedReportId(createResponse.body);
  if (finishedReportId) {
    return {
      domain,
      status: 'finished',
      company: createResponse.body,
    };
  }

  const deadline = Date.now() + REPORT_POLL_TIMEOUT_MS;
  let latestCompany = createResponse.body;

  for (let attempt = 1; attempt <= REPORT_POLL_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;
      await sleep(Math.min(REPORT_POLL_INTERVAL_MS, remainingMs));
    }

    const companyResponse = await fetchCysmoJson({
      apiBaseUrl,
      token,
      path: `/v2/companies/${encodeURIComponent(companyId)}`,
    });

    if (!companyResponse.ok) {
      throw new Error(
        `Cysmo company poll failed (${companyResponse.status}): ${formatResponseBody(companyResponse)}`,
      );
    }

    latestCompany = companyResponse.body;
    const reportId = findFinishedReportId(companyResponse.body);
    if (reportId) {
      return {
        domain,
        status: 'finished',
        company: latestCompany,
      };
    }
  }

  return {
    domain,
    status: 'partial',
    company: latestCompany,
    createResponse: createResponse.body,
    unacknowledgedSubdomains: getUnacknowledgedSubdomains(createResponse.body),
    partialReason: 'Cysmo report did not finish before the polling timeout.',
  };
}

async function fetchCysmoJson(request: CysmoJsonRequest): Promise<CysmoJsonResponse> {
  const requestUrl = `${request.apiBaseUrl.replace(/\/+$/, '')}${request.path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const init: RequestInit = {
      method: request.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${request.token}`,
        ...(request.body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: controller.signal,
    };
    if (request.body) init.body = request.body;

    const response = await fetch(requestUrl, init);
    clearTimeout(timeoutId);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '5', 10);
      throw new RateLimitError(`Rate limited. Retry after ${retryAfter}s`, retryAfter);
    }

    return {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      headers: response.headers,
      body: await parseJsonBody(response),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Cysmo API request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

async function fetchReportResult(request: CysmoReportFetchRequest): Promise<Record<string, unknown>> {
  const reportResponse = await fetchCysmoJson({
    apiBaseUrl: request.apiBaseUrl,
    token: request.token,
    path: `/v2/reports/${encodeURIComponent(request.reportId)}?dataMode=FULL`,
  });

  if (!reportResponse.ok) {
    throw new Error(
      `Cysmo report request failed (${reportResponse.status}): ${formatResponseBody(reportResponse)}`,
    );
  }

  return {
    domain: request.domain,
    status: 'finished',
    company: request.company,
    report: reportResponse.body,
  };
}

async function parseJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) return text;
    throw error;
  }
}

function normalizeDomainName(value: string): string {
  try {
    const parsed = new URL(value.includes('://') ? value : `https://${value}`);
    return parsed.hostname.toLowerCase();
  } catch (error) {
    if (error instanceof TypeError) {
      return value
        .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
        .split('/')[0]
        .split('?')[0]
        .split('#')[0]
        .toLowerCase();
    }
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length > 0 ? strings : undefined;
}

function isUnacknowledgedSubdomainsError(body: unknown): boolean {
  if (!isRecord(body)) return false;
  return body['type'] === 'UNACKNOWLEDGED_SUBDOMAINS';
}

function getUnacknowledgedSubdomains(body: unknown): readonly string[] | undefined {
  if (!isRecord(body)) return undefined;
  return getStringArray(body['domains']);
}

function getCompanyId(body: unknown, headers: Headers): string | undefined {
  const bodyId = getIdFromBody(body);
  if (bodyId) return bodyId;

  const location = headers.get('Location');
  if (!location) return undefined;
  const match = /\/v2\/companies\/([^/?#]+)/.exec(location) ?? /\/companies\/([^/?#]+)/.exec(location);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function getIdFromBody(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  const id = getString(body['id']);
  if (id) return id;

  const company = body['company'];
  if (!isRecord(company)) return undefined;
  return getString(company['id']);
}

function findFinishedReportId(body: unknown): string | undefined {
  const reports = getReports(body);
  const report = reports.find((candidate) => candidate['state'] === 'FINISHED');
  return report ? getString(report['id']) : undefined;
}

function getReports(body: unknown): readonly Record<string, unknown>[] {
  const company = isRecord(body) && isRecord(body['company']) ? body['company'] : body;
  if (!isRecord(company) || !Array.isArray(company['reports'])) return [];
  return company['reports'].filter(isRecord);
}

function formatResponseBody(response: CysmoJsonResponse): string {
  if (typeof response.body === 'string') return response.body || response.statusText;
  if (response.body === null || response.body === undefined) return response.statusText;
  return JSON.stringify(response.body);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkDomain(
  url: string,
  options: CheckDomainOptions,
): Promise<CheckDomainResponse> {
  const { userId, providerId, categoryId, hasAcceptedDisclaimer, disclaimerVersion } = options;
  validateDisclaimer(hasAcceptedDisclaimer, disclaimerVersion);
  const { remaining, maxChecks } = await enforceCheckLimit(userId);
  const resolvedProviderId = providerId ?? (await getDefaultProviderId());
  const resolvedCategoryId = categoryId ?? (await getDefaultCategoryId());
  const cysmoConfig = getCysmoConfigFromEnv();
  if (!cysmoConfig) {
    throw new Error(
      'Cysmo credentials not configured. Set CYSMO_API_BASE_URL, CYSMO_CLIENT_ID, and CYSMO_CLIENT_SECRET.',
    );
  }

  const rawResponse = await runDomainCheckRequest(
    cysmoConfig.apiBaseUrl,
    await getOAuthToken(resolvedProviderId),
    url,
    { userId, providerId: resolvedProviderId, categoryId: resolvedCategoryId, hasAcceptedDisclaimer, disclaimerVersion, remaining, maxChecks },
  );
  const { structured, rich } = parseCheckResponse(rawResponse);
  const checkId = await storeCheckResults(userId, resolvedProviderId, resolvedCategoryId, url, structured, {
    hasAcceptedDisclaimer: hasAcceptedDisclaimer ?? false,
    disclaimerVersion: disclaimerVersion ?? CURRENT_DISCLAIMER_VERSION,
    providerCount: 1,
    remainingChecks: remaining - 1,
    maxChecks,
  });

  return {
    checkId,
    url,
    status: 'completed',
    remainingChecks: remaining - 1,
    maxChecks,
    providerCount: 1,
    results: rich,
    structuredResults: structured,
  };
}

interface DomainCheckFailureContext {
  userId: string;
  providerId: string;
  categoryId: string;
  hasAcceptedDisclaimer?: boolean;
  disclaimerVersion?: string;
  remaining: number;
  maxChecks: number;
}

async function runDomainCheckRequest(
  apiBaseUrl: string,
  token: string,
  url: string,
  context: DomainCheckFailureContext,
): Promise<Record<string, unknown>> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await sendCheckRequest(apiBaseUrl, token, url);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (error instanceof RateLimitError && attempt < MAX_RETRIES) {
        const delay = Math.min(error.retryAfter * 1000, RETRY_DELAY_MS * attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      await storeFailedDomainCheck(url, lastError.message, context);
      throw lastError;
    }
  }

  throw lastError ?? new Error('Domain check request failed without an error detail.');
}

async function storeFailedDomainCheck(
  url: string,
  errorMessage: string,
  context: DomainCheckFailureContext,
): Promise<void> {
  const emptyStructured: StructuredDomainCheckResult = {
    resultsPWLeaks: 0,
    resultsEmailLeaks: 0,
    resultsEoLSoftware: 0,
    resultsOpenPorts: 0,
    resultsSPFRecord: false,
    hasSPFRecordResult: false,
    hasDarknetResults: false,
    hasSoftwareResults: false,
    hasOpenPortsResults: false,
  };

  await storePartialResults(
    context.userId,
    context.providerId,
    context.categoryId,
    url,
    emptyStructured,
    errorMessage,
    {
      hasAcceptedDisclaimer: context.hasAcceptedDisclaimer ?? false,
      disclaimerVersion: context.disclaimerVersion ?? CURRENT_DISCLAIMER_VERSION,
      providerCount: 1,
      remainingChecks: context.remaining - 1,
      maxChecks: context.maxChecks,
    },
  );
}

async function getDefaultProviderId(): Promise<string> {
  const [provider] = await db
    .select()
    .from(domainCheckProviders)
    .where(eq(domainCheckProviders.isActive, true))
    .limit(1);

  if (!provider) throw new Error('No active domain check provider found');

  return provider.id;
}

async function getDefaultCategoryId(): Promise<string> {
  const [category] = await db
    .select()
    .from(domainCheckCategories)
    .limit(1);

  if (!category) throw new Error('No domain check category found');

  return category.id;
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
