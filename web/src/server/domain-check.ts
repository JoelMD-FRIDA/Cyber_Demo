import { db, domainCheckProviders, oauthTokens, domainChecks, users, domainCheckCategories, domainCheckResults, appSettings } from '@/db';
import { and, eq, gt, sql } from 'drizzle-orm';
import { decryptString } from '@/lib/pgp';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  token_type: string;
  scope?: string;
}

export interface DomainCheckResult {
  spf: Record<string, unknown>;
  ports: Record<string, unknown>;
  leaks: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CheckDomainOptions {
  userId: string;
  providerId?: string;
  categoryId?: string;
  hasAcceptedDisclaimer?: boolean;
  disclaimerVersion?: string;
}

export interface StructuredDomainCheckResult {
  resultsPWLeaks: number;
  resultsEmailLeaks: number;
  resultsEoLSoftware: number;
  resultsOpenPorts: number;
  resultsSPFRecord: boolean;
  hasSPFRecordResult: boolean;
  hasDarknetResults: boolean;
  hasSoftwareResults: boolean;
  hasOpenPortsResults: boolean;
}

export interface CheckDomainResponse {
  checkId: string;
  url: string;
  status: string;
  remainingChecks: number;
  maxChecks: number;
  providerCount: number;
  results: Record<string, unknown>;
  structuredResults: StructuredDomainCheckResult;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_API_BASE_URL = process.env.CYSMO_API_BASE_URL ?? '';
const DEFAULT_CLIENT_ID = process.env.CYSMO_CLIENT_ID ?? '';
const DEFAULT_CLIENT_SECRET = process.env.CYSMO_CLIENT_SECRET ?? '';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1_000;
const CURRENT_DISCLAIMER_VERSION = '1.0';

// ── PGP Decryption Helper ────────────────────────────────────────────────────

async function decryptApiKey(encryptedApiKey: string): Promise<string> {
  const privateKeyArmored = process.env.PGP_PRIVATE_KEY;
  const passphrase = process.env.PGP_PASSPHRASE;

  if (!privateKeyArmored || !passphrase) {
    throw new Error('PGP_PRIVATE_KEY and PGP_PASSPHRASE environment variables are required');
  }

  return decryptString(encryptedApiKey, privateKeyArmored, passphrase);
}

// ── Disclaimer & Limit Helpers ───────────────────────────────────────────────

/**
 * Validates that the user has accepted the disclaimer.
 * Throws an error if not accepted.
 */
export function validateDisclaimer(
  hasAcceptedDisclaimer: boolean | undefined | null,
  disclaimerVersion?: string | null,
): void {
  if (!hasAcceptedDisclaimer) {
    throw new DisclaimerError('You must accept the disclaimer before running a domain check.');
  }
  if (!disclaimerVersion) {
    throw new DisclaimerError('Disclaimer version is required.');
  }
}

/**
 * Retrieves the maximum number of checks from AppSettings.
 * Defaults to 10 if not configured.
 */
export async function getMaximumChecks(): Promise<number> {
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, 'maximum_number_of_checks'))
    .limit(1);

  return setting?.maximumNumberOfChecks ?? 10;
}

/**
 * Gets the user's current performed check count and computes remaining.
 */
export async function getRemainingChecks(userId: string): Promise<{ performed: number; remaining: number; maxChecks: number }> {
  const maxChecks = await getMaximumChecks();

  const [user] = await db
    .select({ performedDomainChecks: users.performedDomainChecks })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const performed = user?.performedDomainChecks ?? 0;
  const remaining = Math.max(0, maxChecks - performed);

  return { performed, remaining, maxChecks };
}

/**
 * Enforces the maximum check limit. Throws CheckLimitError if exceeded.
 */
