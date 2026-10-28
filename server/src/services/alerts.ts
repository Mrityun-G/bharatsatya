import { prisma } from '../prisma.js';

export type AlertType = 'MISSING' | 'EXPIRED' | 'MISMATCH' | 'PENDING_VERIFICATION' | 'SOURCE_UNAVAILABLE' | 'MANUAL_REVIEW' | 'ANOMALY' | 'INSPECTION';

export interface AlertInput {
  title: string;
  message: string;
  type: AlertType;
}

/**
 * Notifies the officials responsible for an application: the assigned reviewer, or every
 * reviewer and admin when none is assigned. An identical unread alert is not repeated.
 * Alerts are best-effort and never fail the request that raised them.
 */
export async function raiseAlerts(applicationId: string, alerts: AlertInput[]): Promise<void> {
  if (!alerts.length) return;
  try {
    const application = await prisma.application.findUnique({ where: { id: applicationId }, select: { assignedReviewerId: true } });
    if (!application) return;
    const recipients = application.assignedReviewerId
      ? [application.assignedReviewerId]
      : (await prisma.user.findMany({ where: { role: { in: ['REVIEWER', 'ADMIN'] } }, select: { id: true } })).map((u) => u.id);

    for (const userId of recipients) {
      for (const alert of alerts) {
        const existing = await prisma.notification.findFirst({ where: { userId, applicationId, title: alert.title, isRead: false } });
        if (existing) continue;
        await prisma.notification.create({ data: { userId, applicationId, title: alert.title, message: alert.message, type: alert.type } });
      }
    }
  } catch (error) {
    console.error('[BharatSatya Alerts] Could not record alerts', (error as Error).name);
  }
}

/** Summarises evaluated findings into one alert per unresolved status. */
export function alertsFromFindings(findings: { status: string; title: string }[]): AlertInput[] {
  const byStatus: Record<string, { type: AlertType; label: string }> = {
    MISSING: { type: 'MISSING', label: 'Missing information or documents' },
    EXPIRED: { type: 'EXPIRED', label: 'Expired documents' },
    MISMATCH: { type: 'MISMATCH', label: 'Inconsistent information' },
    MANUAL_REVIEW_REQUIRED: { type: 'MANUAL_REVIEW', label: 'Manual review required' },
  };
  return Object.entries(byStatus).flatMap(([status, { type, label }]) => {
    const matching = findings.filter((f) => f.status === status);
    if (!matching.length) return [];
    const names = matching.slice(0, 3).map((f) => f.title).join('; ');
    return [{ type, title: label, message: `${matching.length} item(s): ${names}${matching.length > 3 ? '; …' : ''}` }];
  });
}
