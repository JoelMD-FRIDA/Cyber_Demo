import type { TokenResponse } from './oauth-types';

export type { StoredToken, TokenResponse } from './oauth-types';
export { generateState, verifyState } from './oauth-state';
export { getValidToken, storeToken } from './oauth-token-store';

const REQUEST_TIMEOUT_MS = 10_000;

export async function exchangeCodeForToken(
  code: string,
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `OAuth token exchange failed (${response.status}): ${errorBody || response.statusText}`,
      );
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
      refresh_expires_in: data.refresh_expires_in,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      scope: data.scope,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`OAuth token exchange timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

export async function refreshAccessToken(
  refreshToken: string,
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<TokenResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `OAuth token refresh failed (${response.status}): ${errorBody || response.statusText}`,
      );
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
      refresh_expires_in: data.refresh_expires_in,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      scope: data.scope,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`OAuth token refresh timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}
