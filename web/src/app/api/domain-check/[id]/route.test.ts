// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCheck = vi.hoisted(() => vi.fn());
const processCheck = vi.hoisted(() => vi.fn());

vi.mock('@/server/domain-check-service', () => ({
  getDomainCheck: getCheck,
  advanceDomainCheck: processCheck,
}));

import { GET,POST } from './route';

describe('GET /api/domain-check/[id]', () => {
  beforeEach(() => {
    getCheck.mockReset();
    processCheck.mockReset().mockResolvedValue(undefined);
  });

  it('advances an active check only through POST', async () => {
    processCheck
      .mockResolvedValueOnce({ id: 'check-1', status: 'completed' });

    const response = await POST(new Request('http://localhost/api/domain-check/check-1'), { params: Promise.resolve({ id: 'check-1' }) });

    expect(response.status).toBe(200);
    expect(processCheck).toHaveBeenCalledWith('check-1');
    expect(await response.json()).toEqual({ check: { id: 'check-1', status: 'completed' } });
  });

  it('GET only reads, even when processing is still queued', async () => {
    getCheck.mockResolvedValue({ id: 'check-1', status: 'queued' });

    const response = await GET(new Request('http://localhost/api/domain-check/check-1'), { params: Promise.resolve({ id: 'check-1' }) });

    expect(response.status).toBe(200);
    expect(processCheck).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ check: { id: 'check-1', status: 'queued' } });
  });
});
