import nodemailer from "nodemailer";
import type { Transporter, SendMailOptions, SentMessageInfo } from "nodemailer";
import Handlebars from "handlebars";
import { db } from "@/db";
import { emailAccounts, outgoingEmailConfigs, emailTemplates, emailTemplateLanguages, systemLanguages, emailTemplateSmtps } from "@/db";
import { eq, and } from "drizzle-orm";
import { renderTemplate } from "./template";
import { decryptValue } from "./crypto";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

let transporter: Transporter | null = null;

export function createTransporter(config: SmtpConfig): Transporter {
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
  return transporter;
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = createTransporter({
      host: process.env.SMTP_HOST ?? "localhost",
      port: parseInt(process.env.SMTP_PORT ?? "1025", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER ?? "",
        pass: process.env.SMTP_PASS ?? "",
      },
    });
  }
  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<SentMessageInfo> {
  const mailOptions: SendMailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME ?? "Cyber-Vorabcheck"}" <${process.env.EMAIL_FROM ?? "noreply@example.com"}>`,
    to,
    subject,
    html,
    text,
  };

  return getTransporter().sendMail(mailOptions);
}

export async function sendEmailWithTemplate(
  to: string,
  templateName: string,
  variables: Record<string, unknown>,
  subject?: string,
): Promise<SentMessageInfo> {
  const html = renderTemplate(templateName, variables);
  const emailSubject = subject ?? variables.subject as string ?? templateName;
  return sendEmail(to, emailSubject, html);
}

// ── DB-Backed Email Sending ────────────────────────────────────────────────

export interface DbSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  fromAddress: string;
  fromDisplayName: string;
}

export async function getSmtpConfig(): Promise<DbSmtpConfig | null> {
  const result = await db
    .select({
      host: outgoingEmailConfigs.serverHost,
      port: outgoingEmailConfigs.serverPort,
      ssl: outgoingEmailConfigs.ssl,
      tls: outgoingEmailConfigs.tls,
      user: emailAccounts.username,
      pass: emailAccounts.passwordEncrypted,
      fromAddress: emailAccounts.mailAddress,
      fromDisplayName: emailAccounts.fromDisplayName,
    })
    .from(emailAccounts)
    .innerJoin(
      outgoingEmailConfigs,
      eq(outgoingEmailConfigs.emailAccountId, emailAccounts.id),
    )
    .where(eq(emailAccounts.isOutgoingEmailConfigured, true))
    .limit(1);

  if (result.length === 0) {
    // Fall back to environment variables when DB has no SMTP config
    const envHost = process.env.SMTP_HOST;
    const envPort = process.env.SMTP_PORT;
    const envUser = process.env.SMTP_USER;
    const envPass = process.env.SMTP_PASS;
    const envFrom = process.env.SMTP_FROM;
    if (!envHost) return null;
    return {
      host: envHost,
      port: envPort ? Number(envPort) : 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: envUser || '', pass: envPass || '' },
      fromAddress: envFrom || process.env.EMAIL_FROM || envUser || envHost,
      fromDisplayName: process.env.SMTP_FROM_NAME || process.env.EMAIL_FROM_NAME || '',
    };
  }
  const c = result[0];
  return {
    host: c.host,
    port: c.port ?? 587,
    secure: c.ssl || false,
    auth: { user: c.user, pass: decryptValue(c.pass) },
    fromAddress: c.fromAddress,
    fromDisplayName: c.fromDisplayName,
  };
}

export interface DbTemplate {
  subject: string;
  body: string;
  fromAddress: string | null;
  fromDisplayName: string | null;
}

export async function getDbTemplate(
  templateName: string,
  languageCode?: string,
): Promise<DbTemplate | null> {
  const baseQuery = db
    .select({
      subject: emailTemplates.subject,
      body: emailTemplates.body,
      fromAddress: emailTemplates.fromAddress,
      fromDisplayName: emailTemplates.fromDisplayName,
    })
    .from(emailTemplates);

  if (languageCode) {
    const langResult = await baseQuery
      .innerJoin(
        emailTemplateLanguages,
        eq(emailTemplateLanguages.emailTemplateId, emailTemplates.id),
      )
      .innerJoin(
        systemLanguages,
        eq(systemLanguages.id, emailTemplateLanguages.languageId),
      )
      .where(
        and(
          eq(emailTemplates.name, templateName),
          eq(systemLanguages.code, languageCode),
        ),
      )
      .limit(1);

    if (langResult.length > 0) return langResult[0];
  }

  const result = await baseQuery
    .where(eq(emailTemplates.name, templateName))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export interface SendResult {
  sent: boolean;
  queued?: boolean;
  id?: string;
}

export async function sendWithTemplate(
  to: string,
  templateName: string,
  variables: Record<string, unknown>,
  languageCode?: string,
): Promise<SendResult> {
  let html: string;
  let subject: string;
  let fromAddress: string | null = null;
  let fromDisplayName: string | null = null;

  const dbTpl = await getDbTemplate(templateName, languageCode);
  if (dbTpl) {
    const compiledBody = Handlebars.compile(dbTpl.body);
    html = compiledBody(variables);
    subject = Handlebars.compile(dbTpl.subject)(variables as Record<string, unknown>);
    fromAddress = dbTpl.fromAddress;
    fromDisplayName = dbTpl.fromDisplayName;
  } else {
    html = renderTemplate(templateName, variables);
    subject = (variables.subject as string) ?? templateName;
  }

  const smtpConfig = await getSmtpConfig();

  if (smtpConfig) {
    const t = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.auth,
    });

    const fromStr = fromDisplayName || smtpConfig.fromDisplayName
      ? `"${fromDisplayName || smtpConfig.fromDisplayName}" <${fromAddress || smtpConfig.fromAddress}>`
      : fromAddress || smtpConfig.fromAddress;

    await t.sendMail({
      from: fromStr,
      to,
      subject,
      html,
    });

    return { sent: true };
  }

  const { enqueueEmail } = await import("./email-queue");
  const id = await enqueueEmail(to, subject, html);
  return { sent: false, queued: true, id };
}
