// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getLocaleFromCookieHeader, translate, translateApiError } from './i18n';

describe('bilingual message layer', () => {
  it('reads the locale from the cookie used by server rendering', () => {
    expect(getLocaleFromCookieHeader('foo=bar; locale=en; theme=dark')).toBe('en');
    expect(getLocaleFromCookieHeader('foo=bar')).toBe('de');
  });

  it('translates stable API error codes without exposing backend language', () => {
    expect(translateApiError('de', 'RATE_LIMIT_EXCEEDED', 'backend message')).toContain('Prüfkontingent');
    expect(translateApiError('en', 'RATE_LIMIT_EXCEEDED', 'backend message')).toContain('quota');
    expect(translateApiError('en', 'UNKNOWN_CODE', 'fallback')).toBe('fallback');
  });

  it('interpolates values in both dictionaries', () => {
    expect(translate('de', 'domain.quota', { remaining: 3, maximum: 10 })).toContain('3');
    expect(translate('en', 'domain.quota', { remaining: 3, maximum: 10 })).toContain('10');
  });
});
