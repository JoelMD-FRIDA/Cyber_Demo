// ── Deterministic Test Fixtures ──────────────────────────────────────────────
//
// All fixture functions return plain domain-model objects with deterministic
// UUIDs and predictable data. They do NOT touch the database.
//
// For DB seeding, pass the returned object to the appropriate `db.insert()`
// call in your test or Playwright setup.
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//
//   import { createFixtureAdmin } from '@/test/fixtures';
//   import { db, users } from '@/db';
//
//   const admin = createFixtureAdmin();
//   await db.insert(users).values(admin);
//
// ──────────────────────────────────────────────────────────────────────────────

import type {
  NewUser,
  NewRegistrationKey,
  NewDomainCheckProvider,
  NewDomainCheckCategory,
  NewDomainCheckResult,
  NewApiCredential,
  NewOAuthToken,
  NewPgpCertificate,
  NewEmailTemplate,
  NewEmailQueueItem,
  NewFileDocument,
  NewAppSetting,
  NewSystemLanguage,
  NewEmailAccount,
  NewOutgoingEmailConfig,
  NewIncomingEmailConfig,
  NewOAuthProvider,
  NewLdapConfiguration,
  NewEmailConnectorOAuthToken,
} from "@/db";

// ── Deterministic UUID helpers ────────────────────────────────────────────────

/**
 * Deterministic UUID v4-style literal for test isolation.
 * Increment `seq` to get unique, predictable IDs.
 */
export function fixtureId(seq: number): string {
  const hex = seq.toString(16).padStart(12, "0");
  return `00000000-0000-0000-0000-${hex}`;
}

export const FIXTURE_PASSWORD = "TestPassword123!";
export const FIXTURE_PASSWORD_HASH =
  "$2a$10$dummyhashnotrealsecurebutdeterministicfortests00000000000000000000000";

// ── Users ─────────────────────────────────────────────────────────────────────

export interface CreateFixtureUserOptions {
  seq?: number;
  email?: string;
  username?: string;
  role?: "admin" | "user";
  isActivated?: boolean;
  performedDomainChecks?: number;
  company?: string;
}

/** Deterministic regular user for tests. */
export function createFixtureUser(
  opts: CreateFixtureUserOptions = {},
): NewUser {
  const seq = opts.seq ?? 1;
  return {
    email: opts.email ?? `testuser${seq}@example.com`,
    username: opts.username ?? `testuser${seq}`,
    firstname: "Test",
    lastname: `User${seq}`,
    company: opts.company ?? "TestCompany",
    performedDomainChecks: opts.performedDomainChecks ?? 0,
    isActivated: opts.isActivated ?? true,
    role: opts.role ?? "user",
    passwordHash: FIXTURE_PASSWORD_HASH,
  };
}

/** Deterministic admin user for tests. */
export function createFixtureAdmin(
  opts: CreateFixtureUserOptions = {},
): NewUser {
  return createFixtureUser({
    seq: 0,
    email: "admin@example.com",
    role: "admin",
    isActivated: true,
    ...opts,
  });
}

// ── Registration Keys ─────────────────────────────────────────────────────────

export interface CreateFixtureRegistrationKeyOptions {
  seq?: number;
  code?: string;
  companyDomain?: string;
  totalSlots?: number;
  company?: string;
  usedCount?: number;
  enabled?: boolean;
  expiresAt?: Date | null;
}

export function createFixtureRegistrationKey(
  opts: CreateFixtureRegistrationKeyOptions = {},
): NewRegistrationKey {
  const seq = opts.seq ?? 1;
  return {
    code: opts.code ?? `TESTKEY-${seq.toString().padStart(4, "0")}`,
    companyDomain: opts.companyDomain ?? `example${seq}.com`,
    totalSlots: opts.totalSlots ?? 10,
    company: opts.company ?? "TestCompany",
    usedCount: opts.usedCount ?? 0,
    enabled: opts.enabled ?? true,
    expiresAt: opts.expiresAt ?? null,
  };
}

// ── Domain Check Providers ────────────────────────────────────────────────────

export interface CreateFixtureProviderOptions {
  seq?: number;
  name?: string;
  isActive?: boolean;
  websiteUrl?: string;
  apiBaseUrl?: string;
}

export function createFixtureProvider(
  opts: CreateFixtureProviderOptions = {},
): NewDomainCheckProvider {
  const seq = opts.seq ?? 1;
  return {
    uuid: fixtureId(100 + seq),
    name: opts.name ?? `TestProvider${seq}`,
    isActive: opts.isActive ?? true,
    websiteUrl: opts.websiteUrl ?? `https://provider${seq}.example.com`,
    description: `Test domain check provider ${seq}`,
    shortDescription: `Provider ${seq} short description`,
    longDescription: `Provider ${seq} long description that goes into detail about the service.`,
    apiBaseUrl: opts.apiBaseUrl ?? `https://api.provider${seq}.example.com`,
  };
}

// ── Domain Check Categories ───────────────────────────────────────────────────

export interface CreateFixtureCategoryOptions {
  seq?: number;
  name?: string;
  description?: string;
}

