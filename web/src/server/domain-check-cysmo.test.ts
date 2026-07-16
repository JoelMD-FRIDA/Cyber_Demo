// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendCheckRequest } from './domain-check-cysmo';

describe('sendCheckRequest', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates a company with vendor accept flags and fetches the TECH report when it is ready', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'company-1',
        reports: [{ id: 'report-1', state: 'FINISHED', running: false }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'report-1',
        partialRatings: [{ nameKey: 'spf', value: 1 }],
      }), { status: 200 }));

    const result = await sendCheckRequest('https://api.cysmo.de', 'token-1', 'youtube.com');

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.cysmo.de/v2/companies?acceptSubDomain=true&acceptNotReachable=true', expect.objectContaining({
      body: JSON.stringify({ domains: ['youtube.com'], nets: [] }),
      method: 'POST',
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.cysmo.de/v2/reports/report-1?dataMode=TECH', expect.objectContaining({
      method: 'GET',
    }));
    expect(result).toMatchObject({
      domain: 'youtube.com',
      status: 'finished',
      report: { id: 'report-1' },
    });
  });

  it('fetches the current TECH report snapshot when polling times out before it is ready', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'company-1',
      reports: [{ id: 'report-1', state: 'NEW', running: true }],
    }), { status: 200 }));
    for (let attempt = 1; attempt <= 8; attempt++) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'company-1',
        reports: [{ id: 'report-1', state: 'IN_PROGRESS', running: true }],
      }), { status: 200 }));
    }
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'report-1',
      state: 'IN_PROGRESS',
      running: true,
      entrypoints: { domains: ['youtube.com'] },
    }), { status: 200 }));

    const resultPromise = sendCheckRequest('https://api.cysmo.de', 'token-1', 'youtube.com');
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenNthCalledWith(10, 'https://api.cysmo.de/v2/reports/report-1?dataMode=TECH', expect.objectContaining({
      method: 'GET',
    }));
    expect(result).toMatchObject({
      domain: 'youtube.com',
      status: 'partial',
      report: { id: 'report-1', state: 'IN_PROGRESS' },
      partialReason: 'Cysmo report did not finish before the polling timeout.',
    });
  });
});
