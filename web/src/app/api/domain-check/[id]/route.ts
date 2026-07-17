import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db, domainCheckCategories, domainCheckProviders, domainCheckResults, domainChecks } from '@/db';
import { getSession } from '@/lib/session';
import type { StructuredDomainCheckResult } from '@/server/domain-check-types';

export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: Promise<{ id: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStructuredResults(row: {
  resultsPWLeaks: number | null;
  resultsEmailLeaks: number | null;
  resultsEoLSoftware: number | null;
  resultsOpenPorts: number | null;
  resultsSPFRecord: boolean | null;
  hasSPFRecordResult: boolean | null;
  hasDarknetResults: boolean | null;
  hasSoftwareResults: boolean | null;
  hasOpenPortsResults: boolean | null;
}): StructuredDomainCheckResult {
  return {
    resultsPWLeaks: row.resultsPWLeaks ?? 0,
    resultsEmailLeaks: row.resultsEmailLeaks ?? 0,
    resultsEoLSoftware: row.resultsEoLSoftware ?? 0,
    resultsOpenPorts: row.resultsOpenPorts ?? 0,
    resultsSPFRecord: row.resultsSPFRecord ?? false,
    hasSPFRecordResult: row.hasSPFRecordResult ?? false,
    hasDarknetResults: row.hasDarknetResults ?? false,
    hasSoftwareResults: row.hasSoftwareResults ?? false,
    hasOpenPortsResults: row.hasOpenPortsResults ?? false,
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Domain check not found' }, { status: 404 });
    }

    const [row] = await db
      .select({
        id: domainChecks.id,
        url: domainChecks.url,
        status: domainChecks.status,
        results: domainChecks.results,
        providerCount: domainChecks.providerCount,
        remainingChecks: domainChecks.remainingDomainChecks,
        maxChecks: domainChecks.maxChecks,
        createdAt: domainChecks.createdAt,
        providerName: domainCheckProviders.name,
        categoryName: domainCheckCategories.name,
        resultsPWLeaks: domainCheckResults.resultsPWLeaks,
        resultsEmailLeaks: domainCheckResults.resultsEmailLeaks,
        resultsEoLSoftware: domainCheckResults.resultsEoLSoftware,
        resultsOpenPorts: domainCheckResults.resultsOpenPorts,
        resultsSPFRecord: domainCheckResults.resultsSPFRecord,
        hasSPFRecordResult: domainCheckResults.hasSPFRecordResult,
        hasDarknetResults: domainCheckResults.hasDarknetResults,
        hasSoftwareResults: domainCheckResults.hasSoftwareResults,
        hasOpenPortsResults: domainCheckResults.hasOpenPortsResults,
      })
      .from(domainChecks)
      .innerJoin(domainCheckProviders, eq(domainChecks.providerId, domainCheckProviders.id))
      .innerJoin(domainCheckCategories, eq(domainChecks.categoryId, domainCheckCategories.id))
      .leftJoin(domainCheckResults, eq(domainCheckResults.domainCheckId, domainChecks.id))
      .where(and(eq(domainChecks.id, id), eq(domainChecks.userId, session.id)))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: 'Domain check not found' }, { status: 404 });
    }

    return NextResponse.json({
      check: {
        id: row.id,
        url: row.url,
        status: row.status ?? 'completed',
        providerName: row.providerName,
        categoryName: row.categoryName,
        createdAt: row.createdAt.toISOString(),
        remainingChecks: row.remainingChecks ?? 0,
        maxChecks: row.maxChecks ?? 0,
        providerCount: row.providerCount ?? 0,
        results: isRecord(row.results) ? row.results : {},
        structuredResults: normalizeStructuredResults(row),
      },
    });
  } catch (error) {
    console.error('Domain check detail error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
