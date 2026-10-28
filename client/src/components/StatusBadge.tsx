import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<Props> = ({ status, size = 'sm' }) => {
  const { t } = useTranslation();
  const s = (status || '').toUpperCase();
  const translatedLabel = String(t(`status.${s}`, status ? status.replace(/_/g, ' ') : ''));

  let badgeClass = 'gov-badge-pending';
  let dotColor = 'var(--gov-grey-muted)';

  switch (s) {
    case 'PASSED':
    case 'APPROVED':
    case 'VERIFIED':
    case 'VERIFIED_RECOMMENDED':
    case 'COMPLETED':
    case 'EXTRACTED':
      badgeClass = 'gov-badge-passed';
      dotColor = 'var(--gov-green)';
      break;

    case 'FAILED':
    case 'EXTRACTION_FAILED':
    case 'MISSING':
    case 'DEFICIENT':
    case 'DEFICIENCY_FLAGGED':
    case 'REJECTED_NON_COMPLIANT':
      badgeClass = 'gov-badge-failed';
      dotColor = 'var(--gov-red)';
      break;

    case 'EXPIRED':
      badgeClass = 'gov-badge-expired';
      dotColor = 'var(--gov-red)';
      break;

    case 'MISMATCH':
    case 'MISMATCH_DETECTED':
      badgeClass = 'gov-badge-mismatch';
      dotColor = 'var(--gov-amber)';
      break;

    case 'CLARIFICATION_REQUESTED':
    case 'MANUAL_REVIEW_REQUIRED':
      badgeClass = 'gov-badge-review';
      dotColor = 'var(--gov-navy)';
      break;

    case 'SOURCE_UNAVAILABLE':
      badgeClass = 'gov-badge-pending';
      dotColor = 'var(--gov-grey-muted)';
      break;

    case 'PROCESSING':
    case 'UPLOADED':
    case 'SUBMITTED':
    case 'UNDER_AUTOMATED_REVIEW':
    case 'PENDING':
    case 'PENDING_VERIFICATION':
    default:
      badgeClass = 'gov-badge-pending';
      dotColor = 'var(--gov-saffron)';
      break;
  }

  return (
    <span className={`gov-status-badge ${badgeClass} ${size === 'md' ? 'size-md' : 'size-sm'}`}>
      <span className="gov-status-dot" style={{ backgroundColor: dotColor }} aria-hidden="true" />
      <span className="gov-status-text">{translatedLabel}</span>
    </span>
  );
};