export function createFixtureCategory(
  opts: CreateFixtureCategoryOptions = {},
): NewDomainCheckCategory {
  const seq = opts.seq ?? 1;
  return {
    uuid: fixtureId(200 + seq),
    name: opts.name ?? `TestCategory${seq}`,
    description: opts.description ?? `Test domain check category ${seq}`,
  };
}

// ── Domain Check Results (structured fields) ──────────────────────────────────

export interface CreateFixtureDomainCheckResultOptions {
  seq?: number;
  resultsPWLeaks?: number;
  resultsEmailLeaks?: number;
  resultsEoLSoftware?: number;
  resultsOpenPorts?: number;
  resultsSPFRecord?: boolean;
  hasSPFRecordResult?: boolean;
  hasDarknetResults?: boolean;
  hasSoftwareResults?: boolean;
  hasOpenPortsResults?: boolean;
}

export function createFixtureDomainCheckResult(
  opts: CreateFixtureDomainCheckResultOptions = {},
): Omit<NewDomainCheckResult, "domainCheckId" | "categoryId"> {
  return {
    resultsPWLeaks: opts.resultsPWLeaks ?? 0,
    resultsEmailLeaks: opts.resultsEmailLeaks ?? 0,
    resultsEoLSoftware: opts.resultsEoLSoftware ?? 0,
    resultsOpenPorts: opts.resultsOpenPorts ?? 0,
    resultsSPFRecord: opts.resultsSPFRecord ?? false,
    hasSPFRecordResult: opts.hasSPFRecordResult ?? false,
    hasDarknetResults: opts.hasDarknetResults ?? false,
    hasSoftwareResults: opts.hasSoftwareResults ?? false,
    hasOpenPortsResults: opts.hasOpenPortsResults ?? false,
  };
}

// ── Bytea Test Buffers ────────────────────────────────────────────────────────

/** Returns a small valid PNG image buffer for testing. */
export function createTestImageBuffer(): Buffer {
  // Minimal valid PNG: 8-byte signature + IHDR chunk (13 bytes data + header)
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk: width=1, height=1, 8-bit grayscale
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0);   // width
  ihdrData.writeUInt32BE(1, 4);   // height
  ihdrData[8] = 8;                // bit depth
  ihdrData[9] = 0;                // color type (grayscale)
  ihdrData[10] = 0;               // compression
  ihdrData[11] = 0;               // filter
  ihdrData[12] = 0;               // interlace

  const chunkType = Buffer.from("IHDR");
  const crc = crc32(Buffer.concat([chunkType, ihdrData]));

  const ihdrChunk = Buffer.alloc(4 + 4 + ihdrData.length + 4);
  ihdrChunk.writeUInt32BE(ihdrData.length, 0); // data length
  chunkType.copy(ihdrChunk, 4);                 // chunk type
  ihdrData.copy(ihdrChunk, 8);                  // chunk data
  ihdrChunk.writeUInt32BE(crc, 8 + ihdrData.length); // CRC

  // IDAT chunk: minimal valid zlib stream for 1x1 grayscale
  const idatData = Buffer.from([0x78, 0x01, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]);
  const idatChunkType = Buffer.from("IDAT");
  const idatCrc = crc32(Buffer.concat([idatChunkType, idatData]));

  const idatChunk = Buffer.alloc(4 + 4 + idatData.length + 4);
  idatChunk.writeUInt32BE(idatData.length, 0);
  idatChunkType.copy(idatChunk, 4);
  idatData.copy(idatChunk, 8);
  idatChunk.writeUInt32BE(idatCrc, 8 + idatData.length);

  // IEND chunk
  const iendType = Buffer.from("IEND");
  const iendCrc = crc32(iendType);
  const iendChunk = Buffer.alloc(4 + 4 + 0 + 4);
  iendChunk.writeUInt32BE(0, 0);
  iendType.copy(iendChunk, 4);
  iendChunk.writeUInt32BE(iendCrc, 8);

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/** Returns a minimal valid PDF buffer for testing. */
export function createTestPdfBuffer(): Buffer {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj

xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 

trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF`;
  return Buffer.from(content, "utf-8");
}

// ── CR-32 for PNG generation (simplified table-based) ─────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── Additional Fixture Helpers ────────────────────────────────────────────────

export function createFixtureApiCredential(
  seq = 1,
): NewApiCredential {
  return {
    apiUrl: `https://api.example${seq}.com/v1`,
    oauthUrl: `https://auth.example${seq}.com/oauth/token`,
    username: `apiuser${seq}`,
    passwordEncrypted: `encrypted_password_${seq}`,
  };
}

export function createFixtureOAuthToken(): NewOAuthToken {
  return {
    accessToken: "test-access-token-mock-value",
    expiresIn: 3600,
    refreshExpiresIn: 86400,
    tokenType: "Bearer",
    scope: "domain-check:read",
    expiryDate: new Date(Date.now() + 3600 * 1000),
  };
}

