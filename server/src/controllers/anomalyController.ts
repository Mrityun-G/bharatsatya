import { Request, Response } from 'express';
import { collectAnomalies } from '../forensics/anomalies.js';

export const ANOMALY_DISCLAIMER = 'Preliminary indicators for human verification. They are not findings of forgery or misconduct.';

export async function listAnomalies(req: Request, res: Response): Promise<void> {
  try {
    const applicationId = typeof req.query.applicationId === 'string' && req.query.applicationId ? req.query.applicationId : undefined;
    const institutionId = req.user?.role === 'APPLICANT' ? req.user.institutionId || '__none__' : undefined;
    const flags = await collectAnomalies({ applicationId, institutionId });
    const summary = {
      total: flags.length,
      high: flags.filter((f) => f.severity === 'HIGH').length,
      medium: flags.filter((f) => f.severity === 'MEDIUM').length,
      low: flags.filter((f) => f.severity === 'LOW').length,
      applications: new Set(flags.map((f) => f.applicationId)).size,
    };
    res.json({ success: true, data: { flags, summary, disclaimer: ANOMALY_DISCLAIMER } });
  } catch {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}
