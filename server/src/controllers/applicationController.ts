import { Request, Response } from 'express';
import { raiseAlerts, alertsFromFindings } from '../services/alerts.js';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { evaluateApplicationCompliance } from '../rules/engine.js';
import { writeAuditEvent } from '../services/audit.js';

const CreateApplicationSchema = z.object({
  institutionId: z.string().min(1, 'Institution is required'),
  category: z.enum(['ENGINEERING_TECH', 'MANAGEMENT', 'PHARMACY', 'ARCHITECTURE', 'POLYTECHNIC']),
  academicYear: z.string().default('2026-2027'),
  remarks: z.string().optional(),
});

const UpdateStatusSchema = z.object({
  newStatus: z.enum([
    'SUBMITTED',
    'UNDER_AUTOMATED_REVIEW',
    'DEFICIENCY_FLAGGED',
    'CLARIFICATION_REQUESTED',
    'VERIFIED_RECOMMENDED',
    'REJECTED_NON_COMPLIANT',
    'APPROVED',
  ]),
  reason: z.string().min(5, 'A meaningful justification reason is mandatory for consequential status transitions'),
  notes: z.string().optional(),
});

export async function listApplications(req: Request, res: Response): Promise<void> {
  try {
    const { category, status, search, reviewerId } = req.query;
    const userRole = req.user?.role;
    const userInstitutionId = req.user?.institutionId;

    const where: any = {};

    if (userRole === 'APPLICANT') {
      where.institutionId = userInstitutionId || '__unassigned_applicant__';
    }

    if (category && category !== 'ALL') {
      where.category = category as string;
    }

    if (status && status !== 'ALL') {
      where.status = status as string;
    }

    if (reviewerId) {
      where.assignedReviewerId = reviewerId as string;
    }

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { id: { contains: q } },
        { institution: { name: { contains: q } } },
        { institution: { aictePermanentId: { contains: q } } },
      ];
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        institution: true,
        assignedReviewer: { select: { id: true, name: true, designation: true } },
        _count: {
          select: {
            documents: true,
            validationFindings: true,
            verificationRequests: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ success: true, count: applications.length, data: applications });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

export async function getApplicationById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userInstitutionId = req.user?.institutionId;

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        institution: true,
        assignedReviewer: {
          select: { id: true, name: true, email: true, designation: true, department: true },
        },
        documents: {
          include: {
            extractedFields: {
              include: {
                correctedByUser: { select: { id: true, name: true, role: true } },
              },
            },
          },
          orderBy: { uploadDate: 'desc' },
        },
        validationFindings: {
          include: {
            rule: true,
            document: { select: { id: true, originalName: true, documentType: true } },
          },
          orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        },
        verificationRequests: {
          orderBy: { requestedAt: 'desc' },
        },
        reviewActions: {
          include: {
            reviewer: { select: { id: true, name: true, designation: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!application) {
      res.status(404).json({ success: false, error: 'ApplicationNotFound', message: `Application ${id} does not exist.` });
      return;
    }

    // Role-based security check: applicant can only view their own institution's application
    if (userRole === 'APPLICANT' && application.institutionId !== userInstitutionId) {
      res.status(403).json({
        success: false,
        error: 'ForbiddenAccess',
        message: 'Applicant is unauthorized to access records belonging to other institutions.',
      });
      return;
    }

    // Retrieve relevant audit events
    const auditEvents = await prisma.auditEvent.findMany({
      where: { entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({
      success: true,
      data: {
        ...application,
        auditEvents,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

export async function createApplication(req: Request, res: Response): Promise<void> {
  try {
    const parsed = CreateApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'ValidationError', details: parsed.error.flatten() });
      return;
    }

    const { institutionId, category, academicYear, remarks } = parsed.data;

    if (req.user?.role === 'APPLICANT' && institutionId !== req.user.institutionId) {
      res.status(403).json({ success: false, error: 'ForbiddenAccess', message: 'Applicants may only create applications for their own institution.' });
      return;
    }

    // Check if institution exists
    const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
    if (!institution) {
      res.status(400).json({ success: false, error: 'InstitutionNotFound' });
      return;
    }

    // Generate readable government application ID: e.g. AICTE-2026-ENG-0491
    const prefixMap: Record<string, string> = {
      ENGINEERING_TECH: 'ENG',
      MANAGEMENT: 'MGT',
      PHARMACY: 'PHR',
      ARCHITECTURE: 'ARC',
      POLYTECHNIC: 'POL',
    };
    const code = prefixMap[category] || 'GEN';
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const generatedId = `AICTE-2026-${code}-${randNum}`;

    const newApp = await prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          id: generatedId, institutionId, category, academicYear, status: 'SUBMITTED',
          currentStage: 'Intake Registration Complete',
          remarks: remarks || 'Initial application filed with configured rules for decision support.',
          submissionDate: new Date(),
        },
        include: { institution: true },
      });
      await writeAuditEvent(tx, {
        actorId: req.user?.id, actorName: req.user?.name || 'Applicant User', actorRole: req.user?.role || 'APPLICANT',
        action: 'APPLICATION_CREATED', entityType: 'Application', entityId: created.id,
        afterState: { id: created.id, institution: institution.name, category: created.category },
        ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });
      return created;
    });

    res.status(201).json({ success: true, data: newApp });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

export async function updateApplicationStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const parsed = UpdateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'ValidationError', details: parsed.error.flatten() });
      return;
    }

    const { newStatus, reason, notes } = parsed.data;

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) {
      res.status(404).json({ success: false, error: 'ApplicationNotFound' });
      return;
    }

    const previousStatus = application.status;

    // Consequential transition requirement
    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.application.update({
        where: { id },
        data: {
          status: newStatus,
          remarks: notes || reason,
          lastEvaluatedAt: new Date(),
        },
      });

      // Record ReviewAction
      if (req.user) {
        await tx.reviewAction.create({
          data: {
            applicationId: id,
            reviewerId: req.user.id,
            actionType: 'STATUS_CHANGE',
            previousStatus,
            newStatus,
            reason,
            notes,
          },
        });
      }

      await writeAuditEvent(tx, {
        actorId: req.user?.id, actorName: req.user?.name || 'Authorized Officer', actorRole: req.user?.role || 'REVIEWER',
        action: 'APPLICATION_STATUS_TRANSITION', entityType: 'Application', entityId: id,
        beforeState: { status: previousStatus }, afterState: { status: newStatus, reason, notes },
        ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });

      return app;
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