export function createFixtureEmailTemplate(
  seq = 1,
): NewEmailTemplate {
  return {
    name: `test-template-${seq}`,
    subject: `Test Subject ${seq}`,
    body: `<h1>Test Body ${seq}</h1><p>Hello {{name}}!</p>`,
    fromAddress: "noreply@test.com",
    fromDisplayName: "Test App",
    replyTo: "support@test.com",
  };
}

export function createFixtureEmailQueueItem(
  to = "user@test.com",
): NewEmailQueueItem {
  return {
    to,
    subject: "Test Email",
    body: "<p>Test body</p>",
    status: "pending",
    scheduledAt: new Date(),
    retryCount: 0,
  };
}

export function createFixtureFileDocument(
  seq = 1,
): NewFileDocument {
  return {
    name: `test-file-${seq}.txt`,
    mimeType: "text/plain",
    size: 12,
    hasContents: true,
    content: Buffer.from("Hello World!"),
    reference: null,
    referenceId: null,
  };
}

export function createFixtureAppSetting(
  key = "maximum_number_of_checks",
  value = "10",
): NewAppSetting {
  return {
    key,
    value,
    maximumNumberOfChecks: parseInt(value, 10) || 10,
  };
}

export function createFixtureSystemLanguage(
  code = "de_DE",
  description = "German (Germany)",
): NewSystemLanguage {
  return {
    code,
    description,
  };
}

export function createFixtureEmailAccount(
  seq = 1,
): NewEmailAccount {
  return {
    mailAddress: `outgoing${seq}@test.com`,
    username: `smtpuser${seq}`,
    passwordEncrypted: `smtp_pass_encrypted_${seq}`,
    fromDisplayName: `Test Outgoing ${seq}`,
    timeout: 20000,
    isSharedMailbox: false,
    isP12Configured: false,
    isOAuthUsed: false,
    isLDAPConfigured: false,
    isOutgoingEmailConfigured: true,
    isIncomingEmailConfigured: false,
    sanitizeEmailBodyForXSS: false,
    isEmailConfigAutoDetect: true,
    useSSLCheckServerIdentity: false,
  };
}

export function createFixtureOutgoingEmailConfig(
  emailAccountId?: string,
  seq = 1,
): NewOutgoingEmailConfig {
  return {
    emailAccountId: emailAccountId ?? fixtureId(300 + seq),
    serverHost: `smtp.test${seq}.com`,
    serverPort: 587,
    outgoingProtocol: 1,
    ssl: false,
    tls: true,
    sendMaxAttempts: 3,
  };
}

export function createFixtureIncomingEmailConfig(
  emailAccountId?: string,
  seq = 1,
): NewIncomingEmailConfig {
  return {
    emailAccountId: emailAccountId ?? fixtureId(400 + seq),
    serverHost: `imap.test${seq}.com`,
    serverPort: 993,
    incomingProtocol: 1,
    folder: "INBOX",
    batchSize: 50,
    processInlineImage: false,
    notifyOnNewEmails: false,
    useBatchImport: false,
  };
}

export function createFixtureOAuthProvider(
  seq = 1,
): NewOAuthProvider {
  return {
    name: `OAuth Provider ${seq}`,
    oAuthType: 1,
    authorizationEndpoint: `https://auth.test${seq}.com/authorize`,
    tokenEndpoint: `https://auth.test${seq}.com/token`,
    clientId: `test-client-id-${seq}`,
    clientSecretEncrypted: `test-client-secret-encrypted-${seq}`,
    emailDomain: `test${seq}.com`,
    callbackUrl: `https://app.test.com/api/auth/callback`,
    callbackOperationPath: `OAuthProvider_Callback`,
    tenantId: `tenant-${seq}`,
  };
}

export function createFixtureLdapConfiguration(
  seq = 1,
): NewLdapConfiguration {
  return {
    ldapHost: `ldap.test${seq}.com`,
    ldapPort: 389,
    ldapUsername: `cn=admin,dc=test${seq},dc=com`,
    ldapPasswordEncrypted: `ldap_pass_encrypted_${seq}`,
    baseDN: `dc=test${seq},dc=com`,
    authType: 0,
    isSSL: false,
  };
}

export function createFixturePgpCertificate(
  seq = 1,
): NewPgpCertificate {
  return {
    certificateType: seq % 2 === 0 ? 'private' : 'public',
    reference: `AABBCCDD00112233445566778899AABBCCDDEE${seq.toString().padStart(2, '0')}`,
    emailAddress: `pgp-user${seq}@example.com`,
    passphraseEncrypted: seq % 2 === 0 ? 'encrypted-passphrase-placeholder' : null,
    fileDocumentId: null,
  };
}

export function createFixtureEmailConnectorOAuthToken(
  emailAccountId?: string,
): NewEmailConnectorOAuthToken {
  return {
    emailAccountId: emailAccountId ?? fixtureId(500),
    accessToken: "mock-email-connector-access-token",
    refreshToken: "mock-email-connector-refresh-token",
    idToken: "mock-id-token",
    tokenType: "Bearer",
    scope: "email.read email.send",
    expiresIn: 3600,
  };
}
