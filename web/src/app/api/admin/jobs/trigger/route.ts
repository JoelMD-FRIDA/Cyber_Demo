import { NextRequest, NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/email-processor";
import { startJob, completeJob, failJob } from "@/lib/job-tracker";
import { getSession } from "@/lib/session";
import { Role } from "@/lib/rbac";

async function requireAdmin(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.role !== Role.ADMIN) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const job = await startJob("process-emails", "Manual trigger from admin UI");

  try {
    const result = await processEmailQueue();
    await completeJob(job.id, JSON.stringify(result));
    return NextResponse.json({ job: { ...job, successful: true, result } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failJob(job.id, message);
    return NextResponse.json(
      { error: message, job: { ...job, successful: false, result: message } },
      { status: 500 },
    );
  }
}
