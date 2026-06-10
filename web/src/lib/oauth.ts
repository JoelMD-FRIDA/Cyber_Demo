import { db, oauthTokens, domainCheckProviders } from '@/db';
import { and, eq, gt } from 'drizzle-orm';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { encryptString, decryptString } from './pgp';

// ── Constants ────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET!;
const REQUEST_TIMEOUT_MS = 10_000;

// ── Types ────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  refresh_token?: string;
  token_type: string;
  scope?: string;
}

export interface StoredToken {
  accessToken: string;
  expiresIn?: number | null;
  refreshExpiresIn?: number | null;
  tokenType?: string | null;
  scope?: string | null;
  expiryDate?: Date | null;
  providerId?: string | null;
}

// ── State Management (CSRF Protection) ───────────────────────────────────────

/**
 * Generates a signed state token for OAuth CSRF protection.
 * The returned JWT contains a random value signed with the server secret.
 * On callback, the state is verified by checking the JWT signature.
 */
export function generateState(): string {
  const rawState = crypto.randomBytes(32).toString('hex');
  return jwt.sign(
    { state: rawState, purpose: 'oauth_state', createdAt: Date.now() },
    JWT_SECRET,
    { expiresIn: '10m' },
  );
}

/**
 * Verifies a state JWT returned from the OAuth callback.
 * Confirms the token was signed by this server and hasn't expired.
 */
export function verifyState(state: string): boolean {
  try {
    const payload = jwt.verify(state, JWT_SECRET) as { purpose: string };
    return payload.purpose === 'oauth_state';
  } catch {
    return false;
  }
}

// ── Authorization Code Exchange ─────────────────────────────────────────────

/**
 * Exchanges an authorization code for access/refresh tokens.
 * Uses the `authorization_code` grant type.
 */
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
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
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

// ── Token Refresh ────────────────────────────────────────────────────────────

/**
 * Refreshes an expired access token using a refresh token.
 * Uses the `refresh_token` grant type.
 */
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
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
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

// ── Encryption / Decryption Helpers ──────────────────────────────────────────

/**
 * PGP-encrypts a token string if PGP public key is configured.
 * Falls back to returning the plaintext if encryption is unavailable.
 */
async function encryptTokenIfConfigured(plaintext: string): Promise<string> {
  const publicKeyArmored = process.env.PGP_PUBLIC_KEY;
  if (!publicKeyArmored) return plaintext;

  try {
    return await encryptString(plaintext, publicKeyArmored);
  } catch (error) {
    console.warn('PGP encryption failed for token, storing as-is:', error);
    return plaintext;
  }
}

/**
 * PGP-decrypts a token string if PGP private key is configured.
 * Returns the plaintext directly if decryption is unavailable or the
 * value doesn't look like PGP armor.
 */
async function decryptTokenIfConfigured(ciphertext: string): Promise<string> {
  const privateKeyArmored = process.env.PGP_PRIVATE_KEY;
  const passphrase = process.env.PGP_PASSPHRASE;

  // If it doesn't look like an armored message, return as-is
  if (!ciphertext.startsWith('-----BEGIN PGP MESSAGE-----')) {
    return ciphertext;
  }

  if (!privateKeyArmored || !passphrase) {
    throw new Error(
      'Token is PGP-encrypted but PGP_PRIVATE_KEY and PGP_PASSPHRASE are not configured',
    );
  }

  return decryptString(ciphertext, privateKeyArmored, passphrase);
}

// ── Token Storage ────────────────────────────────────────────────────────────

/**
 * Stores an OAuth token in the database.
 * Attempts to PGP-encrypt the access token if PGP keys are configured.
 */
export async function storeToken(token: StoredToken): Promise<void> {
  const accessToken = await encryptTokenIfConfigured(token.accessToken);

  await db.insert(oauthTokens).values({
    accessToken,
    expiresIn: token.expiresIn ?? null,
    refreshExpiresIn: token.refreshExpiresIn ?? null,
    tokenType: token.tokenType ?? null,
    scope: token.scope ?? null,
    expiryDate: token.expiryDate ?? null,
    providerId: token.providerId ?? null,
  });
}

// ── Token Retrieval ──────────────────────────────────────────────────────────

/**
 * Retrieves a valid (non-expired) OAuth token from the database.
 * If the stored token is PGP-encrypted, it will be decrypted before returning.
 *
 * Note: Due to current schema constraints (no per-provider token association),
 * this returns the most recent non-expired token. For providers that require
 * separate tokens, extend the schema with a providerId foreign key.
 */
export async function getValidToken(providerId: string): Promise<string> {
  const [existingToken] = await db
    .select()
    .from(oauthTokens)
    .where(and(
      eq(oauthTokens.providerId, providerId),
      gt(oauthTokens.expiryDate, new Date()),
    ))
    .orderBy(oauthTokens.expiryDate)
    .limit(1);

  if (existingToken) {
    return decryptTokenIfConfigured(existingToken.accessToken);
  }

  // No valid token found — fetch new credentials from the provider
  const [provider] = await db
    .select()
    .from(domainCheckProviders)
    .where(eq(domainCheckProviders.id, providerId));

  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  // Build credentials from env vars
  const apiBaseUrl = process.env.CYSMO_API_BASE_URL ?? '';
  const clientId = process.env.CYSMO_CLIENT_ID ?? '';
  let clientSecret = process.env.CYSMO_CLIENT_SECRET ?? '';

  // Decrypt per-provider API key if available
  if (provider.apiKeyEncrypted) {
    const privateKeyArmored = process.env.PGP_PRIVATE_KEY;
    const passphrase = process.env.PGP_PASSPHRASE;
    if (privateKeyArmored && passphrase) {
      clientSecret = await decryptString(provider.apiKeyEncrypted, privateKeyArmored, passphrase);
    }
  }

  if (!apiBaseUrl || !clientId || !clientSecret) {
    throw new Error(
      'OAuth credentials not configured. Set CYSMO_API_BASE_URL, CYSMO_CLIENT_ID, and CYSMO_CLIENT_SECRET.',
    );
  }

  const tokenUrl = `${apiBaseUrl.replace(/\/+$/, '')}/oauth/token`;

  // Fetch a new token using client_credentials grant
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let tokenResponse: TokenResponse;
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
    tokenResponse = {
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

  // Store the new token
  const expiryDate = new Date(Date.now() + tokenResponse.expires_in * 1000);
  await storeToken({
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
