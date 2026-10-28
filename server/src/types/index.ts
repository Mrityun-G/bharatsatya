export type UserRole = 'APPLICANT' | 'REVIEWER' | 'ADMIN';

export type ApplicationStatus =
  | 'SUBMITTED'
  | 'UNDER_AUTOMATED_REVIEW'
  | 'DEFICIENCY_FLAGGED'
  | 'CLARIFICATION_REQUESTED'
  | 'VERIFIED_RECOMMENDED'
  | 'REJECTED_NON_COMPLIANT'
  | 'APPROVED';

export type DocumentType =
  | 'LAND_TITLE_DEED'
  | 'BUILDING_PLAN_APPROVAL'
  | 'FIRE_SAFETY_NOC'
  | 'OCCUPANCY_CERTIFICATE'
  | 'SOCIETY_TRUST_REGISTRATION'
  | 'FDR_FINANCIAL_ENDOWMENT'
  | 'AICTE_PREVIOUS_EOA'
  | 'FLOOR_PLAN'
  | 'INFRASTRUCTURE_PHOTO';

export type FindingStatus =
  | 'PASSED'
  | 'MISSING'
  | 'EXPIRED'
  | 'MISMATCH'
  | 'PENDING_VERIFICATION'
  | 'MANUAL_REVIEW_REQUIRED';

export type FindingSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';

export type VerificationStatus =
  | 'VERIFIED'
  | 'MISMATCH_DETECTED'
  | 'EXPIRED'
  | 'PENDING'
  | 'SOURCE_UNAVAILABLE'
  | 'MANUAL_REVIEW_REQUIRED';

export interface ExtractedFieldItem {
  fieldName: string;
  fieldLabel: string;
  fieldValue: string;
  originalExtractedValue: string;
  confidence: number | null;
  evidencePage?: number;
  evidenceSnippet?: string;
  evidenceCoordinates?: { x: number; y: number; w: number; h: number };
}

export interface RuleEvaluationResult {
  ruleCode: string;
  ruleVersionId: string;
  status: FindingStatus;
  severity: FindingSeverity;
  title: string;
  message: string;
  recommendedNextAction?: string;
  documentType?: DocumentType;
  evidenceLocation?: string;
  evidenceSnippet?: string;
  evidenceComparison?: Record<string, any>;
}

export interface VerificationAdapterResult {
  provider: string;
  referenceId: string;
  requestedAt: Date;
  status: VerificationStatus;
  responseSummary: string;
  evidenceReference: string;
  rawResponse?: Record<string, any>;
  isDemoSimulation: boolean;
}
