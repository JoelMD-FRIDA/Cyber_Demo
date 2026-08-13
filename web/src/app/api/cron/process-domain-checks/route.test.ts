// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const processQueue = vi.hoisted(() => vi.fn());

vi.mock('@/server/domain-check-service', () => ({
  processDomainCheckQueue: processQueue,
}));

import { GET } from './route';

function request(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/process-domain-checks', { headers });
}

describe('GET /api/cron/process-domain-checks', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret';
    processQueue.mockReset().mockResolvedValue({ processed: 1, pending: 0, failed: 0, errors: [] });
  });

  it('rejects requests without the cron secret', async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(processQueue).not.toHaveBeenCalled();
  });

  it('accepts the Vercel bearer secret and processes a bounded batch', async () => {
    const response = await GET(request({ authorization: 'Bearer cron-secret' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: 1, pending: 0, failed: 0, errors: [] });
    expect(processQueue).toHaveBeenCalledOnce();
  });

  it('also accepts the explicit API-key header for operational checks', async () => {
    const response = await GET(request({ 'x-api-key': 'cron-secret' }));
    expect(response.status).toBe(200);
    expect(processQueue).toHaveBeenCalledOnce();
  });
});
