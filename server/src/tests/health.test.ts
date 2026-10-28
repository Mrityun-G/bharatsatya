import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock('../prisma.js', () => ({ prisma: { $queryRaw: queryRaw } }));

import { getHealth } from '../controllers/healthController.js';

function response() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((body: unknown) => { res.body = body; return res; });
  return res;
}

describe('dependency-aware health response', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports API and database availability without configuration details', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const res = response();
    await getHealth({} as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: 'UP', dependencies: { database: 'available' } });
    expect(JSON.stringify(res.body)).not.toMatch(/postgresql:|password|secret|stack|path/i);
  });

  it('returns a sanitized 503 when PostgreSQL is unavailable', async () => {
    queryRaw.mockRejectedValueOnce(new Error('postgresql://private-user:private-password@host/private-db'));
    const res = response();
    await getHealth({} as any, res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ status: 'DEGRADED', dependencies: { database: 'unavailable' } });
    expect(JSON.stringify(res.body)).not.toContain('private-user');
    expect(JSON.stringify(res.body)).not.toContain('private-password');
    expect(JSON.stringify(res.body)).not.toContain('private-db');
  });
});