export async function triggerValidation(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const application = await prisma.application.findUnique({
      where: { id },
      include: { documents: true },
    });

    if (!application) {
      res.status(404).json({ success: false, error: 'ApplicationNotFound' });
      return;
    }

    if (req.user?.role === 'APPLICANT' && application.institutionId !== req.user.institutionId) {
      res.status(403).json({ success: false, error: 'ForbiddenAccess' });
      return;
    }

    // Run deterministic rules engine
    const findingsResults = await evaluateApplicationCompliance(id);
    const applicableRuleCount = await prisma.validationRule.count({
      where: { isActive: true, OR: [{ category: 'ALL' }, { category: application.category }] },
    });

    // Fetch existing rules from DB to link IDs
    const dbRules = await prisma.validationRule.findMany();
    const ruleCodeMap = new Map(dbRules.map((r) => [r.code, r.id]));

    // Transactionally clear old automated findings and insert new evaluated findings
    await prisma.$transaction(async (tx) => {
      // Delete old automated findings
      await tx.validationFinding.deleteMany({
        where: { applicationId: id },
      });

      // Insert new findings
      for (const resItem of findingsResults) {
        const dbRuleId = ruleCodeMap.get(resItem.ruleCode);
        if (!dbRuleId) continue;

        // Find matching document if applicable
        let matchedDocId: string | undefined = undefined;
        if (resItem.documentType) {
          const doc = application.documents.find((d) => d.documentType === resItem.documentType);
          if (doc) matchedDocId = doc.id;
        }

        await tx.validationFinding.create({
          data: {
            applicationId: id,
            ruleId: dbRuleId,
            ruleVersionId: resItem.ruleVersionId,
            documentId: matchedDocId,
            status: resItem.status,
            severity: resItem.severity,
            title: resItem.title,
            message: resItem.message,
            evidenceLocation: resItem.evidenceLocation,
            evidenceSnippet: resItem.evidenceSnippet,
            evidenceComparisonJson: resItem.evidenceComparison ? JSON.stringify(resItem.evidenceComparison) : null,
          },
        });
      }

      // Automatically determine updated status recommendation
      const hasCriticalDeficiency = findingsResults.some(
        (f) => f.status === 'MANUAL_REVIEW_REQUIRED' ||
          (f.severity === 'CRITICAL' && (f.status === 'MISSING' || f.status === 'EXPIRED' || f.status === 'MISMATCH'))
      );

      const nextStatus = applicableRuleCount === 0
        ? 'UNDER_AUTOMATED_REVIEW'
        : (hasCriticalDeficiency ? 'DEFICIENCY_FLAGGED' : 'VERIFIED_RECOMMENDED');
      const nextStage = applicableRuleCount === 0
        ? 'No active rules apply; human review is required'
        : hasCriticalDeficiency
        ? 'Deficiency Identified — Scrutiny Observations Filed'
        : 'Automated Compliance Scrutiny Clear';

      const evaluatedApplication = await tx.application.update({
        where: { id },
        data: {
          status: application.status === 'APPROVED' ? 'APPROVED' : nextStatus,
          currentStage: nextStage,
          lastEvaluatedAt: new Date(),
        },
      });

      await writeAuditEvent(tx, {
        actorId: req.user?.id, actorName: req.user?.name || 'Regulatory Rules Engine', actorRole: req.user?.role || 'SYSTEM',
        action: 'COMPLIANCE_EVALUATION_EXECUTED', entityType: 'Application', entityId: id,
        beforeState: { status: application.status },
        afterState: { status: evaluatedApplication.status, evaluatedFindingsCount: findingsResults.length },
        ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });
    });

    await raiseAlerts(id, alertsFromFindings(findingsResults));

    const refreshed = await prisma.application.findUnique({
      where: { id },
      include: {
        validationFindings: { include: { rule: true } },
      },
    });

    res.json({ success: true, data: refreshed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

export async function generateValidationReport(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        institution: true,
        assignedReviewer: true,
        documents: {
          include: { extractedFields: true },
        },
        validationFindings: {
          include: { rule: true },
        },
        verificationRequests: true,
        reviewActions: {
          include: { reviewer: { select: { name: true, role: true } } },
        },
      },
    });

    if (!application) {
      res.status(404).json({ success: false, error: 'ApplicationNotFound' });
      return;
    }

    if (req.user?.role === 'APPLICANT' && application.institutionId !== req.user.institutionId) {
      res.status(403).json({ success: false, error: 'ForbiddenAccess' });
      return;
    }

    const reportData = {
      reportTitle: 'BharatSatya Validation Dossier',
      subTitle: 'Application summary and configured validation findings',
      dossierReferenceNumber: `AICTE-DOSSIER-${application.id}-${Date.now().toString().slice(-6)}`,
      generatedAt: new Date().toISOString(),
      generatedBy: req.user?.name || 'Authorized Scrutiny Officer',
      applicationDetails: {
        applicationId: application.id,
        category: application.category,
        academicYear: application.academicYear,
        submissionDate: application.submissionDate,
        currentStatus: application.status,
        currentStage: application.currentStage,
      },
      institutionDetails: {
        name: application.institution.name,
        aictePermanentId: application.institution.aictePermanentId,
        address: `${application.institution.address}, ${application.institution.district}, ${application.institution.state} - ${application.institution.pincode}`,
        contactEmail: application.institution.contactEmail,
        contactPhone: application.institution.contactPhone,
      },
      documentsIntakeSummary: application.documents.map((d) => ({
        documentType: d.documentType,
        originalName: d.originalName,
        sha256Hash: d.fileHashSha256,
        isDuplicate: d.isDuplicate,
        extractedFieldsCount: d.extractedFields.length,
        extractedFields: d.extractedFields.map((f) => ({
          label: f.fieldLabel,
          value: f.fieldValue,
          originalExtracted: f.originalExtractedValue,
          isCorrected: f.isCorrected,
          confidence: f.confidence,
        })),
      })),
      regulatoryFindings: application.validationFindings.map((vf) => ({
        ruleCode: vf.rule.code,
        ruleTitle: vf.rule.title,
        officialReference: vf.rule.officialSourceReference,
        isOfficialClause: vf.rule.isOfficial,
        status: vf.status,
        severity: vf.severity,
        message: vf.message,
        evidenceLocation: vf.evidenceLocation,
        evidenceSnippet: vf.evidenceSnippet,
      })),
      externalSourceVerifications: application.verificationRequests.map((vr) => ({
        provider: vr.provider,
        referenceId: vr.referenceId,
        status: vr.status,
        responseSummary: vr.responseSummary,
        evidenceReference: vr.evidenceReference,
        isDemoSimulation: vr.isDemoSimulation,
      })),
      scrutinyHistory: application.reviewActions.map((ra) => ({
        actionType: ra.actionType,
        officer: ra.reviewer.name,
        transition: ra.previousStatus ? `${ra.previousStatus} -> ${ra.newStatus}` : 'Note/Action',
        reason: ra.reason,
        notes: ra.notes,
        timestamp: ra.createdAt,
      })),
    };

    res.json({ success: true, data: reportData });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}
