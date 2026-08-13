import { describe, expect, it } from 'vitest';
import { isValidUrl, normalizeDomainName } from './domain-check-url';

describe('isValidUrl', () => {
  it('accepts a schemeless domain when the scanner receives an unfinished link', () => {
    expect(isValidUrl('youtube.com')).toBe(true);
  });

  it('normalizes a schemeless domain to the hostname sent to the provider', () => {
    expect(normalizeDomainName('  youtube.com  ')).toBe('youtube.com');
  });
});
