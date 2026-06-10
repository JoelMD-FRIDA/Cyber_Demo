import { describe, it, expect } from "vitest";
import {
  createFixtureAdmin,
  createFixtureUser,
  createFixtureRegistrationKey,
  createFixtureProvider,
  createFixtureCategory,
  createFixtureDomainCheckResult,
  createTestImageBuffer,
  createTestPdfBuffer,
  createFixtureApiCredential,
  createFixtureOAuthToken,
  createFixtureEmailTemplate,
  createFixtureEmailQueueItem,
  createFixtureFileDocument,
  createFixtureAppSetting,
  createFixtureSystemLanguage,
  createFixtureEmailAccount,
  createFixtureOutgoingEmailConfig,
  createFixtureIncomingEmailConfig,
  createFixtureOAuthProvider,
  createFixtureLdapConfiguration,
  createFixtureEmailConnectorOAuthToken,
  fixtureId,
  FIXTURE_PASSWORD_HASH,
} from "./fixtures";

describe("fixtureId", () => {
  it("produces deterministic UUIDs", () => {
    expect(fixtureId(1)).toBe("00000000-0000-0000-0000-000000000001");
    expect(fixtureId(255)).toBe("00000000-0000-0000-0000-0000000000ff");
  });
});

describe("createFixtureAdmin", () => {
  it("returns an admin user", () => {
    const admin = createFixtureAdmin();
    expect(admin.role).toBe("admin");
    expect(admin.email).toBe("admin@example.com");
    expect(admin.isActivated).toBe(true);
    expect(admin.passwordHash).toBe(FIXTURE_PASSWORD_HASH);
  });

  it("allows overrides", () => {
    const admin = createFixtureAdmin({ email: "custom@example.com" });
    expect(admin.email).toBe("custom@example.com");
  });
});

describe("createFixtureUser", () => {
  it("returns a regular user", () => {
    const user = createFixtureUser();
    expect(user.role).toBe("user");
    expect(user.email).toBe("testuser1@example.com");
    expect(user.firstname).toBe("Test");
    expect(user.lastname).toBe("User1");
    expect(user.isActivated).toBe(true);
  });

  it("increments seq for uniqueness", () => {
    const u1 = createFixtureUser({ seq: 1 });
    const u2 = createFixtureUser({ seq: 2 });
    expect(u1.email).not.toBe(u2.email);
    expect(u2.lastname).toBe("User2");
  });

  it("creates unactivated user", () => {
    const user = createFixtureUser({ isActivated: false });
    expect(user.isActivated).toBe(false);
  });
});

describe("createFixtureRegistrationKey", () => {
  it("returns deterministic key", () => {
    const key = createFixtureRegistrationKey();
    expect(key.code).toBe("TESTKEY-0001");
    expect(key.totalSlots).toBe(10);
    expect(key.usedCount).toBe(0);
    expect(key.enabled).toBe(true);
    expect(key.expiresAt).toBeNull();
  });

  it("supports overrides", () => {
    const key = createFixtureRegistrationKey({
      code: "CUSTOM",
      totalSlots: 5,
    });
    expect(key.code).toBe("CUSTOM");
    expect(key.totalSlots).toBe(5);
  });

  it("supports new field overrides", () => {
    const future = new Date("2027-01-01");
    const key = createFixtureRegistrationKey({
      usedCount: 3,
      enabled: false,
      expiresAt: future,
    });
    expect(key.usedCount).toBe(3);
    expect(key.enabled).toBe(false);
    expect(key.expiresAt).toBe(future);
  });
});

describe("createFixtureProvider", () => {
  it("returns active provider with deterministic data", () => {
    const p = createFixtureProvider();
    expect(p.name).toBe("TestProvider1");
    expect(p.isActive).toBe(true);
    expect(p.uuid).toBe(fixtureId(101));
    expect(p.apiBaseUrl).toBe("https://api.provider1.example.com");
  });
});

describe("createFixtureCategory", () => {
  it("returns category with deterministic data", () => {
    const c = createFixtureCategory();
    expect(c.name).toBe("TestCategory1");
    expect(c.uuid).toBe(fixtureId(201));
  });
});

