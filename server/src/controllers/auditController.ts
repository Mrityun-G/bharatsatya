import { Request, Response } from 'express';
import { prisma } from '../prisma.js';

export async function listAuditEvents(req: Request, res: Response): Promise<void> {
  try {
    const { entityType, entityId, action, limit = '50', offset = '0' } = req.query;

    const where: any = {};
    if (entityType) where.entityType = entityType as string;
    if (entityId) where.entityId = entityId as string;
    if (action) where.action = action as string;

    const take = Math.min(parseInt(limit as string, 10) || 50, 100);
    const skip = parseInt(offset as string, 10) || 0;

    const [total, events] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          actor: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

    res.json({
      success: true,
      total,
      limit: take,
      offset: skip,
      data: events,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}
