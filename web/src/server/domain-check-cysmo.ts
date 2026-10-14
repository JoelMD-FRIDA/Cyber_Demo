import { fetchCysmoJson } from './domain-check-cysmo-http';
import { fetchProviderJson } from './provider-http';
import { normalizeDomainName } from './domain-check-url';
import { parseCheckResponse } from './domain-check-results';
import { pantaProvider } from './domain-check-panta';
import type {
  DomainCheckProvider,
  ProviderJob,
  ProviderPollInput,
  ProviderPollResult,
  ProviderStartInput,
} from './domain-check-provider';

export type {
  DomainCheckProvider,
  ProviderJob,
  ProviderPollInput,
  ProviderPollResult,
  ProviderStartInput,
} from './domain-check-provider';

interface CysmoConfig {
  readonly apiBaseUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

function getCysmoConfig(): CysmoConfig | null {
  const apiBaseUrl = process.env.CYSMO_API_BASE_URL?.trim();
  const clientId = process.env.CYSMO_CLIENT_ID?.trim();
  const clientSecret = process.env.CYSMO_CLIENT_SECRET?.trim();
  if (!apiBaseUrl || !clientId || !clientSecret) return null;
  return { apiBaseUrl, clientId, clientSecret };
}

async function getCysmoToken(config: CysmoConfig): Promise<string> {
  const tokenUrl = `${config.apiBaseUrl.replace(/\/+$/, '')}/oauth/token`;
  const response = await fetchProviderJson(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  }, 15_000, 64 * 1024);
  const parsed = response.body;
  if (!response.ok || !isRecord(parsed) || typeof parsed.access_token !== 'string') {
    throw new Error(`Cysmo OAuth token request failed (${response.status}).`);
  }
  return parsed.access_token;
}

class CysmoProvider implements DomainCheckProvider {
  readonly key = 'cysmo';
  readonly inputType = 'domain' as const;
  get isConfigured() { return getCysmoConfig() !== null; }

  async start(input: ProviderStartInput): Promise<ProviderJob> {
    const config = getCysmoConfig();
    if (!config) throw new Error('Cysmo provider is not configured.');
    const token = await getCysmoToken(config);
    const domain = normalizeDomainName(input.url);
    const response = await fetchCysmoJson({
      apiBaseUrl: config.apiBaseUrl,
      token,
      path: '/v2/companies?acceptSubDomain=true&acceptNotReachable=true',
      method: 'POST',
      body: JSON.stringify({ domains: [domain], nets: [] }),
    });

    const isAcknowledgementError = response.status === 422 && isUnacknowledgedSubdomainsError(response.body);
    if (!response.ok && !isAcknowledgementError) {
      throw new Error(`Cysmo company creation failed (${response.status}): response details withheld`);
    }

    const companyId = getCompanyId(response.body, response.headers);
    if (!companyId) {
      throw new Error('Cysmo company creation did not return a company ID.');
    }

    const reportId = findReportId(response.body);
    const report = findReadyReport(response.body);
    return {
      externalJobId: companyId,
      externalReportId: reportId,
      completed: Boolean(report),
      snapshot: {
        domain,
        createResponse: response.body,
        report,
        unacknowledgedSubdomains: getUnacknowledgedSubdomains(response.body),
      },
    };
  }

