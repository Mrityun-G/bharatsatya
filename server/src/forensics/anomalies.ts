import { prisma } from '../prisma.js';
import { ForensicIndicator, IndicatorSeverity, readForensicReport } from './analyzer.js';

export interface AnomalyFlag extends ForensicIndicator {
  id: string;
  applicationId: string;
  institutionName: string;
  documentId?: string;
  documentName?: string;
  documentType?: string;
}

const SEVERITY_ORDER: Record<IndicatorSeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Collects preliminary anomaly indicators for the given applications: stored upload
 * forensics, duplicates within and across applications, irregular dates and identifier
 * mismatches already raised by the rules engine, and low-confidence extraction.
 */
export async function collectAnomalies(where: { applicationId?: string; institutionId?: string } = {}): Promise<AnomalyFlag[]> {
  const applications = await prisma.application.findMany({
    where: {
      ...(where.applicationId ? { id: where.applicationId } : {}),
      ...(where.institutionId ? { institutionId: where.institutionId } : {}),
    },
    include: {
      institution: true,
      documents: { include: { extractedFields: true } },
      validationFindings: { include: { rule: true, document: true } },
    },
  });

  const hashes = applications.flatMap((a) => a.documents.map((d) => d.fileHashSha256));
  const sharedElsewhere = await prisma.document.findMany({
    where: { fileHashSha256: { in: hashes } },
    select: { id: true, fileHashSha256: true, applicationId: true, application: { select: { institutionId: true } } },
  });

  const flags: AnomalyFlag[] = [];
  for (const app of applications) {
    const base = { applicationId: app.id, institutionName: app.institution.name };

    for (const doc of app.documents) {
      const docRef = { documentId: doc.id, documentName: doc.originalName, documentType: doc.documentType };
      const report = readForensicReport(doc.forensicsJson);
      for (const indicator of report?.indicators || []) {
        flags.push({ ...indicator, ...base, ...docRef, id: `${doc.id}:${indicator.code}` });
      }

      const otherInstitution = sharedElsewhere.find((d) => d.fileHashSha256 === doc.fileHashSha256 && d.id !== doc.id && d.application.institutionId !== app.institutionId);
      if (otherInstitution) {
        flags.push({
          ...base, ...docRef, id: `${doc.id}:CROSS_INSTITUTION_DUPLICATE`,
          code: 'CROSS_INSTITUTION_DUPLICATE', title: 'Same file submitted by another institution', severity: 'HIGH',
          evidence: `SHA-256 ${doc.fileHashSha256.slice(0, 12)}… also in application ${otherInstitution.applicationId}`,
          reason: 'A byte-identical document was uploaded for a different institution.',
          nextStep: 'Hold both cases and compare the documents side by side.',
        });
      } else if (doc.isDuplicate) {
        flags.push({
          ...base, ...docRef, id: `${doc.id}:DUPLICATE_UPLOAD`,
          code: 'DUPLICATE_UPLOAD', title: 'Same file uploaded twice', severity: 'MEDIUM',
          evidence: `SHA-256 ${doc.fileHashSha256.slice(0, 12)}… matches another upload in this application`,
          reason: 'One file may have been used to fill two different statutory document slots.',
          nextStep: 'Confirm each slot holds the correct document.',
        });
      }

      const issue = doc.extractedFields.find((f) => f.fieldName === 'ISSUE_DATE' && f.fieldValue);
      const issueDate = issue ? new Date(issue.fieldValue) : undefined;
      const createdAt = report?.metadata.createdAt ? new Date(report.metadata.createdAt) : undefined;
      if (issueDate && createdAt && !Number.isNaN(issueDate.getTime()) && createdAt.getTime() - issueDate.getTime() > 2 * YEAR_MS) {
        flags.push({
          ...base, ...docRef, id: `${doc.id}:CREATED_LONG_AFTER_ISSUE`,
          code: 'CREATED_LONG_AFTER_ISSUE', title: 'File created long after stated issue date', severity: 'LOW',
          evidence: `Issue date ${issue!.fieldValue}; file created ${createdAt.toISOString().slice(0, 10)}`,
          reason: 'The digital file is much newer than the certificate it claims to be.',
          nextStep: 'Request the originally issued copy.',
        });
      }

      if (doc.ocrConfidence !== null && doc.ocrConfidence !== undefined && doc.ocrConfidence < 0.6) {
        flags.push({
          ...base, ...docRef, id: `${doc.id}:LOW_EXTRACTION_CONFIDENCE`,
          code: 'LOW_EXTRACTION_CONFIDENCE', title: 'Text could not be read reliably', severity: 'LOW',
          evidence: `OCR confidence ${doc.ocrConfidence.toFixed(2)}`,
          reason: 'Poor scans hide alterations and make extracted values unreliable.',
          nextStep: 'Check extracted fields against the document by eye.',
        });
      }
    }

    for (const finding of app.validationFindings) {
      if (finding.status !== 'MISMATCH') continue;
      const kind = finding.rule.ruleType === 'IDENTIFIER_CONSISTENCY' ? 'MISMATCHED_IDENTIFIER'
        : finding.rule.ruleType === 'DATE_CONSISTENCY' ? 'IRREGULAR_DATES' : null;
      if (!kind) continue;
      flags.push({
        ...base, id: `${finding.id}:${kind}`,
        documentId: finding.documentId || undefined, documentName: finding.document?.originalName, documentType: finding.document?.documentType,
        code: kind,
        title: kind === 'MISMATCHED_IDENTIFIER' ? 'Identifier does not match the record' : 'Dates out of sequence',
        severity: 'HIGH',
        evidence: finding.evidenceSnippet || finding.message,
        reason: `${finding.rule.code}: ${finding.message}`,
        nextStep: 'Verify the identifier or dates with the issuing authority.',
      });
    }
  }

  return flags.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
