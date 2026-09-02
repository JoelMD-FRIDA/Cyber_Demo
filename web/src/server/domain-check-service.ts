import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/guards';
import { ApiError } from '@/lib/api-errors';
import { CURRENT_DISCLAIMER_VERSION, getCronBatchSize, getCronLeaseSeconds, getDomainCheckLimit, getDomainCheckPollIntervalMs } from '@/lib/domain-check/config';
import { getProviderAdapter, isProviderConfigured } from './domain-check-cysmo';
import { isValidPantaContact, normalizePantaContact } from './domain-check-panta';
import { DomainCheckProviderError } from './domain-check-provider';
import { isValidUrl, normalizeDomainName } from './domain-check-url';
import type { StructuredDomainCheckResult } from './domain-check-types';
import type { Database, Json } from '@/lib/supabase/types';

type DomainCheckRow = Database['public']['Tables']['domain_checks']['Row'];

const DEFAULT_STRUCTURED_RESULT: StructuredDomainCheckResult = {
  resultsPWLeaks: 0,
  resultsEmailLeaks: 0,
  resultsEoLSoftware: 0,
  resultsOpenPorts: 0,
  resultsSPFRecord: false,
  hasSPFRecordResult: false,
  hasDarknetResults: false,
  hasSoftwareResults: false,
  hasOpenPortsResults: false,
};

export async function getDomainCheckOptions() {
  const context = await requireUser();
  const [{ data: providers, error: providersError }, { data: categories, error: categoriesError }] = await Promise.all([
    context.supabase
      .from('domain_check_providers')
      .select('*')
      .eq('is_active', true)
      .order('name'),
    context.supabase
      .from('domain_check_categories')
      .select('*')
      .order('name'),
  ]);

  if (providersError || categoriesError) throw new ApiError('INTERNAL_ERROR', 'Unable to load check options.', 500);

  return {
    providers: (providers ?? []).map((provider) => ({
      id: provider.id,
      key: provider.provider_key,
      name: provider.name,
      isActive: provider.is_active,
      isConfigured: isProviderConfigured(provider.provider_key),
      inputType: getProviderAdapter(provider.provider_key)?.inputType ?? 'domain',
      websiteUrl: provider.website_url,
      description: provider.description,
      assetPath: provider.asset_path,
    })),
    categories: (categories ?? []).map((category) => ({
      id: category.id,
      key: category.category_key,
      name: category.name,
      description: category.description,
      assetPath: category.asset_path,
    })),
    remainingChecks: Math.max(getDomainCheckLimit() - context.profile.performed_domain_checks, 0),
    maxChecks: getDomainCheckLimit(),
    disclaimerVersion: CURRENT_DISCLAIMER_VERSION,
  };
}

