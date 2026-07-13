import { db, domainCheckProviders, oauthTokens } from '@/db';
import { and, eq, gt } from 'drizzle-orm';
import { getCysmoConfigFromEnv } from '@/lib/runtime-env';
import type { OAuthTokenResponse } from './domain-check-types';

const REQUEST_TIMEOUT_MS = 10_000;

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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

export async function getOAuthToken(providerId: string): Promise<string> {
  const [existingToken] = await db
    .select()
    .from(oauthTokens)
    .where(and(
      eq(oauthTokens.providerId, providerId),
      gt(oauthTokens.expiryDate, new Date()),
    ))
    .limit(1);

  if (existingToken) return existingToken.accessToken;

  const [provider] = await db
    .select()
    .from(domainCheckProviders)
    .where(eq(domainCheckProviders.id, providerId));

  if (!provider) throw new Error(`Provider not found: ${providerId}`);

  const cysmoConfig = getCysmoConfigFromEnv();
  if (!cysmoConfig) {
    throw new Error(
      'Cysmo credentials not configured. Set CYSMO_API_BASE_URL, CYSMO_CLIENT_ID, and CYSMO_CLIENT_SECRET.',
    );
  }

  const tokenResponse = await fetchOAuthToken(
    cysmoConfig.apiBaseUrl,
    cysmoConfig.clientId,
    cysmoConfig.clientSecret,
  );
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
