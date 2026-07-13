import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { Role } from "@/lib/rbac";
import { db } from "@/db";
import { ldapConfigurations, incomingEmailConfigs } from "@/db";
import {
  envStatuses,
  getCysmoConfigFromEnv,
  getPgpPrivateConfigFromEnv,
  getPgpPublicKeyFromEnv,
  getSmtpConfigFromEnv,
} from "@/lib/runtime-env";

async function requireAdmin(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (session.role !== Role.ADMIN) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session };
}

export type IntegrationStatus =
  | "configured"
  | "fixture"
  | "missing"
  | "human-gated";

export type IntegrationEntry = {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  envVars: Record<string, "set" | "unset">;
  guidance: string;
  docLinks?: string[];
};

export type IntegrationsStatusResponse = {
  integrations: IntegrationEntry[];
};

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  // ── SMTP ─────────────────────────────────────────────────────────────────
  const smtpVars = envStatuses([
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASS",
    "EMAIL_FROM",
    "EMAIL_FROM_NAME",
  ]);
  const smtpHasAny = Object.values(smtpVars).some((v) => v === "set");
  const smtpStatus: IntegrationStatus =
    getSmtpConfigFromEnv() ? "configured" : smtpHasAny ? "fixture" : "missing";

  // ── Cysmo / OAuth ──────────────────────────────────────────────────────
  const cysmoVars = envStatuses([
    "CYSMO_API_BASE_URL",
    "CYSMO_CLIENT_ID",
    "CYSMO_CLIENT_SECRET",
  ]);
  const cysmoHasAny = Object.values(cysmoVars).some((v) => v === "set");
  const cysmoStatus: IntegrationStatus =
    getCysmoConfigFromEnv() ? "configured" : cysmoHasAny ? "fixture" : "missing";

  // ── PGP Encryption ─────────────────────────────────────────────────────
  const pgpVars = envStatuses([
    "PGP_PUBLIC_KEY",
    "PGP_PRIVATE_KEY",
    "PGP_PASSPHRASE",
  ]);
  const pgpHasAny = Object.values(pgpVars).some((v) => v === "set");
  const pgpStatus: IntegrationStatus =
    getPgpPublicKeyFromEnv() && getPgpPrivateConfigFromEnv()
      ? "configured"
      : pgpHasAny ? "fixture" : "missing";

  // ── LDAP ────────────────────────────────────────────────────────────────
  let ldapConfigured = false;
  try {
    const ldapRows = await db
      .select({ id: ldapConfigurations.id })
      .from(ldapConfigurations)
      .limit(1);
    ldapConfigured = ldapRows.length > 0;
  } catch {
    // DB may not be migrated yet — treat as missing
  }
  const ldapStatus: IntegrationStatus = ldapConfigured
    ? "configured"
    : "human-gated";

  // ── Incoming Email ──────────────────────────────────────────────────────
  let incomingConfigured = false;
  try {
    const incomingRows = await db
      .select()
      .from(incomingEmailConfigs)
      .limit(1);
    incomingConfigured = incomingRows.length > 0;
  } catch {
    // DB may not be migrated yet — treat as missing
  }
  const incomingStatus: IntegrationStatus = incomingConfigured
    ? "configured"
    : "missing";

  const integrations: IntegrationEntry[] = [
    {
      id: "smtp",
      name: "SMTP Email",
      description:
        "Outgoing email for user registration, password reset, and notifications.",
      status: smtpStatus,
      envVars: smtpVars,
      guidance:
        smtpStatus === "configured"
          ? "Required Vercel SMTP variables are set. Email sending is operational."
          : smtpStatus === "fixture"
            ? "Some SMTP variables are set, but SMTP_HOST, SMTP_USER, and SMTP_PASS are required for production."
            : "Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM, and EMAIL_FROM_NAME in Vercel Project Settings → Environment Variables.",
      docLinks: [
        "https://www.nodemailer.com/smtp/",
      ],
    },
    {
      id: "cysmo-oauth",
      name: "Cysmo / OAuth",
      description:
        "Domain-check provider API authentication via OAuth 2.0 client_credentials grant.",
      status: cysmoStatus,
      envVars: cysmoVars,
      guidance:
        cysmoStatus === "configured"
          ? "Cysmo API is ready. OAuth tokens will be retrieved automatically."
          : cysmoStatus === "fixture"
            ? "Partial Cysmo config. Test fixtures will work; real API calls will fail."
            : "Set CYSMO_API_BASE_URL, CYSMO_CLIENT_ID, and CYSMO_CLIENT_SECRET in Vercel Project Settings → Environment Variables.",
      docLinks: [
        "https://oauth.net/2/client-credentials/",
      ],
    },
    {
      id: "pgp",
      name: "PGP Encryption",
      description:
        "Encryption of OAuth tokens at rest and API credential verification.",
      status: pgpStatus,
      envVars: pgpVars,
      guidance:
        pgpStatus === "configured"
          ? "Full PGP key set loaded. Tokens will be encrypted at rest and decrypted on retrieval."
          : pgpStatus === "fixture"
            ? "Partial PGP config. If PUBLIC key is set, encryption works; decryption needs PRIVATE key + PASSPHRASE."
            : "Generate a PGP key pair and set PGP_PUBLIC_KEY, PGP_PRIVATE_KEY, and PGP_PASSPHRASE in Vercel Project Settings → Environment Variables.",
      docLinks: [
        "https://www.openpgp.org/",
      ],
    },
    {
      id: "ldap",
      name: "LDAP Directory",
      description:
        "LDAP-based email account configuration for incoming/outgoing mail routing.",
      status: ldapStatus,
      envVars: {},
      guidance:
        ldapStatus === "configured"
          ? "At least one active LDAP configuration exists in the database."
          : "Configure LDAP via the Email Accounts admin UI. This requires valid SMTP + Incoming Email setup first. No env vars needed — settings are stored in the database.",
      docLinks: [],
    },
    {
      id: "incoming-email",
      name: "Incoming Email",
      description:
        "IMAP/POP3 email retrieval for processing incoming messages.",
      status: incomingStatus,
      envVars: {},
      guidance:
        incomingStatus === "configured"
          ? "At least one incoming email configuration exists in the database."
          : "No incoming email configurations found. Add one via the Email Accounts admin UI. Requires SMTP env vars for sending replies.",
      docLinks: [],
    },
    {
      id: "live-mendix",
      name: "Live Mendix Comparison",
      description:
        "Side-by-side comparison of migrated Next.js features against the running Mendix application.",
      status: "human-gated",
      envVars: {},
      guidance:
        "This is a manual process. To compare a feature against the live Mendix app:\n" +
        "1. Ensure the Mendix app is running and accessible\n" +
        "2. Navigate to the corresponding page in both apps\n" +
        "3. Compare UI elements, data flow, and behavior\n" +
        "4. Document discrepancies in .sisyphus/evidence/\n" +
        "5. No automated credential check is possible — this requires human judgment.",
      docLinks: [],
    },
  ];

  return NextResponse.json({ integrations } satisfies IntegrationsStatusResponse);
}
