import { Request, Response } from 'express';
import { prisma } from '../prisma.js';

export async function getDashboardOverview(req: Request, res: Response): Promise<void> {
  try {
    const userRole = req.user?.role;
    const userInstitutionId = req.user?.institutionId;

    // Filter by institution if applicant
    const whereApp = userRole === 'APPLICANT'
      ? { institutionId: userInstitutionId || '__unassigned_applicant__' }
      : {};

    const [
      totalApplications,
      applicationsByStatus,
      totalFindings,
      findingsByStatus,
      recentApplications,
      recentAuditEvents,
    ] = await Promise.all([
      prisma.application.count({ where: whereApp }),
      prisma.application.groupBy({
        by: ['status'],
        _count: { id: true },
        where: whereApp,
      }),
      prisma.validationFinding.count({
        where: userRole === 'APPLICANT' ? { application: { institutionId: userInstitutionId || '__unassigned_applicant__' } } : {},
      }),
      prisma.validationFinding.groupBy({
        by: ['status'],
        _count: { id: true },
        where: userRole === 'APPLICANT' ? { application: { institutionId: userInstitutionId || '__unassigned_applicant__' } } : {},
      }),
      prisma.application.findMany({
        where: whereApp,
        include: {
          institution: true,
          assignedReviewer: { select: { id: true, name: true, designation: true } },
          _count: { select: { documents: true, validationFindings: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      prisma.auditEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);

    // Format status maps
    const statusMap: Record<string, number> = {};
    applicationsByStatus.forEach((item) => {
      statusMap[item.status] = item._count.id;
    });

    const findingStatusMap: Record<string, number> = {};
    findingsByStatus.forEach((item) => {
      findingStatusMap[item.status] = item._count.id;
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalApplications,
          pendingReview: (statusMap['SUBMITTED'] || 0) + (statusMap['UNDER_AUTOMATED_REVIEW'] || 0),
          clarificationRequested: statusMap['CLARIFICATION_REQUESTED'] || 0,
          verifiedRecommended: statusMap['VERIFIED_RECOMMENDED'] || 0,
          approved: statusMap['APPROVED'] || 0,
          rejected: statusMap['REJECTED_NON_COMPLIANT'] || 0,
          deficiencies: {
            missingDocuments: findingStatusMap['MISSING'] || 0,
            expiredDocuments: findingStatusMap['EXPIRED'] || 0,
            mismatches: findingStatusMap['MISMATCH'] || 0,
            manualReviewRequired: findingStatusMap['MANUAL_REVIEW_REQUIRED'] || 0,
            passed: findingStatusMap['PASSED'] || 0,
            totalFindings,
          },
        },
        statusDistribution: statusMap,
        recentApplications,
        recentAuditEvents,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}
