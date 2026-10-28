import { describe, expect, it, vi } from 'vitest';

const create = vi.hoisted(() => vi.fn());
vi.mock('../prisma.js', () => ({ prisma: { auditEvent: { create } } }));
import { logAuditEvent, writeAuditEvent } from '../services/audit.js';

describe('audit persistence', () => {
  it('propagates audit database failures so callers cannot silently report success', async () => {
    create.mockRejectedValueOnce(new Error('synthetic audit failure'));
    await expect(logAuditEvent({ actorName: 'Test reviewer', actorRole: 'REVIEWER', action: 'TEST', entityType: 'Test', entityId: '1' }))
      .rejects.toThrow('synthetic audit failure');
  });

  it('writes through the supplied transaction client', async () => {
    const transactionClient = { auditEvent: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) } };
    await writeAuditEvent(transactionClient, { actorName: 'Test reviewer', actorRole: 'REVIEWER', action: 'REVIEWED', entityType: 'Application', entityId: 'app-1' });
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'REVIEWED', entityId: 'app-1' }) }));
  });
});
