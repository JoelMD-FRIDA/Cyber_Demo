import { dbPool } from "@/db";
import { getPendingEmails, updateEmailStatus } from "./email-queue";
import { sendEmail } from "./email";

const MAX_RETRIES = 3;
const BATCH_LIMIT = 50;

export interface ProcessResult {
  processed: number;
  failed: number;
  errors: Array<{ to: string; subject: string; error: string }>;
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
      await sendEmail(email.to, email.subject, email.body);
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
        await dbPool.query(
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
