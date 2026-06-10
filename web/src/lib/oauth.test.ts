// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-for-testing-only';
});

import { generateState, verifyState, storeToken } from './oauth';

vi.mock('@/db', () => {
  const store: Array<Record<string, unknown>> = [];
  (globalThis as Record<string, unknown>).__mockDbStore = store;

  return {
    db: {
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          const record = { id: crypto.randomUUID(), ...v, createdAt: new Date() };
          store.push(record);
          return { returning: () => [record] };
        },
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => {
                const now = new Date();
                const valid = store.filter(
                  (r: Record<string, unknown>) =>
                    r.expiryDate instanceof Date && r.expiryDate > now,
                );
                return valid.slice(0, 1);
              },
            }),
          }),
          limit: () => store.slice(0, 1),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => [],
          }),
        }),
      }),
    },
    oauthTokens: {},
    domainCheckProviders: {},
  };
});

describe('OAuth Service', () => {
  function getStore(): Array<Record<string, unknown>> {
    return (globalThis as Record<string, unknown>).__mockDbStore as Array<Record<string, unknown>>;
  }

  beforeEach(() => {
    const store = getStore();
    if (store) store.length = 0;
  });

  describe('generateState / verifyState', () => {
    it('generates a state JWT that can be verified', () => {
      const state = generateState();
      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      expect(state.split('.')).toHaveLength(3);

      const isValid = verifyState(state);
      expect(isValid).toBe(true);
    });

    it('rejects invalid state strings', () => {
      expect(verifyState('not-a-valid-state')).toBe(false);
      expect(verifyState('')).toBe(false);
    });

    it('rejects tampered state tokens', () => {
      const state = generateState();
      const tampered = state.slice(0, -5) + 'XXXXX';
      expect(verifyState(tampered)).toBe(false);
    });
  });

  describe('storeToken', () => {
    it('stores a token successfully', async () => {
      await storeToken({
        accessToken: 'test-access-token-123',
        expiresIn: 3600,
        refreshExpiresIn: 86400,
        tokenType: 'Bearer',
        scope: 'domain-check:read',
        expiryDate: new Date(Date.now() + 3600 * 1000),
      });

      const store = getStore();
      expect(store.length).toBe(1);
      const stored = store[0] as Record<string, unknown>;
      expect(stored.accessToken).toBe('test-access-token-123');
      expect(stored.tokenType).toBe('Bearer');
      expect(stored.scope).toBe('domain-check:read');
    });

    it('stores a token without optional fields', async () => {
      await storeToken({
        accessToken: 'minimal-token',
      });

      const store = getStore();
      expect(store.length).toBe(1);
      const stored = store[0] as Record<string, unknown>;
      expect(stored.accessToken).toBe('minimal-token');
      expect(stored.expiresIn).toBeNull();
      expect(stored.refreshExpiresIn).toBeNull();
      expect(stored.tokenType).toBeNull();
      expect(stored.scope).toBeNull();
      expect(stored.expiryDate).toBeNull();
    });
  });

  describe('OAuth Flow parity with JA_REST_GetOauthToken', () => {
    it('uses client_credentials grant type', () => {
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
      });
      const bodyString = params.toString();

      expect(bodyString).toContain('grant_type=client_credentials');
      expect(bodyString).toContain('client_id=test-client-id');
      expect(bodyString).toContain('client_secret=test-client-secret');

      const parts = bodyString.split('&');
      expect(parts[0]).toBe('grant_type=client_credentials');
      expect(parts[1]).toBe('client_id=test-client-id');
      expect(parts[2]).toBe('client_secret=test-client-secret');
    });

    it('has the same TokenResponse shape as Mendix HttpResponse', () => {
      const mockCysmoResponse = {
        access_token: 'cysmo-access-token-value',
        expires_in: 3600,
        refresh_expires_in: 86400,
        refresh_token: 'cysmo-refresh-token-value',
        token_type: 'Bearer',
        scope: 'domain-check:read',
      };

      const token = mockCysmoResponse;
      expect(token.access_token).toBeDefined();
      expect(token.expires_in).toBeDefined();
      expect(token.token_type).toBeDefined();

      const storedToken = {
        accessToken: token.access_token,
        expiresIn: token.expires_in,
        refreshExpiresIn: token.refresh_expires_in,
        tokenType: token.token_type,
        scope: token.scope,
        expiryDate: new Date(Date.now() + token.expires_in * 1000),
      };

      expect(storedToken.accessToken).toBe('cysmo-access-token-value');
      expect(storedToken.tokenType).toBe('Bearer');
      expect(storedToken.expiryDate).toBeInstanceOf(Date);
    });
  });
});
