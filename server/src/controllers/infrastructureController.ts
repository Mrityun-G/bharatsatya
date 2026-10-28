import { Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { readForensicReport } from '../forensics/analyzer.js';

const EVIDENCE_TYPES = ['FLOOR_PLAN', 'INFRASTRUCTURE_PHOTO', 'BUILDING_PLAN_APPROVAL', 'OCCUPANCY_CERTIFICATE'];

export type InfrastructureRecommendation =
  | 'PHYSICAL_INSPECTION_SUGGESTED'
  | 'ADDITIONAL_EVIDENCE_REQUESTED'
  | 'EVIDENCE_CONSISTENT'
  | 'NO_INFRASTRUCTURE_RULES';

/**
 * Advisory infrastructure assessment: configured norms (INFRASTRUCTURE_NORM rules) compared
 * with measured values, plus checks on photo and plan evidence. The decision to inspect
 * stays with the competent authority.
 */
export async function getInfrastructureAssessment(req: Request, res: Response): Promise<void> {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.applicationId },
      include: {
        institution: true,
        documents: { where: { documentType: { in: EVIDENCE_TYPES as any } }, include: { extractedFields: true } },
        validationFindings: { where: { rule: { ruleType: 'INFRASTRUCTURE_NORM' } }, include: { rule: true } },
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

    const norms = application.validationFindings.map((f) => {
      const comparison = f.evidenceComparisonJson ? JSON.parse(f.evidenceComparisonJson) : {};
      return {
        id: f.id, ruleCode: f.rule.code, facility: comparison.facility || f.title,
        required: comparison.required ?? null, measured: comparison.measured ?? null, unit: comparison.unit || '',
        status: f.status, message: f.message, evidenceLocation: f.evidenceLocation, citation: f.rule.officialSourceReference,
      };
    });

    const photoHashes = new Map<string, number>();
    for (const d of application.documents) if (d.documentType === 'INFRASTRUCTURE_PHOTO') photoHashes.set(d.fileHashSha256, (photoHashes.get(d.fileHashSha256) || 0) + 1);

    const evidence = application.documents.map((d) => {
      const report = readForensicReport(d.forensicsJson);
      const observations = (report?.indicators || []).map((i) => ({ code: i.code, title: i.title, severity: i.severity, detail: i.reason }));
      if ((photoHashes.get(d.fileHashSha256) || 0) > 1) {
        observations.unshift({ code: 'REUSED_PHOTO', title: 'Same photo used more than once', severity: 'MEDIUM', detail: 'Identical image submitted for different facilities.' });
      }
      return {
        id: d.id, documentType: d.documentType, title: d.title, originalName: d.originalName, uploadDate: d.uploadDate,
        measuredFields: d.extractedFields.map((f) => ({ fieldName: f.fieldName, label: f.fieldLabel, value: f.fieldValue, isCorrected: f.isCorrected })),
        observations,
        result: observations.some((o) => o.severity !== 'LOW') ? 'NEEDS_EVIDENCE' : observations.length ? 'NOTED' : 'CONSISTENT',
      };
    });

    const belowNorm = norms.filter((n) => n.status === 'MISMATCH');
    const unverified = norms.filter((n) => n.status === 'MISSING' || n.status === 'MANUAL_REVIEW_REQUIRED');
    const doubtfulEvidence = evidence.filter((e) => e.result === 'NEEDS_EVIDENCE');

    const reasons = [
      ...belowNorm.map((n) => `${n.facility}: ${n.measured ?? '—'} ${n.unit} measured against ${n.required ?? '—'} ${n.unit} required.`),
      ...unverified.map((n) => `${n.facility}: ${n.message}`),
      ...doubtfulEvidence.map((e) => `${e.title}: ${e.observations.filter((o) => o.severity !== 'LOW').map((o) => o.title).join(', ')}.`),
    ];
    const recommendation: InfrastructureRecommendation = !norms.length && !evidence.length
      ? 'NO_INFRASTRUCTURE_RULES'
      : belowNorm.length ? 'PHYSICAL_INSPECTION_SUGGESTED'
      : unverified.length || doubtfulEvidence.length ? 'ADDITIONAL_EVIDENCE_REQUESTED'
      : 'EVIDENCE_CONSISTENT';

    res.json({
      success: true,
      data: {
        application: { id: application.id, category: application.category, status: application.status, institution: { name: application.institution.name, aictePermanentId: application.institution.aictePermanentId } },
        norms, evidence, recommendation, reasons,
        advisory: 'Automated observations are advisory. Inspection and approval decisions remain with the competent AICTE authority.',
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}
