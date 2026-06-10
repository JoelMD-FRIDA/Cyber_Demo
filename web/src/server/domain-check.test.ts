// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Hoisted shared state for DB mock ─────────────────────────────────────────

const testState = vi.hoisted(() => {
  const domainChecksStore: Array<Record<string, unknown>> = [];
  const domainCheckResultsStore: Array<Record<string, unknown>> = [];
  const usersStore: Array<Record<string, unknown>> = [];
  const appSettingsStore: Array<Record<string, unknown>> = [];
  let lastEqValue: unknown = undefined;

  return {
    domainChecksStore,
    domainCheckResultsStore,
    usersStore,
    appSettingsStore,
    getLastEqValue: () => lastEqValue,
    setLastEqValue: (v: unknown) => { lastEqValue = v; },
    reset: () => {
      domainChecksStore.length = 0;
      domainCheckResultsStore.length = 0;
      usersStore.length = 0;
      appSettingsStore.length = 0;
      lastEqValue = undefined;
    },
  };
});

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (column: unknown, value: unknown) => {
      testState.setLastEqValue(value);
      return actual.eq(column as Parameters<typeof actual.eq>[0], value);
    },
  };
});

vi.mock('@/db', () => {
  return {
    db: {
      insert: () => ({
        values: (v: Record<string, unknown>) => ({
          returning: () => {
            const record = { ...v, id: crypto.randomUUID(), createdAt: new Date() };
            testState.domainChecksStore.push(record);
            return [record];
          },
        }),
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: (n: number) => {
              const val = testState.getLastEqValue();
              if (val === 'maximum_number_of_checks') {
                return testState.appSettingsStore.slice(0, n);
              }
              const user = testState.usersStore.find(u => u.id === val);
              return user ? [user] : [];
            },
            orderBy: () => ({
              limit: () => [],
            }),
          }),
        }),
        limit: () => [],
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
      delete: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    } as Record<string, unknown>,
    appSettings: {},
    users: {},
    domainChecks: {},
    domainCheckResults: {},
    domainCheckProviders: {},
    domainCheckCategories: {},
    oauthTokens: {},
  };
});

vi.mock('@/lib/pgp', () => ({
  decryptString: vi.fn().mockResolvedValue('decrypted-api-key'),
}));

// ── Import after mocks ───────────────────────────────────────────────────────

import {
  validateDisclaimer,
  getMaximumChecks,
  getRemainingChecks,
  enforceCheckLimit,
  mapCysmoResponseToStructuredResult,
  DisclaimerError,
  CheckLimitError,
} from './domain-check';

