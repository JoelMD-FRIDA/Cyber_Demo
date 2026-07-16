import { RateLimitError } from './domain-check-errors';

const REQUEST_TIMEOUT_MS = 30_000;

export interface CysmoJsonRequest {
  readonly apiBaseUrl: string;
  readonly token: string;
  readonly path: string;
  readonly method?: 'GET' | 'POST';
  readonly body?: string;
}

export interface CysmoJsonResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly statusText: string;
  readonly headers: Headers;
  readonly body: unknown;
}

export async function fetchCysmoJson(request: CysmoJsonRequest): Promise<CysmoJsonResponse> {
  const requestUrl = `${request.apiBaseUrl.replace(/\/+$/, '')}${request.path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const init: RequestInit = {
      method: request.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${request.token}`,
        ...(request.body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: controller.signal,
    };
    if (request.body) init.body = request.body;

    const response = await fetch(requestUrl, init);
    clearTimeout(timeoutId);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '5', 10);
      throw new RateLimitError(`Rate limited. Retry after ${retryAfter}s`, retryAfter);
    }

    return {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      headers: response.headers,
      body: await parseJsonBody(response),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Cysmo API request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

async function parseJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) return text;
    throw error;
  }
}

export function formatResponseBody(response: CysmoJsonResponse): string {
  if (typeof response.body === 'string') return response.body || response.statusText;
  if (response.body === null || response.body === undefined) return response.statusText;
  return JSON.stringify(response.body);
}
