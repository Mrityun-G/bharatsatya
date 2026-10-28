import { prisma } from '../prisma.js';

export interface AuditLogParams {
  actorId?: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(params: AuditLogParams) {
  return writeAuditEvent(prisma, params);
}

export async function writeAuditEvent(client: any, params: AuditLogParams) {
  return client.auditEvent.create({
    data: {
      actorId: params.actorId || null,
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeStateJson: params.beforeState ? JSON.stringify(params.beforeState) : null,
      afterStateJson: params.afterState ? JSON.stringify(params.afterState) : null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    },
  });
}
