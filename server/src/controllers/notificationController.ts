import { Request, Response } from 'express';
import { prisma } from '../prisma.js';

export async function listNotifications(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    res.json({ success: true, data: { items, unreadCount } });
  } catch {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  try {
    const result = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.id }, data: { isRead: true } });
    if (!result.count) {
      res.status(404).json({ success: false, error: 'NotificationNotFound' });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}
