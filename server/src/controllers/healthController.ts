import { Request, Response } from 'express';
import { prisma } from '../prisma.js';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'UP',
      dependencies: { database: 'available' },
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch {
    // Do not include database errors, connection details, or stack traces in the response.
    res.status(503).json({
      status: 'DEGRADED',
      dependencies: { database: 'unavailable' },
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }
}
