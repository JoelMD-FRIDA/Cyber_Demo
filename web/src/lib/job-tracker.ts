import { db, backgroundJobEntries, scheduledEventEntries } from "@/db";
import { eq, desc } from "drizzle-orm";

export type BackgroundJobRecord = {
  id: string;
  jobId: string | null;
  startTime: Date | null;
  endTime: Date | null;
  result: string | null;
  successful: boolean;
  createdAt: Date;
};

/**
 * Start tracking a background job. Inserts a row into background_job_entries
 * with the current timestamp and returns the created record.
 */
export async function startJob(
  name: string,
  description?: string,
): Promise<BackgroundJobRecord> {
  const [record] = await db
    .insert(backgroundJobEntries)
    .values({
      jobId: name,
      startTime: new Date(),
      // We store description in result until endTime is set
      result: description ?? null,
    })
    .returning();

  return record as BackgroundJobRecord;
}

/**
 * Mark a job as completed successfully.
 */
export async function completeJob(
  jobId: string,
  result?: string,
): Promise<void> {
  await db
    .update(backgroundJobEntries)
    .set({
      endTime: new Date(),
      successful: true,
      result: result ?? null,
    })
    .where(eq(backgroundJobEntries.id, jobId));
}

/**
 * Mark a job as failed with an error message.
 */
export async function failJob(
  jobId: string,
  errorMessage: string,
): Promise<void> {
  await db
    .update(backgroundJobEntries)
    .set({
      endTime: new Date(),
      successful: false,
      result: errorMessage,
    })
    .where(eq(backgroundJobEntries.id, jobId));
}

/**
 * Get the most recent background job entries, ordered by createdAt descending.
 */
export async function getRecentJobs(
  limit = 50,
): Promise<BackgroundJobRecord[]> {
  const records = await db
    .select()
    .from(backgroundJobEntries)
    .orderBy(desc(backgroundJobEntries.createdAt))
    .limit(limit);

  return records as BackgroundJobRecord[];
}

export type ScheduledEventRecord = {
  id: string;
  name: string;
  description: string | null;
  startTime: Date | null;
  endTime: Date | null;
  status: number;
  createdAt: Date;
};

/**
 * Log an entry to the scheduled_event_entries table.
 * Status: 0 = idle, 1 = running, 2 = completed, 3 = failed
 */
export async function logScheduledEvent(
  name: string,
  description: string | null,
  status: number,
): Promise<ScheduledEventRecord> {
  const [record] = await db
    .insert(scheduledEventEntries)
    .values({
      name,
      description,
      startTime: new Date(),
      status,
    })
    .returning();

  return record as ScheduledEventRecord;
}
