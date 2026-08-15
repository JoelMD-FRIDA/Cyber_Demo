import { describe, expect, it } from 'vitest';
import { mapCysmoResponseToStructuredResult, parseCheckResponse } from './domain-check-results';

describe('Cysmo report normalization', () => {
  const rawReport = {
    report: {
      valueTech: 0.7205357142857143,
      valueBusiness: 0.7008088235294117,
      ratingScoreTermTech: 'C',
      ratingScoreTermBusiness: 'C',
      classifications: { GOOD: 15, NEUTRAL: 5, WARNING: 4, CRITICAL: 1, CATASTROPHIC: 0 },
    },
  };

  it('preserves Cysmo classifications and scores in the structured result', () => {
    expect(mapCysmoResponseToStructuredResult(rawReport)).toMatchObject({
      classifications: { good: 15, neutral: 5, warning: 4, critical: 1, catastrophic: 0 },
      technicalScore: 0.7205357142857143,
      businessScore: 0.7008088235294117,
      technicalRating: 'C',
      businessRating: 'C',
    });
  });

  it('also exposes the provider assessment in the rich result', () => {
    expect(parseCheckResponse(rawReport).rich.cysmo).toMatchObject({
      valueTech: 0.7205357142857143,
      valueBusiness: 0.7008088235294117,
      ratingTermTech: 'C',
      ratingTermBusiness: 'C',
      classifications: { good: 15, neutral: 5, warning: 4, critical: 1, catastrophic: 0 },
    });
  });
});
