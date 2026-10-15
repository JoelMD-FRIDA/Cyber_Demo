// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchProviderJson } from './provider-http';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('bounded provider requests', () => {
  it('keeps the deadline active while response headers never arrive', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const pending = fetchProviderJson('https://provider.invalid', {}, 20);
    const rejected = expect(pending).rejects.toThrow('deadline');
    await vi.advanceTimersByTimeAsync(21);
    await rejected;
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error', cache: 'no-store' });
  });

  it('times out a stalled response body, even after headers succeeded', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('{')); },
    }))));
    const pending = fetchProviderJson('https://provider.invalid', {}, 20);
    const rejected = expect(pending).rejects.toThrow('deadline');
    await vi.advanceTimersByTimeAsync(21);
    await rejected;
  });

  it('caps streamed bytes without trusting Content-Length', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('123456789')));
    await expect(fetchProviderJson('https://provider.invalid', {}, 100, 4)).rejects.toThrow('size limit');
  });

  it('does not leak credentials or upstream body details from network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret-api-key contact@example.com')));
    await expect(fetchProviderJson('https://provider.invalid', {})).rejects.toThrow('Provider request failed.');
  });

  it('reads successful JSON within the same bounded request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":true}')));
    await expect(fetchProviderJson('https://provider.invalid', {})).resolves.toMatchObject({ body: { ok: true } });
  });
});
