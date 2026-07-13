import { db, appSettings, users } from '@/db';
import { eq } from 'drizzle-orm';
import { CheckLimitError, DisclaimerError } from './domain-check-errors';

export function validateDisclaimer(
  hasAcceptedDisclaimer: boolean | undefined | null,
  disclaimerVersion?: string | null,
): void {
  if (!hasAcceptedDisclaimer) {
    throw new DisclaimerError('You must accept the disclaimer before running a domain check.');
  }
  if (!disclaimerVersion) {
    throw new DisclaimerError('Disclaimer version is required.');
  }
}

export async function getMaximumChecks(): Promise<number> {
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, 'maximum_number_of_checks'))
    .limit(1);

  return setting?.maximumNumberOfChecks ?? 10;
}

export async function getRemainingChecks(userId: string): Promise<{ performed: number; remaining: number; maxChecks: number }> {
  const maxChecks = await getMaximumChecks();
  const [user] = await db
    .select({ performedDomainChecks: users.performedDomainChecks })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const performed = user?.performedDomainChecks ?? 0;
  const remaining = Math.max(0, maxChecks - performed);

  return { performed, remaining, maxChecks };
}

export async function enforceCheckLimit(userId: string): Promise<{ remaining: number; maxChecks: number }> {
  const { remaining, maxChecks } = await getRemainingChecks(userId);
  if (remaining <= 0) {
    throw new CheckLimitError(
      `Domain check limit reached (${maxChecks}/${maxChecks}). Please contact support to increase your limit.`,
      maxChecks,
      0,
    );
  }

  return { remaining, maxChecks };
}
