/** A single deadline covers headers and body; errors never contain response data. */
export interface ProviderHttpResponse {
  status: number;
  ok: boolean;
  statusText: string;
  headers: Headers;
  body: unknown;
}

export async function fetchProviderJson(
  url: string,
  init: RequestInit,
  timeoutMs = 15_000,
  maxBytes = 2 * 1024 * 1024,
): Promise<ProviderHttpResponse> {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Provider request deadline exceeded.'));
    }, timeoutMs);
  });
  const operation = async () => {
    const response = await fetch(url, {
      ...init, signal: controller.signal, redirect: 'error', cache: 'no-store',
    });
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      controller.abort();
      throw new Error('Provider response exceeds the size limit.');
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (response.body) {
      reader = response.body.getReader();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > maxBytes) {
          controller.abort();
          throw new Error('Provider response exceeds the size limit.');
        }
        chunks.push(chunk.value);
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder().decode(bytes);
    let body: unknown = null;
    if (text) {
      try { body = JSON.parse(text); } catch { body = text; }
    }
    return { status: response.status, ok: response.ok, statusText: '', headers: response.headers, body };
  };
  try {
    return await Promise.race([operation(), deadline]);
  } catch (error) {
    controller.abort();
    if (error instanceof Error && (
      error.message === 'Provider request deadline exceeded.' ||
      error.message === 'Provider response exceeds the size limit.'
    )) throw error;
    throw new Error('Provider request failed.');
  } finally {
    clearTimeout(timer);
    // Do not await cancellation: an unresponsive upstream must not extend the deadline.
    void reader?.cancel().catch(() => {});
  }
}
