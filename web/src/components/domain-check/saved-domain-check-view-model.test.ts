import { describe, expect, it } from 'vitest';
import { buildViewModel, type SavedDomainCheck } from './saved-domain-check-view-model';

describe('buildViewModel', () => {
  it('renders metrics when a persisted Cysmo result has no wizard summary fields', () => {
    const check: SavedDomainCheck = {
      id: 'check-1',
      url: 'youtube.com',
      status: 'partial',
      providerName: 'Cysmo',
      categoryName: 'Security',
      createdAt: '2026-07-17T00:00:00.000Z',
      remainingChecks: 86,
      maxChecks: 100,
      providerCount: 1,
      results: {
        domain: 'youtube.com',
        status: 'partial',
        report: { id: 'report-1', state: 'IN_PROGRESS', running: true },
        spf: { hasResults: false, signals: [] },
        ports: { openPorts: 1, hasResults: true },
        leaks: { passwordLeaks: 0, emailLeaks: 0, hasDarknetResults: false },
      },
      structuredResults: {
        resultsPWLeaks: 0,
        resultsEmailLeaks: 0,
        resultsEoLSoftware: 0,
        resultsOpenPorts: 1,
        resultsSPFRecord: false,
        hasSPFRecordResult: false,
        hasDarknetResults: false,
        hasSoftwareResults: false,
        hasOpenPortsResults: true,
      },
    };

    const viewModel = buildViewModel(check);

    expect(viewModel.summary).toEqual({
      totalChecks: 4,
      passed: 3,
      warnings: 1,
      failed: 0,
    });
    expect(viewModel.portMeasurementCount).toBe(1);
    expect(viewModel.findings).toEqual([]);
  });
});
