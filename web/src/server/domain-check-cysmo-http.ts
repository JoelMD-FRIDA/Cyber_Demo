import { RateLimitError } from './domain-check-errors';
import { fetchProviderJson, type ProviderHttpResponse } from './provider-http';

export interface CysmoJsonRequest {
  readonly apiBaseUrl: string;
  readonly token: string;
  readonly path: string;
  readonly method?: 'GET' | 'POST';
  readonly body?: string;
}

export type CysmoJsonResponse = ProviderHttpResponse;

export async function fetchCysmoJson(request: CysmoJsonRequest): Promise<CysmoJsonResponse> {
  const response = await fetchProviderJson(
    `${request.apiBaseUrl.replace(/\/+$/, '')}${request.path}`,
    {
      method: request.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${request.token}`,
        ...(request.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(request.body ? { body: request.body } : {}),
    },
  );
  if (response.status === 429) {
    const raw = Number.parseInt(response.headers.get('Retry-After') ?? '5', 10);
    const retryAfter = Number.isFinite(raw) ? Math.min(60, Math.max(1, raw)) : 5;
    throw new RateLimitError('Provider rate limit exceeded.', retryAfter);
  }
  return response;
}
