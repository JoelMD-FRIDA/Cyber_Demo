// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  deleteUser: vi.fn(),
  profileLookup: vi.fn(),
  reserveKey: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.profileLookup }),
      }),
    }),
    rpc: mocks.reserveKey,
    auth: { admin: { deleteUser: mocks.deleteUser } },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signUp: mocks.signUp } }),
}));

import { POST } from "./route";

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseBody = { email: "test@example.com", password: "Secure123!", firstname: "Test", lastname: "User" };

describe("POST /api/auth/register - Supabase boundary", () => {
  beforeEach(() => {
    mocks.signUp.mockReset().mockResolvedValue({ data: { user: { id: "user-1" }, session: null }, error: null });
    mocks.deleteUser.mockReset().mockResolvedValue({ error: null });
    mocks.profileLookup.mockReset().mockResolvedValue({ data: null, error: null });
    mocks.reserveKey.mockReset().mockResolvedValue({ data: { id: "key-1" }, error: null });
  });

  it("creates a Supabase Auth user without a key", async () => {
    const response = await POST(buildRequest(baseBody));
    expect(response.status).toBe(201);
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: baseBody.email, password: baseBody.password }));
    expect(mocks.reserveKey).not.toHaveBeenCalled();
  });

  it("atomically reserves a supplied registration key", async () => {
    const response = await POST(buildRequest({ ...baseBody, registrationCode: "KEY-001" }));
    expect(response.status).toBe(201);
    expect(mocks.reserveKey).toHaveBeenCalledWith("reserve_registration_key", { p_code: "KEY-001" });
  });

  it.each([
    ["REGISTRATION_KEY_NOT_FOUND", "invalid"],
    ["REGISTRATION_KEY_EXPIRED", "expired"],
    ["REGISTRATION_KEY_DISABLED", "disabled"],
    ["REGISTRATION_KEY_EXHAUSTED", "no available slots"],
  ])("rejects a key when Supabase returns %s", async (code, message) => {
    mocks.reserveKey.mockResolvedValue({ data: null, error: { message: code } });
    const response = await POST(buildRequest({ ...baseBody, registrationCode: "KEY-001" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain(message);
    expect(mocks.deleteUser).toHaveBeenCalledWith("user-1");
  });
});
