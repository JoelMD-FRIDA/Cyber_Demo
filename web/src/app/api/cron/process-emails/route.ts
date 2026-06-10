import { NextRequest, NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/email-processor";
import { startJob, completeJob, failJob } from "@/lib/job-tracker";
import { getSession } from "@/lib/session";
import { Role } from "@/lib/rbac";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Auth: require x-api-key matching CRON_SECRET, or a valid admin session
  const apiKey = request.headers.get("x-api-key");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || apiKey !== cronSecret) {
    const session = await getSession(request);
    if (!session || session.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
  }

  // Record job start
  const job = await startJob("process-emails", "Process email queue via cron trigger");

  try {
    const result = await processEmailQueue();
    await completeJob(job.id, JSON.stringify(result));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failJob(job.id, message);
    return NextResponse.json(
      { processed: 0, failed: 0, errors: [{ to: "", subject: "", error: message }] },
      { status: 500 },
    );
  }
}
