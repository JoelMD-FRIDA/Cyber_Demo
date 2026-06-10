// ── Mock Cysmo Domain Check API ──────────────────────────────────────────────
//
// Provides mock implementations of Cysmo API responses for both Vitest unit
// tests and Playwright e2e tests. All responses use deterministic fixture data
// matching the domain_check_results structured fields.
//
// Usage (Vitest):
//   import { mockCysmoApi } from '@/test/mock-domain-check';
//   mockCysmoApi(); // intercepts global fetch
//
// Usage (Playwright):
//   import { createMockDomainCheckResponse } from '@/test/mock-domain-check';
//   await page.route('**/api/v1/domain-check', async (route) => {
//     await route.fulfill({ json: createMockDomainCheckResponse() });
//   });
//
// ──────────────────────────────────────────────────────────────────────────────

import { vi } from "vitest";
import { createFixtureDomainCheckResult } from "./fixtures";
import type { OAuthTokenResponse } from "@/server/domain-check";

// ── Cysmo OAuth Token Mock ────────────────────────────────────────────────────

export function createMockOAuthTokenResponse(): OAuthTokenResponse {
  return {
    access_token: "mock-cysmo-access-token-for-tests",
    expires_in: 3600,
    refresh_expires_in: 86400,
    token_type: "Bearer",
    scope: "domain-check:read",
  };
}

// ── Cysmo Domain Check Response ───────────────────────────────────────────────

export interface CysmoDomainCheckApiResponse {
  url: string;
  status: "completed" | "error";
  results: {
    spf: {
      spf_record: boolean;
      has_spf_record_result: boolean;
    };
    ports: {
      open_ports: number;
      has_open_ports_results: boolean;
    };
    leaks: {
      password_leaks: number;
      email_leaks: number;
      has_darknet_results: boolean;
    };
    software: {
      eol_software: number;
      has_software_results: boolean;
    };
  };
  checkedAt: string;
}

export function createMockDomainCheckResponse(
  url = "https://example.com",
  overrides?: Partial<CysmoDomainCheckApiResponse>,
): CysmoDomainCheckApiResponse {
  const r = createFixtureDomainCheckResult();
  return {
    url,
    status: "completed",
    results: {
      spf: {
        spf_record: r.resultsSPFRecord ?? false,
        has_spf_record_result: r.hasSPFRecordResult ?? false,
      },
      ports: {
        open_ports: r.resultsOpenPorts ?? 0,
        has_open_ports_results: r.hasOpenPortsResults ?? false,
      },
      leaks: {
        password_leaks: r.resultsPWLeaks ?? 0,
        email_leaks: r.resultsEmailLeaks ?? 0,
        has_darknet_results: r.hasDarknetResults ?? false,
      },
      software: {
        eol_software: r.resultsEoLSoftware ?? 0,
        has_software_results: r.hasSoftwareResults ?? false,
      },
    },
    checkedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Scenario Presets ──────────────────────────────────────────────────────────

export function createCleanDomainCheckResponse(
  url = "https://secure-example.com",
): CysmoDomainCheckApiResponse {
  return createMockDomainCheckResponse(url, {
    results: {
      spf: { spf_record: true, has_spf_record_result: true },
      ports: { open_ports: 0, has_open_ports_results: false },
      leaks: { password_leaks: 0, email_leaks: 0, has_darknet_results: false },
      software: { eol_software: 0, has_software_results: false },
    },
  });
}

export function createCompromisedDomainCheckResponse(
  url = "https://compromised-example.com",
): CysmoDomainCheckApiResponse {
  return createMockDomainCheckResponse(url, {
    status: "completed",
    results: {
      spf: { spf_record: false, has_spf_record_result: true },
      ports: { open_ports: 5, has_open_ports_results: true },
      leaks: {
        password_leaks: 42,
        email_leaks: 17,
        has_darknet_results: true,
      },
      software: { eol_software: 3, has_software_results: true },
    },
  });
}

// ── Vitest Global Mock Setup ─────────────────────────────────────────────────
//
// Call once in a `beforeAll` or `beforeEach` to intercept all fetch() calls
// and return mock Cysmo API responses.
//
// Works with vitest's `vi.fn()` – requires `vi` to be in scope (globals: true).
//
// Example:
//   beforeEach(() => { vi.useFakeTimers(); });
//   mockCysmoApi();

let originalFetch: typeof global.fetch | undefined;

export function mockCysmoApi(): void {
  originalFetch = global.fetch;

  vi.stubGlobal(
    "fetch",
    vi.fn(
      (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        const urlStr = typeof input === "string" ? input : input.toString();

        // OAuth token endpoint
        if (urlStr.includes("/oauth/token")) {
          return Promise.resolve(
            new Response(JSON.stringify(createMockOAuthTokenResponse()), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        // Domain check API
        if (urlStr.includes("/api/v1/domain-check")) {
          const body = init?.body
            ? JSON.parse(init.body as string)
            : { url: "https://example.com" };
          return Promise.resolve(
            new Response(
              JSON.stringify(createMockDomainCheckResponse(body.url)),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
          );
        }

        // Fall through to real fetch for other URLs
        return originalFetch
          ? originalFetch(input, init)
          : Promise.reject(new Error(`No fetch mock for: ${urlStr}`));
      },
    ),
  );
}

export function restoreCysmoApi(): void {
  if (originalFetch) {
    vi.stubGlobal("fetch", originalFetch);
    originalFetch = undefined;
  }
}