describe("createFixtureDomainCheckResult", () => {
  it("returns defaults with no leaks", () => {
    const r = createFixtureDomainCheckResult();
    expect(r.resultsPWLeaks).toBe(0);
    expect(r.resultsEmailLeaks).toBe(0);
    expect(r.resultsSPFRecord).toBe(false);
    expect(r.hasDarknetResults).toBe(false);
  });

  it("accepts overrides", () => {
    const r = createFixtureDomainCheckResult({ resultsPWLeaks: 42 });
    expect(r.resultsPWLeaks).toBe(42);
  });
});

describe("createTestImageBuffer", () => {
  it("returns a valid PNG buffer", () => {
    const buf = createTestImageBuffer();
    expect(Buffer.isBuffer(buf)).toBe(true);
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
    expect(buf.length).toBeGreaterThan(50);
  });
});

describe("createTestPdfBuffer", () => {
  it("returns a valid PDF buffer", () => {
    const buf = createTestPdfBuffer();
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString("utf-8").startsWith("%PDF-1.4")).toBe(true);
    expect(buf.toString("utf-8")).toContain("%%EOF");
  });
});

describe("additional fixtures", () => {
  it("createFixtureApiCredential", () => {
    const cred = createFixtureApiCredential();
    expect(cred.apiUrl).toContain("example1.com");
  });

  it("createFixtureOAuthToken", () => {
    const tok = createFixtureOAuthToken();
    expect(tok.accessToken).toBe("test-access-token-mock-value");
    expect(tok.tokenType).toBe("Bearer");
  });

  it("createFixtureEmailTemplate", () => {
    const tpl = createFixtureEmailTemplate();
    expect(tpl.name).toBe("test-template-1");
    expect(tpl.subject).toBe("Test Subject 1");
  });

  it("createFixtureEmailQueueItem", () => {
    const item = createFixtureEmailQueueItem("test@test.com");
    expect(item.to).toBe("test@test.com");
    expect(item.status).toBe("pending");
  });

  it("createFixtureFileDocument", () => {
    const doc = createFixtureFileDocument();
    expect(doc.name).toBe("test-file-1.txt");
    expect(doc.mimeType).toBe("text/plain");
    expect(doc.content).toBeDefined();
  });

  it("createFixtureAppSetting", () => {
    const s = createFixtureAppSetting();
    expect(s.key).toBe("maximum_number_of_checks");
    expect(s.maximumNumberOfChecks).toBe(10);
  });

  it("createFixtureSystemLanguage", () => {
    const lang = createFixtureSystemLanguage();
    expect(lang.code).toBe("de_DE");
  });

  it("createFixtureEmailAccount", () => {
    const acct = createFixtureEmailAccount();
    expect(acct.mailAddress).toBe("outgoing1@test.com");
    expect(acct.isOutgoingEmailConfigured).toBe(true);
  });

  it("createFixtureOutgoingEmailConfig", () => {
    const cfg = createFixtureOutgoingEmailConfig();
    expect(cfg.serverHost).toBe("smtp.test1.com");
    expect(cfg.serverPort).toBe(587);
  });

  it("createFixtureIncomingEmailConfig", () => {
    const cfg = createFixtureIncomingEmailConfig();
    expect(cfg.serverHost).toBe("imap.test1.com");
    expect(cfg.folder).toBe("INBOX");
  });

  it("createFixtureOAuthProvider", () => {
    const p = createFixtureOAuthProvider();
    expect(p.name).toBe("OAuth Provider 1");
  });

  it("createFixtureLdapConfiguration", () => {
    const ldap = createFixtureLdapConfiguration();
    expect(ldap.ldapHost).toBe("ldap.test1.com");
  });

  it("createFixtureEmailConnectorOAuthToken", () => {
    const tok = createFixtureEmailConnectorOAuthToken();
    expect(tok.accessToken).toBe("mock-email-connector-access-token");
    expect(tok.scope).toBe("email.read email.send");
  });
});