export async function createQueuedDomainCheck(input: {
  url: string;
  providerId?: string;
  categoryId?: string;
  hasAcceptedDisclaimer: boolean;
  disclaimerVersion?: string;
}) {
  const context = await requireUser();
  if (!input.hasAcceptedDisclaimer || input.disclaimerVersion !== CURRENT_DISCLAIMER_VERSION) {
    throw new ApiError('INVALID_INPUT', 'The current disclaimer must be accepted.', 400);
  }

  const { data: providers, error: providersError } = await context.supabase
    .from('domain_check_providers')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (providersError) throw new ApiError('INTERNAL_ERROR', 'Unable to load providers.', 500);

  const provider = (providers ?? []).find((candidate) => candidate.id === input.providerId) ?? providers?.[0];
  if (!provider) throw new ApiError('NOT_FOUND', 'No active provider is available.', 404);
  if (!isProviderConfigured(provider.provider_key)) {
    throw new ApiError('PROVIDER_NOT_CONFIGURED', 'The selected provider is not configured.', 503);
  }
  const adapter = getProviderAdapter(provider.provider_key);
  if (!adapter) throw new ApiError('PROVIDER_NOT_CONFIGURED', 'The selected provider is not configured.', 503);
  if (adapter.inputType === 'contact' && !isValidPantaContact(input.url)) {
    throw new ApiError('INVALID_INPUT', 'A valid email address or international telephone number is required.', 400);
  }
  if (adapter.inputType === 'domain' && !isValidUrl(input.url)) {
    throw new ApiError('INVALID_INPUT', 'A valid HTTP or HTTPS URL is required.', 400);
  }
  const normalizedInput = adapter.inputType === 'contact' ? normalizePantaContact(input.url) : normalizeDomainName(input.url);

  const { data: categories, error: categoriesError } = await context.supabase
    .from('domain_check_categories')
    .select('*')
    .order('name');
  if (categoriesError) throw new ApiError('INTERNAL_ERROR', 'Unable to load categories.', 500);
  const category = (categories ?? []).find((candidate) => candidate.id === input.categoryId) ?? categories?.[0];
  if (!category) throw new ApiError('NOT_FOUND', 'No category is available.', 404);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('create_queued_domain_check', {
    p_user_id: context.user.id,
    p_provider_id: provider.id,
    p_category_id: category.id,
    p_url: normalizedInput,
    p_has_accepted_disclaimer: true,
    p_disclaimer_version: CURRENT_DISCLAIMER_VERSION,
    p_limit: getDomainCheckLimit(),
  });

  if (error) {
    const code = error.message.trim();
    if (code === 'CHECK_LIMIT_EXCEEDED') {
      throw new ApiError('RATE_LIMIT_EXCEEDED', 'The domain-check limit has been reached.', 429, {
        remainingChecks: 0,
        maxChecks: getDomainCheckLimit(),
      });
    }
    if (code === 'PROVIDER_NOT_FOUND' || code === 'CATEGORY_NOT_FOUND') {
      throw new ApiError('NOT_FOUND', 'The selected check configuration is no longer available.', 404);
    }
    throw new ApiError('INTERNAL_ERROR', 'Unable to queue the domain check.', 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new ApiError('INTERNAL_ERROR', 'The domain check was not created.', 500);
  return { ...toPublicCheck(row as DomainCheckRow), status: 'queued' as const };
}

export async function getDomainCheck(id: string) {
  const context = await requireUser();
  const { data: row, error } = await context.supabase
    .from('domain_checks')
    .select('*')
    .eq('id', id)
    .eq('user_id', context.user.id)
    .maybeSingle();

  if (error) throw new ApiError('INTERNAL_ERROR', 'Unable to load the domain check.', 500);
  if (!row) throw new ApiError('CHECK_NOT_FOUND', 'Domain check not found.', 404);

  const [{ data: provider }, { data: category }] = await Promise.all([
    context.supabase.from('domain_check_providers').select('*').eq('id', row.provider_id).maybeSingle(),
    context.supabase.from('domain_check_categories').select('*').eq('id', row.category_id).maybeSingle(),
  ]);

  return {
    ...toPublicCheck(row),
    provider: provider ? { id: provider.id, key: provider.provider_key, name: provider.name, inputType: getProviderAdapter(provider.provider_key)?.inputType ?? 'domain' } : null,
    category: category ? { id: category.id, key: category.category_key, name: category.name } : null,
  };
}

/**
 * Process one check when its results page is being actively viewed. This keeps
 * the persisted queue useful on deployments without a paid scheduler while
 * retaining the same lease and state-transition rules as the batch worker.
 */
export async function processDomainCheckOnDemand(id: string): Promise<void> {
  const context = await requireUser();
  const { data: ownedCheck, error: ownershipError } = await context.supabase
    .from('domain_checks')
    .select('id')
    .eq('id', id)
    .eq('user_id', context.user.id)
    .maybeSingle();

  if (ownershipError) throw new ApiError('INTERNAL_ERROR', 'Unable to load the domain check.', 500);
  if (!ownedCheck) throw new ApiError('CHECK_NOT_FOUND', 'Domain check not found.', 404);

  const admin = createSupabaseAdminClient();
  const { data: claimed, error: claimError } = await admin.rpc('claim_domain_check', {
    p_check_id: id,
    p_lease_seconds: getCronLeaseSeconds(),
  });
  if (claimError) throw new Error(`Unable to claim domain check: ${claimError.message}`);

  const row = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!row) return;

  try {
    await processClaimedCheck(admin, row as DomainCheckRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markCheckFailed(admin, row as DomainCheckRow, 'WORKER_FAILED', message);
  }
}

export async function processDomainCheckQueue(): Promise<{ processed: number; pending: number; failed: number; errors: string[] }> {
  const admin = createSupabaseAdminClient();
  const { data: claimed, error } = await admin.rpc('claim_domain_checks', {
    p_limit: getCronBatchSize(),
    p_lease_seconds: getCronLeaseSeconds(),
  });
  if (error) throw new Error(`Unable to claim domain checks: ${error.message}`);

  const result = { processed: 0, pending: 0, failed: 0, errors: [] as string[] };
  for (const row of claimed ?? []) {
    try {
      const outcome = await processClaimedCheck(admin, row as DomainCheckRow);
      if (outcome === 'completed' || outcome === 'partial') result.processed++;
      else if (outcome === 'pending') result.pending++;
      else result.failed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed++;
      result.errors.push(message);
      await markCheckFailed(admin, row as DomainCheckRow, 'WORKER_FAILED', message);
    }
  }
  return result;
}

async function processClaimedCheck(admin: ReturnType<typeof createSupabaseAdminClient>, row: DomainCheckRow): Promise<'completed' | 'partial' | 'pending' | 'failed'> {
  const { data: provider, error: providerError } = await admin
    .from('domain_check_providers')
    .select('*')
    .eq('id', row.provider_id)
    .maybeSingle();
  if (providerError || !provider) return markCheckFailed(admin, row, 'PROVIDER_NOT_FOUND', 'The configured provider no longer exists.');

  const adapter = getProviderAdapter(provider.provider_key);
  if (!adapter || !adapter.isConfigured) return markCheckFailed(admin, row, 'PROVIDER_NOT_CONFIGURED', 'The selected provider is not configured.');

  if (isExpired(row)) {
    const snapshot = asRecord(row.raw_result) ?? {};
    const normalized = adapter.normalize(snapshot);
    await updateCheck(admin, row.id, {
      status: 'partial',
      raw_result: normalized.richResult as Json,
      structured_result: normalized.structuredResult as unknown as Json,
      last_error_code: 'CHECK_TIMEOUT',
      last_error_message: 'The provider did not finish within the allowed time.',
      lease_until: null,
      completed_at: new Date().toISOString(),
    });
    return 'partial';
  }

  if (!row.external_job_id) {
    let started: Awaited<ReturnType<typeof adapter.start>>;
    try {
      started = await adapter.start({ url: row.url, providerKey: provider.provider_key });
    } catch (error) {
      return handleProviderError(admin, row, error, 'PROVIDER_START_FAILED');
    }

    if (started.completed) {
      const normalized = adapter.normalize(started.snapshot);
      await updateCheck(admin, row.id, {
        external_job_id: started.externalJobId,
        external_report_id: started.externalReportId ?? null,
        status: 'completed',
        raw_result: normalized.richResult as Json,
        structured_result: normalized.structuredResult as unknown as Json,
        last_error_code: null,
        last_error_message: null,
        lease_until: null,
        completed_at: new Date().toISOString(),
      });
      return 'completed';
    }

    await updateCheck(admin, row.id, {
      external_job_id: started.externalJobId,
      external_report_id: started.externalReportId ?? null,
      raw_result: started.snapshot as Json,
      status: 'queued',
      next_poll_at: new Date(Date.now() + getDomainCheckPollIntervalMs()).toISOString(),
      lease_until: null,
    });
    return 'pending';
  }

  let polled: Awaited<ReturnType<typeof adapter.poll>>;
  try {
    polled = await adapter.poll({
      url: row.url,
      providerKey: provider.provider_key,
      externalJobId: row.external_job_id,
      externalReportId: row.external_report_id,
    });
  } catch (error) {
    return handleProviderError(admin, row, error, 'PROVIDER_POLL_FAILED');
  }

  if (polled.status === 'pending') {
    await updateCheck(admin, row.id, {
      status: 'queued',
      raw_result: polled.snapshot as Json,
      external_report_id: polled.externalReportId ?? row.external_report_id,
      next_poll_at: new Date(Date.now() + getDomainCheckPollIntervalMs()).toISOString(),
      lease_until: null,
    });
    return 'pending';
  }

  if (polled.status === 'failed') {
    return scheduleRetryOrFail(admin, row, polled.errorCode, polled.errorMessage, polled.snapshot);
  }

  const normalized = adapter.normalize(polled.snapshot);
  await updateCheck(admin, row.id, {
    status: 'completed',
    raw_result: normalized.richResult as Json,
    structured_result: normalized.structuredResult as unknown as Json,
    external_report_id: polled.externalReportId ?? row.external_report_id,
    last_error_code: null,
    last_error_message: null,
    lease_until: null,
    completed_at: new Date().toISOString(),
  });
  return 'completed';
}

async function handleProviderError(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  row: DomainCheckRow,
  error: unknown,
  fallbackCode: string,
): Promise<'pending' | 'failed'> {
  const providerError = error instanceof DomainCheckProviderError ? error : null;
  const code = providerError?.code ?? fallbackCode;
  const message = providerError?.message ?? (error instanceof Error ? error.message : String(error));
  if (providerError && !providerError.retryable) return markCheckFailed(admin, row, code, message);
  return scheduleRetryOrFail(admin, row, code, message);
}

async function scheduleRetryOrFail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  row: DomainCheckRow,
  code: string,
  message: string,
  snapshot?: Record<string, unknown>,
): Promise<'pending' | 'failed'> {
  if (row.attempt_count >= 8) return markCheckFailed(admin, row, code, message, snapshot);
  await updateCheck(admin, row.id, {
    status: 'queued',
    raw_result: (snapshot ?? row.raw_result) as Json | null,
    next_poll_at: new Date(Date.now() + Math.min(Math.max(row.attempt_count, 1) * getDomainCheckPollIntervalMs(), 60_000)).toISOString(),
    lease_until: null,
    last_error_code: code,
    last_error_message: message,
  });
  return 'pending';
}

function isExpired(row: DomainCheckRow): boolean {
  return Date.now() - new Date(row.created_at).getTime() > 5 * 60 * 1000;
}

async function markCheckFailed(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  row: DomainCheckRow,
  code: string,
  message: string,
  snapshot?: Record<string, unknown>,
): Promise<'failed'> {
  await updateCheck(admin, row.id, {
    status: 'failed',
    raw_result: (snapshot ?? row.raw_result) as Json | null,
    last_error_code: code,
    last_error_message: message,
    lease_until: null,
    completed_at: new Date().toISOString(),
  });
  return 'failed';
}

async function updateCheck(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  id: string,
  values: Database['public']['Tables']['domain_checks']['Update'],
) {
  const { error } = await admin.from('domain_checks').update(values).eq('id', id);
  if (error) throw new Error(error.message);
}

function toPublicCheck(row: DomainCheckRow) {
  return {
    id: row.id,
    url: row.url,
    status: row.status,
    rawResult: row.raw_result,
    structuredResult: row.structured_result ?? DEFAULT_STRUCTURED_RESULT,
    errorCode: row.last_error_code,
    errorMessage: row.last_error_message,
    externalJobId: row.external_job_id,
    attemptCount: row.attempt_count,
    remainingChecks: row.remaining_domain_checks,
    maxChecks: row.max_checks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function asRecord(value: Json | null): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
