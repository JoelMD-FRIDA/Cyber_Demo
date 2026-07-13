import { dbPool } from "@/db";

export interface QueuedEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: "pending" | "sent" | "failed";
  scheduled_at: Date | null;
  sent_at: Date | null;
  retry_count: number;
  error_message: string | null;
}

export async function enqueueEmail(
  to: string,
  subject: string,
  body: string,
  scheduledAt?: Date,
): Promise<string> {
  const result = await dbPool.query<{ id: string }>(
    `INSERT INTO email_queue ("to", subject, body, status, scheduled_at, retry_count)
     VALUES ($1, $2, $3, 'pending', $4, 0)
     RETURNING id`,
    [to, subject, body, scheduledAt ?? null],
  );
  return result.rows[0].id;
}

export async function getPendingEmails(limit = 50): Promise<QueuedEmail[]> {
  const result = await dbPool.query<QueuedEmail>(
    `SELECT id, "to", subject, body, status, scheduled_at, sent_at, retry_count, error_message
     FROM email_queue
     WHERE status = 'pending'
       AND (scheduled_at IS NULL OR scheduled_at <= NOW())
     ORDER BY scheduled_at ASC NULLS FIRST
     LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function updateEmailStatus(
  id: string,
  status: "pending" | "sent" | "failed",
  errorMessage?: string,
): Promise<void> {
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");

    if (status === "sent") {
      await client.query(
        `UPDATE email_queue SET status = $1, sent_at = NOW() WHERE id = $2`,
        [status, id],
      );
    } else if (status === "failed") {
      await client.query(
        `UPDATE email_queue SET status = $1, retry_count = retry_count + 1, error_message = $2 WHERE id = $3`,
        [status, errorMessage ?? null, id],
      );
    } else {
      await client.query(
        `UPDATE email_queue SET status = $1 WHERE id = $2`,
        [status, id],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
