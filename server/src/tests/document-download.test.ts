import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique, getStorage } = vi.hoisted(() => ({ findUnique: vi.fn(), getStorage: vi.fn() }));
vi.mock('../prisma.js', () => ({ prisma: { document: { findUnique } } }));
vi.mock('../storage/provider.js', () => ({ getDocumentStorage: getStorage }));
import { downloadDocument } from '../controllers/documentController.js';

function response() {
  const res: any = { statusCode: 200, headers: {}, body: undefined };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((body: unknown) => { res.body = body; return res; });
  res.setHeader = vi.fn((name: string, value: string) => { res.headers[name] = value; });
  res.destroy = vi.fn();
  return res;
}

describe('private document download authorization and failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({ id: 'doc-1', storagePath: '3bd7d37a-2151-4518-b3bd-d165a2d32710.pdf', mimeType: 'application/pdf', originalName: 'document.pdf', application: { institutionId: 'institution-a' } });
    getStorage.mockReturnValue({ exists: vi.fn().mockResolvedValue(true), get: vi.fn() });
  });

  it('prevents applicants from downloading documents across applications/institutions', async () => {
    const res = response();
    await downloadDocument({ params: { id: 'doc-1' }, user: { role: 'APPLICANT', institutionId: 'institution-b' } } as any, res);
    expect(res.statusCode).toBe(403);
    expect(getStorage).not.toHaveBeenCalled();
  });

  it('returns 404 for an object missing from private storage', async () => {
    getStorage.mockReturnValue({ exists: vi.fn().mockResolvedValue(false) });
    const res = response();
    await downloadDocument({ params: { id: 'doc-1' }, user: { role: 'REVIEWER' } } as any, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('DocumentObjectNotFound');
  });

  it('returns an explicit provider failure when storage cannot be queried', async () => {
    getStorage.mockReturnValue({ exists: vi.fn().mockRejectedValue(new Error('storage unavailable')) });
    const res = response();
    await downloadDocument({ params: { id: 'doc-1' }, user: { role: 'ADMIN' } } as any, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('InternalServerError');
    expect(JSON.stringify(res.body)).not.toContain('storage unavailable');
  });
});
