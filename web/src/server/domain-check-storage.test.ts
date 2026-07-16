// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => {
  const domainCheckRows: Array<Record<string, unknown>> = [];
  const resultRows: Array<Record<string, unknown>> = [];

  return {
    domainCheckRows,
    resultRows,
    reset: () => {
      domainCheckRows.length = 0;
      resultRows.length = 0;
    },
  };
});

vi.mock('@/db', () => {
  const domainChecks = { kind: 'domainChecks' };
  const domainCheckResults = { kind: 'domainCheckResults' };
  return {
    db: {
      insert: (table: { readonly kind: string }) => ({
        values: (value: Record<string, unknown>) => {
          if (table.kind === 'domainChecks') {
            const row = { ...value, id: 'check-1' };
            testState.domainCheckRows.push(row);
            return { returning: () => [{ id: 'check-1' }] };
          }
          testState.resultRows.push(value);
          return Promise.resolve();
        },
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    },
    domainChecks,
    domainCheckResults,
    users: {},
  };
});

import { storeCheckResults } from './domain-check-storage';
import type { StructuredDomainCheckResult } from './domain-check-types';

describe('storeCheckResults', () => {
  beforeEach(() => {
    testState.reset();
  });

  it('stores the rich Cysmo response on the domain check row for later fetches', async () => {
    const structured: StructuredDomainCheckResult = {
      resultsPWLeaks: 0,
      resultsEmailLeaks: 0,
      resultsEoLSoftware: 0,
      resultsOpenPorts: 1,
      resultsSPFRecord: false,
      hasSPFRecordResult: false,
      hasDarknetResults: false,
      hasSoftwareResults: false,
      hasOpenPortsResults: true,
    };
    const richResult = {
      domain: 'youtube.com',
      status: 'partial',
      report: { id: 'report-1', state: 'IN_PROGRESS' },
    };

    const checkId = await storeCheckResults('user-1', 'provider-1', 'category-1', 'youtube.com', structured, {
      results: richResult,
    });

    expect(checkId).toBe('check-1');
    expect(testState.domainCheckRows[0]).toMatchObject({
      url: 'youtube.com',
      results: richResult,
    });
    expect(testState.resultRows[0]).toMatchObject(structured);
  });
});
