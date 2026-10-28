import { beforeEach, describe, expect, it, vi } from 'vitest';

const { verificationCreate, transaction, writeAuditEvent } = vi.hoisted(() => ({
  verificationCreate: vi.fn(),
  transaction: vi.fn(),
  writeAuditEvent: vi.fn(),
}));
vi.mock('../prisma.js', () => ({ prisma: {
  application: { findUnique: vi.fn() },
  document: { findFirst: vi.fn() },
  $transaction: transaction,
} }));
vi.mock('../services/audit.js', () => ({ writeAuditEvent }));

import { prisma } from '../prisma.js';
import { requestVerification } from '../controllers/verificationController.js';

function response() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((body: unknown) => { res.body = body; return res; });
  return res;
}

describe('authenticated verification action persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.application.findUnique).mockResolvedValue({ id: 'app-1', category: 'ENGINEERING_TECH' } as any);
    verificationCreate.mockResolvedValue({ id: 'verification-1', isDemoSimulation: true });
    writeAuditEvent.mockResolvedValue(undefined);
    transaction.mockImplementation(async (callback: any) => callback({ verificationRequest: { create: verificationCreate } }));
  });

  it('persists the acting reviewer and simulated result alongside an audit event in one transaction', async () => {
    const req: any = {
      body: { applicationId: 'app-1', provider: 'AICTE_CENTRAL_PORTAL_DATABASE', referenceId: 'DEMO-123' },
      user: { id: 'reviewer-1', name: 'Reviewer', role: 'REVIEWER' },
      ip: '127.0.0.1', headers: {},
    };
    const res = response();
    await requestVerification(req, res);

    expect(res.statusCode).toBe(201);
    expect(verificationCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      applicationId: 'app-1', requestedByUserId: 'reviewer-1', provider: 'AICTE_CENTRAL_PORTAL_DATABASE', isDemoSimulation: true,
    }) }));
    expect(writeAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actorId: 'reviewer-1', action: 'VERIFICATION_REQUESTED', entityId: 'verification-1',
    }));
  });

  it('rejects unsupported providers without writing verification records', async () => {
    const res = response();
    await requestVerification({ body: { applicationId: 'app-1', provider: 'AICTE_LIVE', referenceId: '123' } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(verificationCreate).not.toHaveBeenCalled();
  });
});
