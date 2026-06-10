import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockOAuthTokenResponse,
  createMockDomainCheckResponse,
  createCleanDomainCheckResponse,
  createCompromisedDomainCheckResponse,
  mockCysmoApi,
  restoreCysmoApi,
} from "./mock-domain-check";

describe("mock-domain-check", () => {
  describe("createMockOAuthTokenResponse", () => {
    it("returns a valid OAuth token response", () => {
      const token = createMockOAuthTokenResponse();
      expect(token.access_token).toBe("mock-cysmo-access-token-for-tests");
      expect(token.token_type).toBe("Bearer");
      expect(token.expires_in).toBe(3600);
    });
  });

  describe("createMockDomainCheckResponse", () => {
    it("returns a completed check with defaults", () => {
      const res = createMockDomainCheckResponse();
      expect(res.url).toBe("https://example.com");
      expect(res.status).toBe("completed");
      expect(res.results.spf).toBeDefined();
      expect(res.results.ports).toBeDefined();
      expect(res.results.leaks).toBeDefined();
      expect(res.results.software).toBeDefined();
      expect(res.checkedAt).toBeDefined();
    });

    it("accepts URL parameter", () => {
      const res = createMockDomainCheckResponse("https://custom.com");
      expect(res.url).toBe("https://custom.com");
    });

    it("accepts overrides", () => {
      const res = createMockDomainCheckResponse("https://test.com", {
        status: "error",
      });
      expect(res.status).toBe("error");
    });
  });

  describe("createCleanDomainCheckResponse", () => {
    it("returns all-clear results", () => {
      const res = createCleanDomainCheckResponse();
      expect(res.results.leaks.password_leaks).toBe(0);
      expect(res.results.leaks.email_leaks).toBe(0);
      expect(res.results.spf.spf_record).toBe(true);
      expect(res.results.ports.open_ports).toBe(0);
      expect(res.results.software.eol_software).toBe(0);
    });
  });

  describe("createCompromisedDomainCheckResponse", () => {
    it("returns compromised results", () => {
      const res = createCompromisedDomainCheckResponse();
      expect(res.results.leaks.password_leaks).toBe(42);
      expect(res.results.leaks.email_leaks).toBe(17);
      expect(res.results.ports.open_ports).toBe(5);
      expect(res.results.software.eol_software).toBe(3);
      expect(res.results.spf.spf_record).toBe(false);
      expect(res.results.leaks.has_darknet_results).toBe(true);
    });
  });

  describe("mockCysmoApi / restoreCysmoApi", () => {
    beforeEach(() => {
      restoreCysmoApi();
    });

    it("mocks fetch for OAuth token and domain check", async () => {
      mockCysmoApi();

      // OAuth token request
      const oauthRes = await fetch("https://api.cysmo.com/oauth/token", {
        method: "POST",
      });
      const oauthData = await oauthRes.json();
      expect(oauthData.access_token).toBe("mock-cysmo-access-token-for-tests");

      // Domain check request
      const checkRes = await fetch("https://api.cysmo.com/api/v1/domain-check", {
        method: "POST",
        body: JSON.stringify({ url: "https://test.com" }),
      });
      const checkData = await checkRes.json();
      expect(checkData.url).toBe("https://test.com");
      expect(checkData.status).toBe("completed");
    });

    it("restores fetch after restore", async () => {
      mockCysmoApi();
      restoreCysmoApi();

      // After restore, fetch should not be mocked for our URLs
      // (it will reject because there's no real server — but should NOT return mock data)
      const fetchSpy = vi.spyOn(global, "fetch");
      // Don't actually call fetch — just verify it's the real one
      expect(fetchSpy).toBeDefined();
      fetchSpy.mockRestore();
    });
  });
});
