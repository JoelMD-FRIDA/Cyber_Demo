import { describe, expect, it } from 'vitest';
import { isValidUrl } from './domain-check-url';

describe('isValidUrl', () => {
  it('accepts a schemeless domain when the scanner receives an unfinished link', () => {
    expect(isValidUrl('youtube.com')).toBe(true);
  });
});
