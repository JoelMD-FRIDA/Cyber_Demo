import nodemailer from "nodemailer";
import type { Transporter, SendMailOptions, SentMessageInfo } from "nodemailer";
import Handlebars from "handlebars";
import { db } from "@/db";
import { emailTemplates, emailTemplateLanguages, systemLanguages } from "@/db";
import { eq, and } from "drizzle-orm";
import { renderTemplate } from "./template";
import { getSmtpConfigFromEnv, type SmtpDeliveryConfig } from "./runtime-env";

export type SmtpConfig = SmtpDeliveryConfig;

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
    const config = getSmtpConfigFromEnv();
    if (!config) throw new Error("SMTP is not configured in Vercel environment variables.");
    transporter = createTransporter(config);
  }
  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<SentMessageInfo> {
  const smtpConfig = getSmtpConfigFromEnv();
  if (!smtpConfig) throw new Error("SMTP is not configured in Vercel environment variables.");

  const mailOptions: SendMailOptions = {
    from: `"${smtpConfig.fromDisplayName}" <${smtpConfig.fromAddress}>`,
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

export function getSmtpConfig(): SmtpConfig | null {
  return getSmtpConfigFromEnv();
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

  const smtpConfig = getSmtpConfig();

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