describe('domain-check service', () => {
  beforeEach(() => {
    testState.reset();
  });

  describe('validateDisclaimer', () => {
    it('throws DisclaimerError when disclaimer not accepted', () => {
      expect(() => validateDisclaimer(false, '1.0')).toThrow(DisclaimerError);
      expect(() => validateDisclaimer(undefined, '1.0')).toThrow(DisclaimerError);
      expect(() => validateDisclaimer(null, '1.0')).toThrow(DisclaimerError);
    });

    it('throws DisclaimerError when version is missing', () => {
      expect(() => validateDisclaimer(true, null)).toThrow(DisclaimerError);
      expect(() => validateDisclaimer(true, undefined)).toThrow(DisclaimerError);
      expect(() => validateDisclaimer(true, '')).toThrow(DisclaimerError);
    });

    it('passes when disclaimer is accepted with valid version', () => {
      expect(() => validateDisclaimer(true, '1.0')).not.toThrow();
    });
  });

  describe('getMaximumChecks', () => {
    it('returns default 10 when no app setting exists', async () => {
      testState.appSettingsStore.length = 0;
      const max = await getMaximumChecks();
      expect(max).toBe(10);
    });

    it('returns value from app settings', async () => {
      const settingId = crypto.randomUUID();
      testState.appSettingsStore.push({
        id: settingId,
        key: 'maximum_number_of_checks',
        value: '5',
        maximumNumberOfChecks: 5,
      });
      const max = await getMaximumChecks();
      expect(max).toBe(5);
    });
  });

  describe('getRemainingChecks', () => {
    it('returns remaining checks based on user performed count and max', async () => {
      const userId = crypto.randomUUID();
      testState.usersStore.push({
        id: userId,
        email: 'test@example.com',
        performedDomainChecks: 3,
      });
      testState.appSettingsStore.push({
        id: crypto.randomUUID(),
        key: 'maximum_number_of_checks',
        value: '10',
        maximumNumberOfChecks: 10,
      });

      const result = await getRemainingChecks(userId);
      expect(result.performed).toBe(3);
      expect(result.remaining).toBe(7);
      expect(result.maxChecks).toBe(10);
    });
  });

  describe('enforceCheckLimit', () => {
    it('throws CheckLimitError when remaining is 0', async () => {
      const userId = crypto.randomUUID();
      testState.usersStore.push({
        id: userId,
        email: 'test@example.com',
        performedDomainChecks: 10,
      });
      testState.appSettingsStore.push({
        id: crypto.randomUUID(),
        key: 'maximum_number_of_checks',
        value: '10',
        maximumNumberOfChecks: 10,
      });

      await expect(enforceCheckLimit(userId)).rejects.toThrow(CheckLimitError);
    });

    it('returns remaining checks when under limit', async () => {
      const userId = crypto.randomUUID();
      testState.usersStore.push({
        id: userId,
        email: 'test@example.com',
        performedDomainChecks: 2,
      });
      testState.appSettingsStore.push({
        id: crypto.randomUUID(),
        key: 'maximum_number_of_checks',
        value: '10',
        maximumNumberOfChecks: 10,
      });

      const result = await enforceCheckLimit(userId);
      expect(result.remaining).toBe(8);
      expect(result.maxChecks).toBe(10);
    });
  });

  describe('mapCysmoResponseToStructuredResult', () => {
    it('maps a full Cysmo response to structured fields', () => {
      const raw = {
        url: 'https://example.com',
        status: 'completed',
        results: {
          spf: { spf_record: true, has_spf_record_result: true },
          ports: { open_ports: 5, has_open_ports_results: true },
          leaks: { password_leaks: 42, email_leaks: 17, has_darknet_results: true },
          software: { eol_software: 3, has_software_results: true },
        },
        checkedAt: new Date().toISOString(),
      };

      const result = mapCysmoResponseToStructuredResult(raw);

      expect(result.resultsPWLeaks).toBe(42);
      expect(result.resultsEmailLeaks).toBe(17);
      expect(result.resultsEoLSoftware).toBe(3);
      expect(result.resultsOpenPorts).toBe(5);
      expect(result.resultsSPFRecord).toBe(true);
      expect(result.hasSPFRecordResult).toBe(true);
      expect(result.hasDarknetResults).toBe(true);
      expect(result.hasSoftwareResults).toBe(true);
      expect(result.hasOpenPortsResults).toBe(true);
    });

    it('handles missing data gracefully', () => {
      const raw = { url: 'https://example.com', results: {} };
      const result = mapCysmoResponseToStructuredResult(raw);

      expect(result.resultsPWLeaks).toBe(0);
      expect(result.resultsEmailLeaks).toBe(0);
      expect(result.resultsOpenPorts).toBe(0);
      expect(result.resultsSPFRecord).toBe(false);
      expect(result.hasDarknetResults).toBe(false);
    });

    it('handles clean (no issues) response', () => {
      const raw = {
        url: 'https://secure-example.com',
        status: 'completed',
        results: {
          spf: { spf_record: true, has_spf_record_result: true },
          ports: { open_ports: 0, has_open_ports_results: false },
          leaks: { password_leaks: 0, email_leaks: 0, has_darknet_results: false },
          software: { eol_software: 0, has_software_results: false },
        },
      };

      const result = mapCysmoResponseToStructuredResult(raw);

      expect(result.resultsPWLeaks).toBe(0);
      expect(result.resultsEmailLeaks).toBe(0);
      expect(result.resultsEoLSoftware).toBe(0);
      expect(result.resultsOpenPorts).toBe(0);
      expect(result.resultsSPFRecord).toBe(true);
      expect(result.hasSPFRecordResult).toBe(true);
      expect(result.hasDarknetResults).toBe(false);
      expect(result.hasSoftwareResults).toBe(false);
      expect(result.hasOpenPortsResults).toBe(false);
    });

    it('defaults missing results sections to zeros and falses', () => {
      const raw = { url: 'https://minimal.com', results: null };
      const result = mapCysmoResponseToStructuredResult(raw);
      expect(result.resultsPWLeaks).toBe(0);
      expect(result.hasDarknetResults).toBe(false);
    });
  });

  describe('getRemainingChecks edge cases', () => {
    it('returns 0 remaining when user has used all checks', async () => {
      const userId = crypto.randomUUID();
      testState.usersStore.push({
        id: userId,
        email: 'test@example.com',
        performedDomainChecks: 10,
      });
      testState.appSettingsStore.push({
        id: crypto.randomUUID(),
        key: 'maximum_number_of_checks',
        value: '10',
        maximumNumberOfChecks: 10,
      });

      const result = await getRemainingChecks(userId);
      expect(result.remaining).toBe(0);
    });

    it('handles user with no performed checks', async () => {
      // Mock user lookup returns undefined
      const result = await getRemainingChecks('nonexistent-user-id');
      expect(result.performed).toBe(0);
      expect(result.remaining).toBe(10);
    });
  });
});