  async poll(input: ProviderPollInput): Promise<ProviderPollResult> {
    const config = getCysmoConfig();
    if (!config) {
      return { status: 'failed', errorCode: 'PROVIDER_NOT_CONFIGURED', errorMessage: 'Cysmo provider is not configured.' };
    }

    try {
      const token = await getCysmoToken(config);
      const response = await fetchCysmoJson({
        apiBaseUrl: config.apiBaseUrl,
        token,
        path: `/v2/companies/${encodeURIComponent(input.externalJobId)}`,
      });

      if (!response.ok) {
        return {
          status: 'failed',
          errorCode: `CYSMO_COMPANY_${response.status}`,
          errorMessage: `Cysmo company poll failed (${response.status}): response details withheld`,
        };
      }

      const body = isRecord(response.body) ? response.body : { value: response.body };
      const reportId = findReportId(body) ?? input.externalReportId ?? undefined;
      const report = findReadyReport(body);
      const snapshot = {
        domain: normalizeDomainName(input.url),
        company: body,
        report: report ?? undefined,
        unacknowledgedSubdomains: getUnacknowledgedSubdomains(body),
      };

      if (!report) {
        return { status: 'pending', snapshot, externalReportId: reportId };
      }

      return { status: 'completed', snapshot, externalReportId: reportId };
    } catch (error) {
      return {
        status: 'failed',
        errorCode: 'CYSMO_POLL_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  normalize(result: unknown) {
    const raw = isRecord(result) ? result : {};
    const parsed = parseCheckResponse(raw);
    return { structuredResult: parsed.structured, richResult: parsed.rich };
  }
}

const cysmoProvider = new CysmoProvider();
const providerAdapters = new Map<string, DomainCheckProvider>([
  [cysmoProvider.key, cysmoProvider],
  [pantaProvider.key, pantaProvider],
]);

export function getProviderAdapter(providerKey: string): DomainCheckProvider | null {
  return providerAdapters.get(providerKey) ?? null;
}

export function isProviderConfigured(providerKey: string): boolean {
  return getProviderAdapter(providerKey)?.isConfigured ?? false;
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

function getCompanyId(body: unknown, headers: Headers): string | undefined {
  if (isRecord(body)) {
    const directId = getString(body.id);
    if (directId) return directId;
    if (isRecord(body.company)) {
      const nestedId = getString(body.company.id);
      if (nestedId) return nestedId;
    }
  }

  const location = headers.get('Location');
  if (!location) return undefined;
  const match = /\/v2\/companies\/([^/?#]+)/.exec(location) ?? /\/companies\/([^/?#]+)/.exec(location);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function getReports(body: unknown): readonly Record<string, unknown>[] {
  const reports: Record<string, unknown>[] = [];

  function collect(value: unknown): void {
    if (!isRecord(value)) return;
    if (Array.isArray(value.reports)) reports.push(...value.reports.filter(isRecord));
    if (isRecord(value.report)) reports.push(value.report);
    if (isRecord(value.company)) collect(value.company);
    if (isRecord(value.data)) collect(value.data);
  }

  collect(body);
  return reports;
}

function findReportId(body: unknown): string | undefined {
  if (isRecord(body)) {
    for (const key of ['reportId', 'report_id']) {
      const directId = getString(body[key]);
      if (directId) return directId;
    }
  }

  return getReports(body).map((report) => getString(report.id)).find((id): id is string => Boolean(id));
}

function findReadyReport(body: unknown): Record<string, unknown> | undefined {
  const readyReport = getReports(body).find(isReportReady);
  if (readyReport) return readyReport;

  if (isRecord(body) && !Array.isArray(body.reports) && isReportReady(body)) {
    return body;
  }

  return undefined;
}

function isReportReady(report: Record<string, unknown>): boolean {
  const state = getString(report.state) ?? getString(report.status) ?? getString(report.reportState) ?? getString(report.reportStatus);
  const normalizedState = state?.trim().toUpperCase().replace(/[-\s]+/g, '_');
  if (normalizedState && ['ERROR', 'FAILED', 'FAILURE', 'INTERNAL_ERROR', 'TIMEOUT', 'CANCELLED', 'CANCELED'].includes(normalizedState)) {
    return false;
  }

  if (normalizedState && ['FINISHED', 'COMPLETED', 'COMPLETE', 'DONE', 'SUCCESS', 'SUCCEEDED', 'READY'].includes(normalizedState)) {
    return true;
  }

  return report.running === false || report.finished === true || report.complete === true || report.completed === true || report.ready === true;
}

function isUnacknowledgedSubdomainsError(body: unknown): boolean {
  return isRecord(body) && body.type === 'UNACKNOWLEDGED_SUBDOMAINS';
}

function getUnacknowledgedSubdomains(body: unknown): readonly string[] | undefined {
  return isRecord(body) ? getStringArray(body.domains) : undefined;
}
