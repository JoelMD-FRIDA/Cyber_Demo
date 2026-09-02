// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('PANTA provider adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.PANTA_API_BASE_URL = 'https://api.moses-security.de';
    process.env.PANTA_API_KEY = 'test-panta-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PANTA_API_BASE_URL;
    delete process.env.PANTA_API_KEY;
    vi.resetModules();
  });

  it('queries a contact synchronously and maps breach data to the common result shape', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      error: 0,
      breached: true,
      breaches: ['ExampleBreach'],
      newBreaches: ['RecentBreach'],
      canSendInfo: true,
      sendTimeLeft: 0,
    }), { status: 200 }));

    const { getProviderAdapter } = await import('./domain-check-cysmo');
    const adapter = getProviderAdapter('panta');
    expect(adapter).toMatchObject({ key: 'panta', inputType: 'contact', isConfigured: true });

    const job = await adapter!.start({ url: '  Person@Example.com ', providerKey: 'panta' });
    expect(job).toMatchObject({
      externalJobId: 'panta-query',
      completed: true,
      snapshot: { contact: 'person@example.com' },
    });
    expect(fetchMock).toHaveBeenCalledWith('https://api.moses-security.de/v1/query', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'User-Agent': 'FRIDA DomainCheck',
      }),
      body: JSON.stringify({ apiKey: 'test-panta-key', contact: 'person@example.com', showBreaches: true }),
    }));

    const normalized = adapter!.normalize(job.snapshot);
    expect(normalized.structuredResult).toMatchObject({
      resultsEmailLeaks: 1,
      hasDarknetResults: true,
      hasSPFRecordResult: false,
    });
    expect(normalized.richResult).toMatchObject({
      panta: { breached: true, breaches: ['ExampleBreach'], newBreaches: ['RecentBreach'] },
      leaks: { emailLeaks: 1 },
    });
  });

  it('surfaces non-retryable PANTA API-key errors without retrying them', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      error: 2,
      message: 'The API key was invalid.',
    }), { status: 200 }));

    const { getProviderAdapter } = await import('./domain-check-cysmo');
    await expect(getProviderAdapter('panta')!.start({ url: 'person@example.com', providerKey: 'panta' }))
      .rejects.toMatchObject({ code: 'PANTA_INVALID_API_KEY', retryable: false });
  });

  it('accepts email addresses and international phone numbers as contacts', async () => {
    const { isValidPantaContact } = await import('./domain-check-panta');
    expect(isValidPantaContact('person@example.com')).toBe(true);
    expect(isValidPantaContact('+49 170 1234567')).toBe(true);
    expect(isValidPantaContact('170 1234567')).toBe(false);
    expect(isValidPantaContact('example.com')).toBe(false);
  });
});
