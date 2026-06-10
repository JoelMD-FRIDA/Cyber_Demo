import { NextRequest, NextResponse } from 'next/server';
import { checkDomain, isValidUrl, DisclaimerError, CheckLimitError } from '@/server/domain-check';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const {
      url,
      providerId,
      categoryId,
      hasAcceptedDisclaimer,
      disclaimerVersion,
    } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 },
      );
    }

    if (!isValidUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid URL. Must be a valid http or https URL.' },
        { status: 400 },
      );
    }

    const response = await checkDomain(url, {
      userId: session.id,
      providerId: providerId || undefined,
      categoryId: categoryId || undefined,
      hasAcceptedDisclaimer: hasAcceptedDisclaimer === true,
      disclaimerVersion: disclaimerVersion || undefined,
    });

    return NextResponse.json({
      id: response.checkId,
      url: response.url,
      status: response.status,
      remainingChecks: response.remainingChecks,
      maxChecks: response.maxChecks,
      providerCount: response.providerCount,
      results: response.results,
      structuredResults: response.structuredResults,
    });
  } catch (error) {
    if (error instanceof DisclaimerError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    if (error instanceof CheckLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          maxChecks: error.maxChecks,
          remainingChecks: error.remainingChecks,
          code: 'CHECK_LIMIT_EXCEEDED',
        },
        { status: 429 },
      );
    }

    console.error('Domain check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
