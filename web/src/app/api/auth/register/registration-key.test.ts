import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

type SelectResult = Record<string, unknown>;

const selectResultsQueue: SelectResult[][] = [];

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => {
      const result = selectResultsQueue.shift() ?? [];
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(result),
          }),
        }),
      };
    }),
    insert: vi.fn(() => ({
      values: () => ({
        returning: vi.fn().mockResolvedValue([{ id: "uid", email: "test@example.com" }]),
      }),
    })),
    update: vi.fn(() => ({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    })),
  },
  users: {},
  activationRequests: {},
  registrationKeys: {},
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
}));

vi.mock("@/lib/email", () => ({
  sendWithTemplate: vi.fn().mockResolvedValue({ queued: true }),
}));

function buildRequest(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register - key validation", () => {
  beforeEach(() => {
    selectResultsQueue.length = 0;  // mutate in-place so vi.mock closure sees it
  });

  it("registers without registration key when not provided", async () => {
    selectResultsQueue.push([], []);  // email check, username check (skipped, but queued anyway)

    const res = await POST(buildRequest("http://localhost:3000/api/auth/register", {
      email: "a@b.com",
      password: "Secure123!",
      firstname: "Alice",
      lastname: "Smith",
    }));

    expect(res.status).toBe(201);
  });

  it("accepts valid registration key and increments usedCount", async () => {
    const validKey = {
      code: "KEY-001",
      enabled: true,
      usedCount: 0,
      totalSlots: 10,
      expiresAt: null,
      company: "Acme",
      companyDomain: "acme.com",
    };

    selectResultsQueue.push([], [validKey]);  // email check, key lookup

    const res = await POST(buildRequest("http://localhost:3000/api/auth/register", {
      email: "b@c.com",
      password: "Secure123!",
      firstname: "Bob",
      lastname: "Jones",
      registrationCode: "KEY-001",
    }));

    expect(res.status).toBe(201);
  });

  it("rejects invalid registration key (not found)", async () => {
    selectResultsQueue.push([], []);  // email check, key lookup

    const res = await POST(buildRequest("http://localhost:3000/api/auth/register", {
      email: "c@d.com",
      password: "Secure123!",
      firstname: "Carol",
      lastname: "Davis",
      registrationCode: "NONEXISTENT",
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid registration key");
  });

  it("rejects expired registration key", async () => {
    const expiredKey = {
      code: "EXP-KEY",
      enabled: true,
      usedCount: 0,
      totalSlots: 10,
      expiresAt: new Date("2020-01-01").toISOString(),
      company: null,
      companyDomain: null,
    };

    selectResultsQueue.push([], [expiredKey]);

    const res = await POST(buildRequest("http://localhost:3000/api/auth/register", {
      email: "d@e.com",
      password: "Secure123!",
      firstname: "Dave",
      lastname: "Evans",
      registrationCode: "EXP-KEY",
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("expired");
  });

  it("rejects disabled registration key", async () => {
    const disabledKey = {
      code: "DIS-KEY",
      enabled: false,
      usedCount: 0,
      totalSlots: 10,
      expiresAt: null,
      company: null,
      companyDomain: null,
    };

    selectResultsQueue.push([], [disabledKey]);

    const res = await POST(buildRequest("http://localhost:3000/api/auth/register", {
      email: "e@f.com",
      password: "Secure123!",
      firstname: "Eve",
      lastname: "Fox",
      registrationCode: "DIS-KEY",
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("disabled");
  });

  it("rejects used-up registration key", async () => {
    const fullKey = {
      code: "FULL-KEY",
      enabled: true,
      usedCount: 10,
      totalSlots: 10,
      expiresAt: null,
      company: null,
      companyDomain: null,
    };

    selectResultsQueue.push([], [fullKey]);

    const res = await POST(buildRequest("http://localhost:3000/api/auth/register", {
      email: "f@g.com",
      password: "Secure123!",
      firstname: "Frank",
      lastname: "Green",
      registrationCode: "FULL-KEY",
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("maximum number of uses");
  });
});
