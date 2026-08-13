// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Cysmo provider adapter", () => {
  beforeEach(() => {
    process.env.CYSMO_API_BASE_URL = "https://api.cysmo.de";
    process.env.CYSMO_CLIENT_ID = "client-id";
    process.env.CYSMO_CLIENT_SECRET = "client-secret";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CYSMO_API_BASE_URL;
    delete process.env.CYSMO_CLIENT_ID;
    delete process.env.CYSMO_CLIENT_SECRET;
    vi.resetModules();
  });

  it("starts a company operation and polls the embedded company response", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "company-1", reports: [{ id: "report-1", state: "NEW", running: true }] }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token-2" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "company-1", reports: [{ id: "report-1", state: "FINISHED", running: false, partialRatings: [] }] }), { status: 200 }));

    const { getProviderAdapter } = await import("./domain-check-cysmo");
    const adapter = getProviderAdapter("cysmo");
    expect(adapter).not.toBeNull();
    const job = await adapter!.start({ url: "https://example.com/path", providerKey: "cysmo" });
    expect(job).toMatchObject({ externalJobId: "company-1", externalReportId: "report-1" });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.cysmo.de/oauth/token", expect.objectContaining({
      method: "POST",
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: "client-id", client_secret: "client-secret" }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.cysmo.de/v2/companies?acceptSubDomain=true&acceptNotReachable=true", expect.objectContaining({ method: "POST", body: JSON.stringify({ domains: ["example.com"], nets: [] }) }));

    const result = await adapter!.poll({ url: "example.com", providerKey: "cysmo", externalJobId: job.externalJobId, externalReportId: job.externalReportId });
    expect(result).toMatchObject({ status: "completed", externalReportId: "report-1" });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "https://api.cysmo.de/v2/companies/company-1", expect.objectContaining({ method: "GET" }));
  });

  it("accepts the embedded-company fallback for unacknowledged subdomains", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "company-2", type: "UNACKNOWLEDGED_SUBDOMAINS", domains: ["sub.example.com"] }), { status: 422 }));

    const { getProviderAdapter } = await import("./domain-check-cysmo");
    const job = await getProviderAdapter("cysmo")!.start({ url: "sub.example.com", providerKey: "cysmo" });
    expect(job.externalJobId).toBe("company-2");
    expect(job.snapshot).toMatchObject({ unacknowledgedSubdomains: ["sub.example.com"] });
  });
});