export async function enforceCheckLimit(userId: string): Promise<{ remaining: number; maxChecks: number }> {
  const { remaining, maxChecks } = await getRemainingChecks(userId);

  if (remaining <= 0) {
    throw new CheckLimitError(
      `Domain check limit reached (${maxChecks}/${maxChecks}). Please contact support to increase your limit.`,
      maxChecks,
      0,
    );
  }

  return { remaining, maxChecks };
}

// ── OAuth Token Management ───────────────────────────────────────────────────

/**
 * Fetches a new OAuth token from the provider's token endpoint.
 * Uses client_credentials grant type.
 */
export async function fetchOAuthToken(
  apiBaseUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<OAuthTokenResponse> {
  const tokenUrl = `${apiBaseUrl.replace(/\/+$/, '')}/oauth/token`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `OAuth token request failed (${response.status}): ${errorBody || response.statusText}`,
      );
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
      refresh_expires_in: data.refresh_expires_in,
      token_type: data.token_type,
      scope: data.scope,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`OAuth token request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

/**
 * Retrieves a valid OAuth token from the database, or fetches a new one.
 * Tokens are considered valid if their expiryDate is in the future.
 */
export async function getOAuthToken(providerId: string): Promise<string> {
  const [existingToken] = await db
    .select()
    .from(oauthTokens)
    .where(and(
      eq(oauthTokens.providerId, providerId),
      gt(oauthTokens.expiryDate, new Date()),
    ))
    .limit(1);

  if (existingToken) {
    return existingToken.accessToken;
  }

  // Fetch provider credentials
  const [provider] = await db
    .select()
    .from(domainCheckProviders)
    .where(eq(domainCheckProviders.id, providerId));

  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  // Determine API base URL and credentials
  const apiBaseUrl = DEFAULT_API_BASE_URL;
  const clientId = DEFAULT_CLIENT_ID;
  let clientSecret = DEFAULT_CLIENT_SECRET;

  // If provider has encrypted API key, decrypt it
  if (provider.apiKeyEncrypted) {
    clientSecret = await decryptApiKey(provider.apiKeyEncrypted);
  }

  // Fetch new token
  const tokenResponse = await fetchOAuthToken(apiBaseUrl, clientId, clientSecret);

  // Store token in database
  const expiryDate = new Date(Date.now() + tokenResponse.expires_in * 1000);

  await db.insert(oauthTokens).values({
    accessToken: tokenResponse.access_token,
    expiresIn: tokenResponse.expires_in,
    refreshExpiresIn: tokenResponse.refresh_expires_in,
    tokenType: tokenResponse.token_type,
    scope: tokenResponse.scope,
    expiryDate,
    providerId,
  });

  return tokenResponse.access_token;
}

// ── Domain Check ─────────────────────────────────────────────────────────────

/**
 * Sends a domain check request to the Cysmo API.
 */
async function sendCheckRequest(
  apiBaseUrl: string,
  token: string,
  url: string,
): Promise<Record<string, unknown>> {
  const checkUrl = `${apiBaseUrl.replace(/\/+$/, '')}/api/v1/domain-check`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(checkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle rate limiting with retry
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '5', 10);
      throw new RateLimitError(`Rate limited. Retry after ${retryAfter}s`, retryAfter);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `Domain check request failed (${response.status}): ${errorBody || response.statusText}`,
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Domain check request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

/**
 * Maps Cysmo API response to structured DomainCheckResult fields.
 */
export function mapCysmoResponseToStructuredResult(
  raw: Record<string, unknown>,
): StructuredDomainCheckResult {
  const results = (raw.results as Record<string, unknown>) ?? {};

  const spf = (results.spf as Record<string, unknown>) ?? {};
  const ports = (results.ports as Record<string, unknown>) ?? {};
  const leaks = (results.leaks as Record<string, unknown>) ?? {};
  const software = (results.software as Record<string, unknown>) ?? {};

  return {
    resultsPWLeaks: typeof leaks.password_leaks === 'number' ? leaks.password_leaks : 0,
    resultsEmailLeaks: typeof leaks.email_leaks === 'number' ? leaks.email_leaks : 0,
    resultsEoLSoftware: typeof software.eol_software === 'number' ? software.eol_software : 0,
    resultsOpenPorts: typeof ports.open_ports === 'number' ? ports.open_ports : 0,
    resultsSPFRecord: spf.spf_record === true,
    hasSPFRecordResult: spf.has_spf_record_result === true,
    hasDarknetResults: leaks.has_darknet_results === true,
    hasSoftwareResults: software.has_software_results === true,
    hasOpenPortsResults: ports.has_open_ports_results === true,
  };
}

/**
 * Parses raw API response into structured DomainCheckResult + rich display format.
 */
function parseCheckResponse(raw: Record<string, unknown>): {
  structured: StructuredDomainCheckResult;
  rich: DomainCheckResult;
} {
  const structured = mapCysmoResponseToStructuredResult(raw);

  const rich: DomainCheckResult = {
    spf: {
      hasSpf: structured.resultsSPFRecord,
      spfRecord: null,
      issues: [],
    } as Record<string, unknown>,
    ports: {
      openPorts: structured.resultsOpenPorts,
      hasResults: structured.hasOpenPortsResults,
    } as Record<string, unknown>,
    leaks: {
      passwordLeaks: structured.resultsPWLeaks,
      emailLeaks: structured.resultsEmailLeaks,
      hasDarknetResults: structured.hasDarknetResults,
    } as Record<string, unknown>,
    ...raw,
  };

  return { structured, rich };
}

/**
 * Stores check results in the database with structured typed columns.
 * Returns the created check ID.
 */
export async function storeCheckResults(
  userId: string,
  providerId: string,
  categoryId: string,
  url: string,
  structured: StructuredDomainCheckResult,
  options: {
    hasAcceptedDisclaimer?: boolean;
    disclaimerVersion?: string;
    providerCount?: number;
    remainingChecks?: number;
    maxChecks?: number;
    status?: string;
  } = {},
): Promise<string> {
  // Insert into domainChecks
  const [check] = await db
    .insert(domainChecks)
    .values({
      userId,
      providerId,
      categoryId,
      url,
      status: options.status ?? 'completed',
      hasAcceptedDisclaimer: options.hasAcceptedDisclaimer ?? false,
      disclaimerAcceptedAt: options.hasAcceptedDisclaimer ? new Date() : null,
      disclaimerVersion: options.disclaimerVersion ?? null,
      providerCount: options.providerCount ?? 1,
      remainingDomainChecks: options.remainingChecks ?? 0,
      maxChecks: options.maxChecks ?? 0,
    })
    .returning({ id: domainChecks.id });

  if (!check) {
    throw new Error('Failed to create domain check record');
  }

  // Insert into domainCheckResults
  await db
    .insert(domainCheckResults)
    .values({
      domainCheckId: check.id,
      categoryId,
      ...structured,
    });

  // Increment user's performed domain checks count atomically
  await db
    .update(users)
    .set({
      performedDomainChecks: sql`${users.performedDomainChecks} + 1`,
    })
    .where(eq(users.id, userId));

  return check.id;
}

/**
 * Handles partial provider failure: persists what we have with a partial status.
 */
export async function storePartialResults(
  userId: string,
  providerId: string,
  categoryId: string,
  url: string,
  structured: Partial<StructuredDomainCheckResult>,
  errorMessage: string,
  options: {
    hasAcceptedDisclaimer?: boolean;
    disclaimerVersion?: string;
    providerCount?: number;
    remainingChecks?: number;
    maxChecks?: number;
  } = {},
): Promise<string> {
  const fullStructured: StructuredDomainCheckResult = {
    resultsPWLeaks: structured.resultsPWLeaks ?? 0,
    resultsEmailLeaks: structured.resultsEmailLeaks ?? 0,
    resultsEoLSoftware: structured.resultsEoLSoftware ?? 0,
    resultsOpenPorts: structured.resultsOpenPorts ?? 0,
    resultsSPFRecord: structured.resultsSPFRecord ?? false,
    hasSPFRecordResult: structured.hasSPFRecordResult ?? false,
    hasDarknetResults: structured.hasDarknetResults ?? false,
    hasSoftwareResults: structured.hasSoftwareResults ?? false,
    hasOpenPortsResults: structured.hasOpenPortsResults ?? false,
  };

  return storeCheckResults(userId, providerId, categoryId, url, fullStructured, {
    ...options,
    status: `partial_error: ${errorMessage}`,
  });
}

// ── Custom Errors ────────────────────────────────────────────────────────────

class RateLimitError extends Error {
  public readonly retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class DisclaimerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DisclaimerError';
  }
}

export class CheckLimitError extends Error {
  public readonly maxChecks: number;
  public readonly remainingChecks: number;

  constructor(message: string, maxChecks: number, remainingChecks: number) {
    super(message);
    this.name = 'CheckLimitError';
    this.maxChecks = maxChecks;
    this.remainingChecks = remainingChecks;
  }
}

// ── Main Orchestration ───────────────────────────────────────────────────────

/**
 * Main orchestration function: validate → enforce limits → get token → send check → parse → store.
 * Includes retry logic for rate limiting.
 */
export async function checkDomain(
  url: string,
  options: CheckDomainOptions,
): Promise<CheckDomainResponse> {
  const { userId, providerId, categoryId, hasAcceptedDisclaimer, disclaimerVersion } = options;

  // 1. Validate disclaimer
  validateDisclaimer(hasAcceptedDisclaimer, disclaimerVersion);

  // 2. Enforce check limits
  const { remaining, maxChecks } = await enforceCheckLimit(userId);

  // 3. Resolve provider ID (use default if not specified)
  const resolvedProviderId = providerId ?? (await getDefaultProviderId());

  // 4. Resolve category ID
  const resolvedCategoryId = categoryId ?? (await getDefaultCategoryId());

  // 5. Get OAuth token (with automatic refresh)
  const token = await getOAuthToken(resolvedProviderId);

  // 6. Use default API base URL
  const apiBaseUrl = DEFAULT_API_BASE_URL;

  // 7. Send check request with retry logic for rate limiting
  let rawResponse: Record<string, unknown>;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      rawResponse = await sendCheckRequest(apiBaseUrl, token, url);
      lastError = null;
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof RateLimitError && attempt < MAX_RETRIES) {
        const delay = Math.min(error.retryAfter * 1000, RETRY_DELAY_MS * attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // If the API call fails completely, store partial results
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
        userId,
        resolvedProviderId,
        resolvedCategoryId,
        url,
        emptyStructured,
        lastError.message,
        {
          hasAcceptedDisclaimer: hasAcceptedDisclaimer ?? false,
          disclaimerVersion: disclaimerVersion ?? CURRENT_DISCLAIMER_VERSION,
          providerCount: 1,
          remainingChecks: remaining - 1,
          maxChecks,
        },
      );

      throw lastError;
    }
  }

  if (lastError) {
    throw lastError;
  }

  // 8. Parse response into structured and rich formats
  const { structured, rich } = parseCheckResponse(rawResponse!);

  // 9. Store results with structured typed columns
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

// ── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Gets the default (first active) provider ID.
 */
async function getDefaultProviderId(): Promise<string> {
  const [provider] = await db
    .select()
    .from(domainCheckProviders)
    .where(eq(domainCheckProviders.isActive, true))
    .limit(1);

  if (!provider) {
    throw new Error('No active domain check provider found');
  }

  return provider.id;
}

/**
 * Gets the default (first) category ID.
 */
async function getDefaultCategoryId(): Promise<string> {
  const [category] = await db
    .select()
    .from(domainCheckCategories)
    .limit(1);

  if (!category) {
    throw new Error('No domain check category found');
  }

  return category.id;
}

/**
 * Validates a URL string.
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
