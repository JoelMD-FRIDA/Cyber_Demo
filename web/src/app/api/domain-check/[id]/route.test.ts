// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCheck = vi.hoisted(() => vi.fn());
const processCheck = vi.hoisted(() => vi.fn());

vi.mock('@/server/domain-check-service', () => ({
  getDomainCheck: getCheck,
  processDomainCheckOnDemand: processCheck,
}));

import { GET } from './route';

describe('GET /api/domain-check/[id]', () => {
  beforeEach(() => {
    getCheck.mockReset();
    processCheck.mockReset().mockResolvedValue(undefined);
  });

  it('advances an active check while its results page is open', async () => {
    getCheck
      .mockResolvedValueOnce({ id: 'check-1', status: 'queued' })
      .mockResolvedValueOnce({ id: 'check-1', status: 'completed' });

    const response = await GET(new Request('http://localhost/api/domain-check/check-1'), { params: Promise.resolve({ id: 'check-1' }) });

    expect(response.status).toBe(200);
    expect(processCheck).toHaveBeenCalledWith('check-1');
    expect(await response.json()).toEqual({ check: { id: 'check-1', status: 'completed' } });
  });

  it('does not process a completed check again', async () => {
    getCheck.mockResolvedValue({ id: 'check-1', status: 'completed' });

    const response = await GET(new Request('http://localhost/api/domain-check/check-1'), { params: Promise.resolve({ id: 'check-1' }) });

    expect(response.status).toBe(200);
    expect(processCheck).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ check: { id: 'check-1', status: 'completed' } });
  });
});
