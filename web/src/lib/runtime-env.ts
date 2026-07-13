export type EnvValueStatus = "set" | "unset";

export type RuntimeEnvName =
  | "CRON_SECRET"
  | "CYSMO_API_BASE_URL"
  | "CYSMO_CLIENT_ID"
  | "CYSMO_CLIENT_SECRET"
  | "DATABASE_URL"
  | "EMAIL_FROM"
  | "EMAIL_FROM_NAME"
  | "ENCRYPTION_KEY"
  | "JWT_SECRET"
  | "NEXT_PUBLIC_BASE_URL"
  | "NODE_ENV"
  | "PGP_PASSPHRASE"
  | "PGP_PRIVATE_KEY"
  | "PGP_PUBLIC_KEY"
  | "SMTP_HOST"
  | "SMTP_PASS"
  | "SMTP_PORT"
  | "SMTP_SECURE"
  | "SMTP_USER"
  | "TEST_CONNECTION_FIXTURE";

export interface SmtpDeliveryConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly auth: {
    readonly user: string;
    readonly pass: string;
  };
  readonly fromAddress: string;
  readonly fromDisplayName: string;
}

export interface CysmoConfig {
  readonly apiBaseUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface PgpPrivateConfig {
  readonly privateKeyArmored: string;
  readonly passphrase: string;
}

const DEFAULT_PUBLIC_BASE_URL = "http://localhost:3000";
const DEFAULT_SMTP_PORT = 587;
const DEFAULT_EMAIL_FROM_NAME = "Cyber-Vorabcheck";

function readEnv(name: RuntimeEnvName): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function envStatus(name: RuntimeEnvName): EnvValueStatus {
  return readEnv(name) ? "set" : "unset";
}

export function envStatuses(
  names: readonly RuntimeEnvName[],
): Record<string, EnvValueStatus> {
  const statuses: Record<string, EnvValueStatus> = {};
  for (const name of names) {
    statuses[name] = envStatus(name);
  }
  return statuses;
}

function parseSmtpPort(value: string | undefined): number {
  if (!value) return DEFAULT_SMTP_PORT;
  const port = Number.parseInt(value, 10);
  return Number.isNaN(port) ? DEFAULT_SMTP_PORT : port;
}

export function getSmtpConfigFromEnv(): SmtpDeliveryConfig | null {
  const host = readEnv("SMTP_HOST");
  const user = readEnv("SMTP_USER");
  const pass = readEnv("SMTP_PASS");

  if (!host || !user || !pass) return null;

  return {
    host,
    port: parseSmtpPort(readEnv("SMTP_PORT")),
    secure: readEnv("SMTP_SECURE") === "true",
    auth: { user, pass },
    fromAddress: readEnv("EMAIL_FROM") ?? user,
    fromDisplayName: readEnv("EMAIL_FROM_NAME") ?? DEFAULT_EMAIL_FROM_NAME,
  };
}

export function isSmtpConfiguredFromEnv(): boolean {
  return getSmtpConfigFromEnv() !== null;
}

export function getCysmoConfigFromEnv(): CysmoConfig | null {
  const apiBaseUrl = readEnv("CYSMO_API_BASE_URL");
  const clientId = readEnv("CYSMO_CLIENT_ID");
  const clientSecret = readEnv("CYSMO_CLIENT_SECRET");

  if (!apiBaseUrl || !clientId || !clientSecret) return null;

  return { apiBaseUrl, clientId, clientSecret };
}

export function isFixtureConnectionMode(): boolean {
  return readEnv("TEST_CONNECTION_FIXTURE") === "true" || getCysmoConfigFromEnv() === null;
}

export function getPgpPublicKeyFromEnv(): string | null {
  return readEnv("PGP_PUBLIC_KEY") ?? null;
}

export function getPgpPrivateConfigFromEnv(): PgpPrivateConfig | null {
  const privateKeyArmored = readEnv("PGP_PRIVATE_KEY");
  const passphrase = readEnv("PGP_PASSPHRASE");

  if (!privateKeyArmored || !passphrase) return null;

  return { privateKeyArmored, passphrase };
}

export function getPublicBaseUrl(): string {
  return readEnv("NEXT_PUBLIC_BASE_URL") ?? DEFAULT_PUBLIC_BASE_URL;
}

export function isSecureCookieEnvironment(): boolean {
  return readEnv("NODE_ENV") === "production" && getPublicBaseUrl().startsWith("https");
}

export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("JWT_SECRET is not configured.");
  return secret;
}
