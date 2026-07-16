import { db, domainCheckCategories, domainCheckProviders } from '@/db';
import { eq } from 'drizzle-orm';
import { getCysmoConfigFromEnv } from '@/lib/runtime-env';
import type {
  CheckDomainOptions,
  CheckDomainResponse,
  StructuredDomainCheckResult,
} from './domain-check-types';
import { sendCheckRequest } from './domain-check-cysmo';
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
export { isValidUrl } from './domain-check-url';
export { fetchOAuthToken, getOAuthToken } from './domain-check-oauth';
export { mapCysmoResponseToStructuredResult } from './domain-check-results';
export { storeCheckResults, storePartialResults } from './domain-check-storage';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1_000;
const CURRENT_DISCLAIMER_VERSION = '1.0';

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
