import { describe, expect, it } from 'vitest';
import { buildViewModel, type SavedDomainCheck } from './saved-domain-check-view-model';

describe('buildViewModel', () => {
  it('renders metrics when a persisted Cysmo result has no wizard summary fields', () => {
    const check: SavedDomainCheck = {
      id: 'check-1',
      url: 'youtube.com',
      status: 'partial',
      provider: { id: 'provider-1', key: 'cysmo', name: 'Cysmo' },
      category: { id: 'category-1', key: 'security', name: 'Security' },
      createdAt: '2026-07-17T00:00:00.000Z',
      remainingChecks: 86,
      maxChecks: 100,
      attemptCount: 1,
      externalJobId: null,
      errorCode: null,
      errorMessage: null,
      rawResult: {
        domain: 'youtube.com',
        report: { id: 'report-1', state: 'IN_PROGRESS', running: true },
        spf: { hasResults: false, signals: [] },
        ports: { openPorts: 1, hasResults: true },
        leaks: { passwordLeaks: 0, emailLeaks: 0, hasDarknetResults: false },
      },
      structuredResult: {
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
      updatedAt: '2026-07-17T00:00:00.000Z',
      startedAt: null,
      completedAt: null,
    };

    const viewModel = buildViewModel(check);

    expect(viewModel.summary).toEqual({
      totalChecks: 4,
      passed: 3,
      neutral: 0,
      warnings: 1,
      failed: 0,
    });
    expect(viewModel.portMeasurementCount).toBe(1);
    expect(viewModel.findings).toEqual([]);
  });

  it('uses Cysmo classification counts and scores from the raw report', () => {
    const check: SavedDomainCheck = {
      id: 'check-cysmo-1',
      url: 'expired.badssl.com',
      status: 'completed',
      provider: { id: 'provider-1', key: 'cysmo', name: 'Cysmo' },
      category: { id: 'category-1', key: 'default', name: 'Domain Security Check' },
      createdAt: '2026-08-15T19:02:25.710Z',
      updatedAt: '2026-08-15T19:03:30.834Z',
      remainingChecks: 5,
      maxChecks: 10,
      attemptCount: 8,
      externalJobId: 'company-1',
      errorCode: null,
      errorMessage: null,
      rawResult: {
        report: {
          valueTech: 0.7205357142857143,
          valueBusiness: 0.7008088235294117,
          ratingScoreTermTech: 'C',
          ratingScoreTermBusiness: 'C',
          classifications: { GOOD: 15, NEUTRAL: 5, WARNING: 4, CRITICAL: 1, CATASTROPHIC: 0 },
        },
        spf: { hasSpf: false, hasResults: false },
        ports: { openPorts: 0, hasResults: false },
        leaks: { passwordLeaks: 0, emailLeaks: 0, hasDarknetResults: false },
        software: { eolSoftware: 0, hasResults: false },
        unacknowledgedSubdomains: ['expired.badssl.com'],
      },
      structuredResult: {
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
      startedAt: '2026-08-15T19:02:27.456Z',
      completedAt: '2026-08-15T19:03:30.767Z',
    };

    const viewModel = buildViewModel(check);

    expect(viewModel.summary).toEqual({ totalChecks: 25, passed: 15, neutral: 5, warnings: 4, failed: 1 });
    expect(viewModel.assessment).toMatchObject({
      technicalScore: 0.7205357142857143,
      businessScore: 0.7008088235294117,
      technicalRating: 'C',
      businessRating: 'C',
      classifications: { good: 15, neutral: 5, warning: 4, critical: 1, catastrophic: 0 },
    });
    expect(viewModel.hasSpfMeasurement).toBe(false);
    expect(viewModel.portMeasurementCount).toBeNull();
    expect(viewModel.unacknowledgedSubdomains).toEqual(['expired.badssl.com']);
  });
});
