import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { apiErrorResponse } from '@/lib/api-errors';

async function countTable(client: Awaited<ReturnType<typeof requireAdmin>>['admin'], table: 'profiles' | 'domain_check_providers' | 'domain_check_categories' | 'domain_checks') {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countChecks(client: Awaited<ReturnType<typeof requireAdmin>>['admin'], status: 'queued' | 'running' | 'completed' | 'failed') {
  const { count, error } = await client.from('domain_checks').select('id', { count: 'exact', head: true }).eq('status', status);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    const [totalUsers, totalProviders, totalCategories, totalChecks, queuedChecks, runningChecks, completedChecks, failedChecks] = await Promise.all([
      countTable(admin, 'profiles'),
      countTable(admin, 'domain_check_providers'),
      countTable(admin, 'domain_check_categories'),
      countTable(admin, 'domain_checks'),
      countChecks(admin, 'queued'),
      countChecks(admin, 'running'),
      countChecks(admin, 'completed'),
      countChecks(admin, 'failed'),
    ]);
    return NextResponse.json({ stats: { totalUsers, totalProviders, totalCategories, totalChecks, queuedChecks, runningChecks, completedChecks, failedChecks } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
