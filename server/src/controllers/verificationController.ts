import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { verificationAdapters } from '../verification/adapters.js';
import { writeAuditEvent } from '../services/audit.js';
import { raiseAlerts, AlertInput } from '../services/alerts.js';

const VerifySchema = z.object({
  applicationId: z.string().min(1),
  provider: z.string().min(1),
  referenceId: z.string().trim().min(1).max(160),
  documentId: z.string().optional(),
});

export async function requestVerification(req: Request, res: Response): Promise<void> {
  const parsed = VerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'ValidationError', details: parsed.error.flatten() });
    return;
  }

  const { applicationId, provider, referenceId, documentId } = parsed.data;
  const adapter = verificationAdapters[provider];
  if (!adapter) {
    res.status(400).json({ success: false, error: 'UnsupportedVerificationProvider' });
    return;
  }

  try {
    const application = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) {
      res.status(404).json({ success: false, error: 'ApplicationNotFound' });
      return;
    }
    if (documentId) {
      const document = await prisma.document.findFirst({ where: { id: documentId, applicationId } });
      if (!document) {
        res.status(400).json({ success: false, error: 'DocumentNotInApplication' });
        return;
      }
    }

    // Adapters are explicitly simulations. A future live adapter must have its
    // own credential/configuration path and must not impersonate an authority.
    const result = await adapter.verify(referenceId, { applicationId, category: application.category });
    const created = await prisma.$transaction(async (tx) => {
      const verification = await tx.verificationRequest.create({
        data: {
          applicationId,
          documentId,
          requestedByUserId: req.user!.id,
          provider: result.provider,
          referenceId: result.referenceId,
          requestedAt: result.requestedAt,
          completedAt: new Date(),
          status: result.status,
          responseSummary: result.responseSummary,
          evidenceReference: result.evidenceReference,
          rawResponseJson: result.rawResponse ? JSON.stringify(result.rawResponse) : null,
          isDemoSimulation: result.isDemoSimulation,
        },
      });
      await writeAuditEvent(tx, {
        actorId: req.user!.id, actorName: req.user!.name, actorRole: req.user!.role,
        action: 'VERIFICATION_REQUESTED', entityType: 'VerificationRequest', entityId: verification.id,
        afterState: {
          applicationId, documentId: documentId || null, provider: result.provider,
          requestedAt: result.requestedAt.toISOString(), status: result.status,
          evidenceReference: result.evidenceReference, isDemoSimulation: result.isDemoSimulation,
        },
        ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });
      return verification;
    });

    const alert = verificationAlert(result.status, result.provider, applicationId);
    if (alert) await raiseAlerts(applicationId, [alert]);

    res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

const STATUSES = ['VERIFIED', 'MISMATCH_DETECTED', 'EXPIRED', 'PENDING', 'SOURCE_UNAVAILABLE', 'MANUAL_REVIEW_REQUIRED'] as const;

function verificationAlert(status: string, provider: string, applicationId: string): AlertInput | null {
  const source = provider.replace(/_/g, ' ').toLowerCase();
  switch (status) {
    case 'MISMATCH_DETECTED': return { type: 'MISMATCH', title: 'Source verification mismatch', message: `The ${source} returned details that differ from the submission for ${applicationId}.` };
    case 'EXPIRED': return { type: 'EXPIRED', title: 'Source confirms document expired', message: `The ${source} reports the document for ${applicationId} is no longer valid.` };
    case 'PENDING': return { type: 'PENDING_VERIFICATION', title: 'Source verification pending', message: `Awaiting a response from the ${source} for ${applicationId}.` };
    case 'SOURCE_UNAVAILABLE': return { type: 'SOURCE_UNAVAILABLE', title: 'Verification source unavailable', message: `The ${source} could not be reached for ${applicationId}. Manual confirmation is needed.` };
    case 'MANUAL_REVIEW_REQUIRED': return { type: 'MANUAL_REVIEW', title: 'Verification needs manual review', message: `The ${source} result for ${applicationId} was inconclusive.` };
    default: return null;
  }
}

export async function listVerifications(req: Request, res: Response): Promise<void> {
  try {
    const status = typeof req.query.status === 'string' && (STATUSES as readonly string[]).includes(req.query.status) ? req.query.status : undefined;
    const applicationId = typeof req.query.applicationId === 'string' && req.query.applicationId ? req.query.applicationId : undefined;
    const [items, grouped] = await Promise.all([
      prisma.verificationRequest.findMany({
        where: { ...(status ? { status: status as any } : {}), ...(applicationId ? { applicationId } : {}) },
        include: {
          application: { select: { id: true, category: true, institution: { select: { name: true } } } },
          document: { select: { id: true, originalName: true, documentType: true } },
          requestedBy: { select: { name: true, role: true } },
        },
        orderBy: { requestedAt: 'desc' },
        take: 200,
      }),
      prisma.verificationRequest.groupBy({ by: ['status'], _count: { _all: true }, where: applicationId ? { applicationId } : {} }),
    ]);
    const counts = Object.fromEntries(STATUSES.map((s) => [s, grouped.find((g) => g.status === s)?._count._all || 0]));
    res.json({ success: true, data: { items, counts } });
  } catch {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

const ManualConfirmSchema = z.object({
  status: z.enum(['VERIFIED', 'MISMATCH_DETECTED', 'EXPIRED']),
  note: z.string().trim().min(10).max(1000),
  confirmationReference: z.string().trim().min(3).max(160),
});

/** Records an official's confirmation obtained outside the automated channel (letter, certified copy, call log). */
export async function confirmVerificationManually(req: Request, res: Response): Promise<void> {
  const parsed = ManualConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'ValidationError', details: parsed.error.flatten() });
    return;
  }
  try {
    const existing = await prisma.verificationRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'VerificationNotFound' });
      return;
    }
    if (!['PENDING', 'SOURCE_UNAVAILABLE', 'MANUAL_REVIEW_REQUIRED'].includes(existing.status)) {
      res.status(409).json({ success: false, error: 'VerificationAlreadyResolved', message: 'Only pending, unavailable or inconclusive verifications can be confirmed manually.' });
      return;
    }
    const { status, note, confirmationReference } = parsed.data;
    const updated = await prisma.$transaction(async (tx) => {
      const verification = await tx.verificationRequest.update({
        where: { id: existing.id },
        data: {
          status,
          completedAt: new Date(),
          responseSummary: `Manual confirmation by ${req.user!.name}: ${note}`,
          evidenceReference: confirmationReference,
        },
      });
      await writeAuditEvent(tx, {
        actorId: req.user!.id, actorName: req.user!.name, actorRole: req.user!.role,
        action: 'VERIFICATION_MANUALLY_CONFIRMED', entityType: 'VerificationRequest', entityId: existing.id,
        beforeState: { status: existing.status, responseSummary: existing.responseSummary, evidenceReference: existing.evidenceReference },
        afterState: { applicationId: existing.applicationId, status, note, confirmationReference },
        ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });
      return verification;
    });
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}
