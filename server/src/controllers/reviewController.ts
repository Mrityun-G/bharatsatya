import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { writeAuditEvent } from '../services/audit.js';

const RequestClarificationSchema = z.object({
  applicationId: z.string().min(1),
  deficiencyTitle: z.string().min(5),
  clarificationMessage: z.string().min(10, 'A clear description of the required institutional clarification is mandatory'),
  deadlineDays: z.number().default(7),
});

const AddNoteSchema = z.object({
  applicationId: z.string().min(1),
  note: z.string().min(3),
});

export async function requestClarification(req: Request, res: Response): Promise<void> {
  try {
    const parsed = RequestClarificationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'ValidationError', details: parsed.error.flatten() });
      return;
    }

    const { applicationId, deficiencyTitle, clarificationMessage } = parsed.data;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { institution: { include: { users: true } } },
    });

    if (!application) {
      res.status(404).json({ success: false, error: 'ApplicationNotFound' });
      return;
    }

    const previousStatus = application.status;

    await prisma.$transaction(async (tx) => {
      // 1. Update Application status
      await tx.application.update({
        where: { id: applicationId },
        data: {
          status: 'CLARIFICATION_REQUESTED',
          currentStage: `Clarification Requested: ${deficiencyTitle}`,
          remarks: clarificationMessage,
          lastEvaluatedAt: new Date(),
        },
      });

      // 2. Add ReviewAction
      if (req.user) {
        await tx.reviewAction.create({
          data: {
            applicationId,
            reviewerId: req.user.id,
            actionType: 'CLARIFICATION_REQUEST',
            previousStatus,
            newStatus: 'CLARIFICATION_REQUESTED',
            reason: `Deficiency Scrutiny Notice: ${deficiencyTitle}`,
            notes: clarificationMessage,
          },
        });
      }

      // 3. Create Notification for Institution Users
      for (const instUser of application.institution.users) {
        await tx.notification.create({
          data: {
            userId: instUser.id,
            applicationId,
            title: `AICTE Scrutiny Clarification Requested: ${deficiencyTitle}`,
            message: clarificationMessage,
            type: 'CLARIFICATION_RESPONSE',
          },
        });
      }

      await writeAuditEvent(tx, {
        actorId: req.user?.id, actorName: req.user?.name || 'Reviewing Officer', actorRole: req.user?.role || 'REVIEWER',
        action: 'CLARIFICATION_REQUESTED', entityType: 'Application', entityId: applicationId,
        beforeState: { status: previousStatus }, afterState: { status: 'CLARIFICATION_REQUESTED', deficiencyTitle, clarificationMessage },
        ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });
    });

    const updatedApp = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { reviewActions: true },
    });

    res.json({ success: true, data: updatedApp });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

export async function addReviewObservation(req: Request, res: Response): Promise<void> {
  try {
    const parsed = AddNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'ValidationError', details: parsed.error.flatten() });
      return;
    }

    const { applicationId, note } = parsed.data;

    const action = await prisma.$transaction(async (tx) => {
      const review = await tx.reviewAction.create({
        data: { applicationId, reviewerId: req.user!.id, actionType: 'NOTE_ADDED', reason: 'Internal Review Observation', notes: note },
        include: { reviewer: { select: { name: true, role: true } } },
      });
      await writeAuditEvent(tx, {
        actorId: req.user?.id, actorName: req.user?.name || 'Reviewing Officer', actorRole: req.user?.role || 'REVIEWER',
        action: 'REVIEW_NOTE_RECORDED', entityType: 'Application', entityId: applicationId,
        afterState: { note }, ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });
      return review;
    });

    res.status(201).json({ success: true, data: action });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}
