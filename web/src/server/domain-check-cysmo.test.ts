// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendCheckRequest } from './domain-check-cysmo';

describe('sendCheckRequest', () => {
  afterEach(() => {
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
});
