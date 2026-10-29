// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { GET as live } from './live/route';
import { GET as ready } from './ready/route';

describe('private deployment probes', () => {
  it('reports liveness without querying databases, auth or paid providers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected network'));
    try {
      const response = await live();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok' });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally { fetchMock.mockRestore(); }
  });

  it('does not admit an unconfigured PostgreSQL/SSO app', async () => {
    const response = await ready();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });
});
