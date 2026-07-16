// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { CheckDomainResponse } from '@/server/domain-check-types';
import type { SessionUser } from '@/lib/session';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<SessionUser | null>>(),
  checkDomain: vi.fn<() => Promise<CheckDomainResponse>>(),
}));

vi.mock('@/db', () => ({
  db: {},
  domainCheckCategories: {},
  domainCheckProviders: {},
}));

vi.mock('@/lib/session', () => ({
  getSession: mocks.getSession,
}));

vi.mock('@/server/domain-check', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/domain-check')>();
  return {
    ...actual,
    checkDomain: mocks.checkDomain,
  };
});

import { POST } from './route';

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/domain-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/domain-check', () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.checkDomain.mockReset();
    mocks.getSession.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      username: null,
      role: 'USER',
    });
    mocks.checkDomain.mockResolvedValue({
      checkId: 'check-1',
      url: 'youtube.com',
      status: 'completed',
      remainingChecks: 9,
      maxChecks: 10,
      providerCount: 1,
      results: {},
      structuredResults: {
        resultsPWLeaks: 0,
        resultsEmailLeaks: 0,
        resultsEoLSoftware: 0,
        resultsOpenPorts: 0,
        resultsSPFRecord: false,
        hasSPFRecordResult: false,
        hasDarknetResults: false,
        hasSoftwareResults: false,
        hasOpenPortsResults: false,
      },
    });
  });

  it('runs the domain check when the scanner receives a schemeless domain', async () => {
    const response = await POST(buildRequest({
      url: 'youtube.com',
      providerId: 'provider-1',
      categoryId: 'category-1',
      hasAcceptedDisclaimer: true,
      disclaimerVersion: '1.0',
    }));

    expect(response.status).toBe(200);
    expect(mocks.checkDomain).toHaveBeenCalledWith('youtube.com', {
      userId: 'user-1',
      providerId: 'provider-1',
      categoryId: 'category-1',
      hasAcceptedDisclaimer: true,
      disclaimerVersion: '1.0',
    });
  });
});
