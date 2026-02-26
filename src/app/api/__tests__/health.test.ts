import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbExecute, makeRequest } from './setup';

import { GET } from '../health/route';

describe('GET /api/health', () => {
  beforeEach(() => {
    mockDbExecute.mockReset();
  });

  it('returns healthy status when DB is reachable', async () => {
    mockDbExecute.mockResolvedValueOnce([{ '?column?': 1 }]);

    const response = await GET(makeRequest('https://example.com/api/health'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.services.database.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns degraded status when DB is unreachable', async () => {
    mockDbExecute.mockRejectedValueOnce(new Error('Connection refused'));

    const response = await GET(makeRequest('https://example.com/api/health'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.services.database.status).toBe('error');
  });

  it('includes latency metrics', async () => {
    mockDbExecute.mockResolvedValueOnce([{ '?column?': 1 }]);

    const response = await GET(makeRequest('https://example.com/api/health'));
    const body = await response.json();

    expect(typeof body.latencyMs).toBe('number');
    expect(typeof body.services.database.latencyMs).toBe('number');
  });
});
