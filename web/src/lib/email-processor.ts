import { Pool } from "pg";
import { getPendingEmails, updateEmailStatus } from "./email-queue";
import { sendEmail, getSmtpConfig } from "./email";
import nodemailer from "nodemailer";

const MAX_RETRIES = 3;
const BATCH_LIMIT = 50;

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

export interface ProcessResult {
  processed: number;
  failed: number;
  errors: Array<{ to: string; subject: string; error: string }>;
}

async function tryDbSend(
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  const smtpConfig = await getSmtpConfig();
  if (smtpConfig) {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.auth,
    });
    const fromStr = smtpConfig.fromDisplayName
      ? `"${smtpConfig.fromDisplayName}" <${smtpConfig.fromAddress}>`
      : smtpConfig.fromAddress;
    await transporter.sendMail({
      from: fromStr,
      to,
      subject,
      html: body,
    });
  } else {
    await sendEmail(to, subject, body);
  }
}

export async function processEmailQueue(): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, failed: 0, errors: [] };

  let pendingEmails;
  try {
    pendingEmails = await getPendingEmails(BATCH_LIMIT);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Email Processor] Failed to fetch pending emails: ${msg}`);
    throw err;
  }

  if (pendingEmails.length === 0) {
    return result;
  }

  for (const email of pendingEmails) {
    try {
      await tryDbSend(email.to, email.subject, email.body);
      await updateEmailStatus(email.id, "sent");
      result.processed++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      console.error(
        `[Email Processor] Failed to send email to="${email.to}" subject="${email.subject}" retry=${email.retry_count}: ${errorMessage}`,
      );

      if (email.retry_count >= MAX_RETRIES - 1) {
        await updateEmailStatus(email.id, "failed", errorMessage);
      } else {
        await getPool().query(
          `UPDATE email_queue SET retry_count = retry_count + 1, error_message = $1 WHERE id = $2`,
          [errorMessage, email.id],
        );
      }

      result.failed++;
      result.errors.push({ to: email.to, subject: email.subject, error: errorMessage });
    }
  }

  return result;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startLocalProcessor(intervalMs = 60_000): void {
  if (intervalHandle) {
    return;
  }

  intervalHandle = setInterval(async () => {
    try {
      await processEmailQueue();
    } catch {
      // error logged upstream
    }
  }, intervalMs);
}

export function stopLocalProcessor(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
