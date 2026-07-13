import { db, domainChecks, domainCheckResults, users } from '@/db';
import { eq, sql } from 'drizzle-orm';
import type { StructuredDomainCheckResult } from './domain-check-types';

export interface StoreCheckOptions {
  hasAcceptedDisclaimer?: boolean;
  disclaimerVersion?: string;
  providerCount?: number;
  remainingChecks?: number;
  maxChecks?: number;
  status?: string;
}

export async function storeCheckResults(
  userId: string,
  providerId: string,
  categoryId: string,
  url: string,
  structured: StructuredDomainCheckResult,
  options: StoreCheckOptions = {},
): Promise<string> {
  const [check] = await db
    .insert(domainChecks)
    .values({
      userId,
      providerId,
      categoryId,
      url,
      status: options.status ?? 'completed',
      hasAcceptedDisclaimer: options.hasAcceptedDisclaimer ?? false,
      disclaimerAcceptedAt: options.hasAcceptedDisclaimer ? new Date() : null,
      disclaimerVersion: options.disclaimerVersion ?? null,
      providerCount: options.providerCount ?? 1,
      remainingDomainChecks: options.remainingChecks ?? 0,
      maxChecks: options.maxChecks ?? 0,
    })
    .returning({ id: domainChecks.id });

  if (!check) throw new Error('Failed to create domain check record');

  await db
    .insert(domainCheckResults)
    .values({
      domainCheckId: check.id,
      categoryId,
      ...structured,
    });

  await db
    .update(users)
    .set({ performedDomainChecks: sql`${users.performedDomainChecks} + 1` })
    .where(eq(users.id, userId));

  return check.id;
}

export async function storePartialResults(
  userId: string,
  providerId: string,
  categoryId: string,
  url: string,
  structured: Partial<StructuredDomainCheckResult>,
  errorMessage: string,
  options: Omit<StoreCheckOptions, 'status'> = {},
): Promise<string> {
  const fullStructured: StructuredDomainCheckResult = {
    resultsPWLeaks: structured.resultsPWLeaks ?? 0,
    resultsEmailLeaks: structured.resultsEmailLeaks ?? 0,
    resultsEoLSoftware: structured.resultsEoLSoftware ?? 0,
    resultsOpenPorts: structured.resultsOpenPorts ?? 0,
    resultsSPFRecord: structured.resultsSPFRecord ?? false,
    hasSPFRecordResult: structured.hasSPFRecordResult ?? false,
    hasDarknetResults: structured.hasDarknetResults ?? false,
    hasSoftwareResults: structured.hasSoftwareResults ?? false,
    hasOpenPortsResults: structured.hasOpenPortsResults ?? false,
  };

  return storeCheckResults(userId, providerId, categoryId, url, fullStructured, {
    ...options,
    status: `partial_error: ${errorMessage}`,
  });
}
