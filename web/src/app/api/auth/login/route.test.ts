// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  profileLookup: vi.fn(),
  getResponse: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.profileLookup }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteClient: () => ({
    supabase: { auth: { signInWithPassword: mocks.signInWithPassword } },
    getResponse: mocks.getResponse,
  }),
}));

import { POST } from "./route";

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mocks.signInWithPassword.mockReset();
    mocks.profileLookup.mockReset();
    mocks.getResponse.mockReset();

    const cookieResponse = NextResponse.next();
    cookieResponse.cookies.set("sb-session", "session-token");
    mocks.getResponse.mockReturnValue(cookieResponse);
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mocks.profileLookup.mockResolvedValue({
      data: {
        id: "user-1",
        email: "person@example.com",
        username: "person",
        firstname: "Test",
        lastname: "User",
        company: null,
        role: "user",
      },
      error: null,
    });
  });

  it("copies the session cookies created during sign-in to the API response", async () => {
    const response = await POST(buildRequest({ identifier: "person@example.com", password: "Secure123!" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("sb-session=session-token");
    expect(mocks.getResponse).toHaveBeenCalled();
  });

  it("returns a distinct error when Supabase requires email confirmation", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: "email_not_confirmed" },
    });

    const response = await POST(buildRequest({ identifier: "person@example.com", password: "Secure123!" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("EMAIL_NOT_CONFIRMED");
  });
});
