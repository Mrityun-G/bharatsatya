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

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  designation?: string;
  institution?: Institution;
}

export interface Institution {
  id: string;
  name: string;
  aictePermanentId: string;
  address: string;
  state: string;
  district: string;
  pincode: string;
  contactEmail: string;
  contactPhone: string;
  establishedYear: number;
  category: string;
}

export interface Application {
  id: string;
  institutionId: string;
  institution: Institution;
  category: string;
  academicYear: string;
  status: ApplicationStatus;
  submissionDate: string;
  lastEvaluatedAt?: string;
  assignedReviewerId?: string;
  assignedReviewer?: {
    id: string;
    name: string;
    email: string;
    designation: string;
    department: string;
  };
  currentStage: string;
  recommendedAction?: string;
  remarks?: string;
  documents?: DocumentItem[];
  validationFindings?: ValidationFinding[];
  verificationRequests?: VerificationRequest[];
  reviewActions?: ReviewAction[];
  auditEvents?: AuditEvent[];
  _count?: {
    documents: number;
    validationFindings: number;
    verificationRequests: number;
  };
}

export interface DocumentItem {
  id: string;
  applicationId: string;
  documentType: DocumentType;
  title: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileHashSha256: string;
  storagePath: string;
  uploadDate: string;
  status: string;
  isDuplicate: boolean;
  duplicateOfDocumentId?: string;
  ocrConfidence?: number;
  ocrRawText?: string;
  extractedFields: ExtractedField[];
}

export interface ExtractedField {
  id: string;
  documentId: string;
  applicationId: string;
  fieldName: string;
  fieldLabel: string;
  fieldValue: string;
  originalExtractedValue: string;
  confidence: number | null;
  isCorrected: boolean;
  correctedByUserId?: string;
  correctedByUser?: {
    id: string;
    name: string;
    role: string;
  };
  correctedAt?: string;
  evidencePage?: number;
  evidenceSnippet?: string;
  evidenceCoordinates?: string;
}

export interface ValidationRule {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  officialSourceReference: string;
  isOfficial: boolean;
  ruleType: string;
  severity: FindingSeverity;
  logicConfigJson: string;
  isActive: boolean;
  version: number;
  effectiveDate: string;
  versions?: ValidationRuleVersion[];
}

export interface ValidationRuleVersion {
  id: string;
  ruleId: string;
  version: number;
  title: string;
  description: string;
  logicConfigJson: string;
  changedByUserId?: string;
  changeReason?: string;
  createdAt: string;
}

export interface ValidationFinding {
  id: string;
  applicationId: string;
  ruleId: string;
  rule: ValidationRule;
  documentId?: string;
  document?: {
    id: string;
    originalName: string;
    documentType: string;
  };
  status: FindingStatus;
  severity: FindingSeverity;
  title: string;
  message: string;
  evidenceLocation?: string;
  evidenceSnippet?: string;
  evidenceComparisonJson?: string;
  reviewerAcknowledged: boolean;
  createdAt: string;
}

export interface VerificationRequest {
  id: string;
  applicationId: string;
  provider: string;
  referenceId: string;
  requestedAt: string;
  completedAt?: string;
  status: string;
  responseSummary: string;
  evidenceReference: string;
  rawResponseJson?: string;
  isDemoSimulation: boolean;
}

export interface ReviewAction {
  id: string;
  applicationId: string;
  reviewerId: string;
  reviewer: {
    name: string;
    role: string;
    designation?: string;
  };
  actionType: string;
  previousStatus?: string;
  newStatus?: string;
  reason: string;
  notes?: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actorId?: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeStateJson?: string;
  afterStateJson?: string;
  ipAddress?: string;
  createdAt: string;
}
