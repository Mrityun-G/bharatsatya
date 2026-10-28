import { prisma } from '../prisma.js';
import { RuleEvaluationResult, FindingSeverity, FindingStatus } from '../types/index.js';

type Rule = {
  id: string; code: string; title: string; description: string; category: string;
  ruleType: string; severity: FindingSeverity; logicConfigJson: string;
  isActive: boolean; version: number; versions: { id: string; version: number; logicConfigJson: string }[];
};

const asStringList = (value: unknown): string[] => Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
const asObject = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(educational|education|technological|technology|technical|institutions|institution|institute|foundations|foundation|societies|society|trusts|trust|colleges|college|academies|academy)/g, '');

/** Evaluates only active database rules applicable to this application's category. */
export async function evaluateApplicationCompliance(applicationId: string): Promise<RuleEvaluationResult[]> {
  const [application, rules] = await Promise.all([
    prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        institution: true,
        documents: {
          orderBy: { createdAt: 'desc' },
          include: { extractedFields: true },
        },
      },
    }),
    prisma.validationRule.findMany({ where: { isActive: true }, include: { versions: { where: { version: { gt: 0 } } } }, orderBy: { code: 'asc' } }),
  ]);
  if (!application) throw new Error(`Application ${applicationId} not found`);

  const docs = application.documents;
  const category = application.category;
  const applicable = rules.filter((rule: Rule) => rule.category === 'ALL' || rule.category === category);
  const output: RuleEvaluationResult[] = [];

  for (const rule of applicable as Rule[]) {
    const snapshot = rule.versions.find((v) => v.version === rule.version);
    if (!snapshot) throw new Error(`Rule ${rule.code} has no stored version ${rule.version}`);
    let config: Record<string, any>;
    try { config = asObject(JSON.parse(snapshot.logicConfigJson)); }
    catch { output.push(result(rule, snapshot.id, 'MANUAL_REVIEW_REQUIRED', 'Rule configuration is invalid JSON; administrator review is required.')); continue; }

    if (rule.ruleType === 'MANDATORY_DOCUMENT') {
      const byCategory = asObject(config.requiredByCategory);
      const required = asStringList(byCategory[category] ?? config.requiredCategories);
      const single = typeof config.documentType === 'string' ? [config.documentType] : [];
      const requirements = [...new Set([...required, ...single])];
      if (!requirements.length) { output.push(result(rule, snapshot.id, 'MANUAL_REVIEW_REQUIRED', 'No required document types are configured for this category.')); continue; }
      const uploaded = new Set<string>(docs.map((d) => d.documentType));
      const missing = requirements.filter((type) => !uploaded.has(type));
      output.push(result(rule, snapshot.id, missing.length ? 'MISSING' : 'PASSED', missing.length ? `Missing configured documents: ${missing.join(', ')}.` : `All ${requirements.length} configured document types are present.`, {
        evidenceLocation: 'Document Intake Repository',
        evidenceSnippet: `Uploaded: ${[...uploaded].join(', ') || 'None'}.`,
        recommendedNextAction: missing.length ? 'Notify applicant institution to upload the missing statutory clearance before proceeding to substantive evaluation.' : 'All mandatory document categories submitted.',
        evidenceComparison: { required: requirements, uploaded: [...uploaded], missing },
      }));
      continue;
    }

    if (rule.ruleType === 'EXPIRY_CHECK') {
      const type = config.documentType;
      const fieldName = config.fieldName || (type === 'FIRE_SAFETY_NOC' ? 'FIRE_NOC_EXPIRY_DATE' : 'EXPIRY_DATE');
      const doc = docs.find((d) => d.documentType === type);
      if (!doc) {
        output.push(result(rule, snapshot.id, 'MISSING', `Configured document ${type} is missing.`, {
          documentType: type,
          recommendedNextAction: 'Applicant institution must upload valid statutory certificate.',
        }));
        continue;
      }
      const field = doc.extractedFields.find((f) => f.fieldName === fieldName && f.fieldValue);
      if (!field) {
        output.push(result(rule, snapshot.id, 'MANUAL_REVIEW_REQUIRED', 'Expiry value is unavailable; a reviewer must inspect the source document.', {
          documentType: type,
          evidenceLocation: doc.originalName,
          recommendedNextAction: 'Review source document manually to verify statutory validity period.',
        }));
        continue;
      }
      const expiry = new Date(field.fieldValue);
      const reference = new Date(config.referenceDate);
      if (Number.isNaN(expiry.getTime()) || Number.isNaN(reference.getTime())) {
        output.push(result(rule, snapshot.id, 'MANUAL_REVIEW_REQUIRED', 'Expiry or reference date could not be parsed.', {
          documentType: type,
          evidenceLocation: doc.originalName,
          evidenceSnippet: field.evidenceSnippet || field.fieldValue,
          recommendedNextAction: 'Inspect document scan to clarify unparseable date text.',
        }));
      } else {
        const status = expiry < reference ? 'EXPIRED' : 'PASSED';
        output.push(result(rule, snapshot.id, status, `Extracted date ${field.fieldValue} is ${status === 'EXPIRED' ? 'before' : 'on or after'} configured reference date ${config.referenceDate}.`, {
          documentType: type,
          evidenceLocation: doc.originalName,
          evidenceSnippet: field.evidenceSnippet || field.fieldValue,
          recommendedNextAction: status === 'EXPIRED' ? 'Request updated valid renewal certificate or issue statutory clarification.' : 'Certificate validity is compliant with regulatory reference horizon.',
          evidenceComparison: {
            isExpired: status === 'EXPIRED',
            extractedExpiryDate: field.fieldValue,
            extractedDate: field.fieldValue,
            referenceDate: config.referenceDate,
          },
        }));
      }
      continue;
    }

    if (rule.ruleType === 'MINIMUM_THRESHOLD') {
      const fieldName = config.fieldName || (config.minimumAcres ? 'LAND_AREA_ACRES' : 'FDR_AMOUNT_INR');
      const type = config.documentType || (fieldName === 'LAND_AREA_ACRES' ? 'LAND_TITLE_DEED' : 'FDR_FINANCIAL_ENDOWMENT');
      const doc = docs.find((d) => d.documentType === type);
      if (!doc) {
        output.push(result(rule, snapshot.id, 'MISSING', `Configured document ${type} is missing.`, {
          documentType: type,
          recommendedNextAction: 'Upload required institutional dossier to assess compliance threshold.',
        }));
        continue;
      }
      const field = doc.extractedFields.find((f) => f.fieldName === fieldName && f.fieldValue);
      if (!field) {
        output.push(result(rule, snapshot.id, 'MANUAL_REVIEW_REQUIRED', `Configured value ${fieldName} is unavailable for reviewer inspection.`, {
          documentType: type,
          evidenceLocation: doc.originalName,
          recommendedNextAction: 'Review source document to extract and record threshold figure manually.',
        }));
        continue;
      }
      const minima = asObject(config.minimumByCategory || config.minimumAcres);
      const minimum = Number(minima[category] ?? config.minimumCorpusInr ?? config.minimum);
      const actual = Number(field.fieldValue.replace(/,/g, ''));
      if (!Number.isFinite(actual) || !Number.isFinite(minimum)) {
        output.push(result(rule, snapshot.id, 'MANUAL_REVIEW_REQUIRED', 'Configured threshold or extracted value is not numeric.', {
          documentType: type,
          evidenceLocation: doc.originalName,
          evidenceSnippet: field.evidenceSnippet || field.fieldValue,
          recommendedNextAction: 'Review numeric figures in uploaded dossier.',
        }));
        continue;
      }
      output.push(result(rule, snapshot.id, actual < minimum ? 'MISMATCH' : 'PASSED', `Extracted value ${actual} ${actual < minimum ? 'is below' : 'meets'} configured minimum ${minimum} for ${category}.`, {
        documentType: type,
        evidenceLocation: doc.originalName,
        evidenceSnippet: field.evidenceSnippet || field.fieldValue,
        recommendedNextAction: actual < minimum ? 'Notify applicant institution of shortfall in statutory minimum norm.' : 'Statutory threshold criteria satisfied.',
        evidenceComparison: { actual, minimum, fieldName, category },
      }));
      continue;
    }

    if (rule.ruleType === 'INFRASTRUCTURE_NORM') {
      // { facility, fieldName, documentType?, unit?, minimum? | minimumByCategory? }
      const facility = config.facility || rule.title;
      const type = config.documentType || 'FLOOR_PLAN';
      const unit = config.unit || '';
      const minima = asObject(config.minimumByCategory);
      const required = Number(minima[category] ?? config.minimum);
      const comparison = (measured: number | null) => ({ facility, required: Number.isFinite(required) ? required : null, measured, unit, fieldName: config.fieldName });
      const doc = docs.find((d) => d.documentType === type && d.extractedFields.some((f) => f.fieldName === config.fieldName && f.fieldValue))
        || docs.find((d) => d.documentType === type);
      if (!doc) {
        output.push(result(rule, snapshot.id, 'MISSING', `No ${type} evidence uploaded for ${facility}.`, {
          documentType: type, evidenceComparison: comparison(null),
          recommendedNextAction: 'Request infrastructure evidence (floor plan, photographs or video) from the institution.',
        }));
        continue;
      }
      const field = doc.extractedFields.find((f) => f.fieldName === config.fieldName && f.fieldValue);
      const measured = field ? Number(field.fieldValue.replace(/,/g, '')) : NaN;
      if (!field || !Number.isFinite(measured) || !Number.isFinite(required)) {
        output.push(result(rule, snapshot.id, 'MANUAL_REVIEW_REQUIRED', `${facility} could not be measured from ${doc.originalName}; a reviewer must record the value.`, {
          documentType: type, evidenceLocation: doc.originalName, evidenceComparison: comparison(null),
          recommendedNextAction: 'Record the measured value from the evidence, or request additional evidence.',
        }));
        continue;
      }
      const below = measured < required;
      output.push(result(rule, snapshot.id, below ? 'MISMATCH' : 'PASSED', `${facility}: ${measured} ${unit} measured ${below ? 'is below' : 'meets'} the configured norm of ${required} ${unit}.`, {
        documentType: type, evidenceLocation: doc.originalName, evidenceSnippet: field.evidenceSnippet || field.fieldValue,
        evidenceComparison: comparison(measured),
        recommendedNextAction: below ? 'Advisory: request additional evidence or recommend physical inspection.' : 'Infrastructure norm satisfied on submitted evidence.',
      }));
      continue;
    }

    if (rule.ruleType === 'CROSS_DOCUMENT_CONSISTENCY') {
      const leftType = config.leftDocumentType || 'LAND_TITLE_DEED';
      const rightType = config.rightDocumentType || 'SOCIETY_TRUST_REGISTRATION';
      const leftDoc = docs.find((d) => d.documentType === leftType);
      const rightDoc = docs.find((d) => d.documentType === rightType);
      const fieldName = config.fieldName || 'INSTITUTION_NAME';
      const left = leftDoc?.extractedFields.find((f) => f.fieldName === fieldName)?.fieldValue;
      const right = rightDoc?.extractedFields.find((f) => f.fieldName === fieldName)?.fieldValue;
      if (!leftDoc || !rightDoc) {
        output.push(result(rule, snapshot.id, 'MANUAL_REVIEW_REQUIRED', 'One or more documents needed for comparison are missing; reviewer inspection is required.', {
          evidenceLocation: `${leftDoc?.originalName || leftType} vs ${rightDoc?.originalName || rightType}`,
          recommendedNextAction: 'Both documents required to conduct cross-document consistency check.',
        }));
        continue;
      }
      if (!left || !right) {
        output.push(result(rule, snapshot.id, 'MANUAL_REVIEW_REQUIRED', 'Comparison values are incomplete; reviewer inspection is required.', {
          evidenceLocation: `${leftDoc.originalName} vs ${rightDoc.originalName}`,
          recommendedNextAction: 'Inspect uploaded documents to clarify entity name representations.',
        }));
        continue;
      }
      const a = norm(left), b = norm(right);
      const matches = a === b || a.includes(b) || b.includes(a);
      output.push(result(rule, snapshot.id, matches ? 'PASSED' : 'MISMATCH', matches ? 'Configured cross-document values align.' : 'Configured cross-document values differ and require reviewer inspection.', {
        documentType: leftType,
        evidenceLocation: `${leftDoc.originalName} vs ${rightDoc.originalName}`,
        evidenceSnippet: `${left} | ${right}`,
        recommendedNextAction: matches ? 'Cross-document entity names consistent.' : 'Require institution to clarify legal relationship between land title holder and applicant trust.',
        evidenceComparison: {
          landDeedEntityName: left,
          societyRegistrationEntityName: right,
          left,
          right,
          fieldName,
        },
      }));
      continue;
    }

    if (rule.ruleType === 'DUPLICATE_CHECK') {
      const seen = new Map<string, string>();
      for (const doc of docs) {
        if (!doc.fileHashSha256) continue;
        const previous = seen.get(doc.fileHashSha256);
        if (previous) {
          output.push(result(rule, snapshot.id, 'MISMATCH', 'Document has an identical SHA-256 byte digest uploaded more than once.', {
            documentType: doc.documentType,
            evidenceLocation: `${doc.originalName} vs ${previous}`,
            recommendedNextAction: 'Inspect identical uploads to confirm separate statutory documents were not conflated.',
            evidenceComparison: { duplicate: doc.originalName, original: previous },
          }));
        } else {
          seen.set(doc.fileHashSha256, doc.originalName);
        }
      }
      if (!output.some((finding) => finding.ruleCode === rule.code)) {
        output.push(result(rule, snapshot.id, 'PASSED', 'No matching file hashes were found among the uploaded documents.', {
          recommendedNextAction: 'Cryptographic document uniqueness confirmed.',
        }));
      }
      continue;
    }

    if (rule.ruleType === 'MANDATORY_FIELD_CHECK') {
      const type = config.documentType;
      const requiredFields = asStringList(config.requiredFields || ['REGISTRATION_REF_NO', 'ISSUING_AUTHORITY']);
      const targetDocs = docs.filter((d) => !type || d.documentType === type);
      if (!targetDocs.length) {
        output.push(result(rule, snapshot.id, 'MISSING', `Target document ${type || 'required'} is not yet uploaded for field completeness check.`, {
          documentType: type,
          recommendedNextAction: 'Upload the required statutory dossier before evaluating field completeness.',
        }));
        continue;
      }
      let allFieldsPassed = true;
      for (const doc of targetDocs) {
        const presentFields = new Set(doc.extractedFields.filter((f) => f.fieldValue && f.fieldValue.trim()).map((f) => f.fieldName));
        const missingFields = requiredFields.filter((rf) => !presentFields.has(rf));
        if (missingFields.length > 0) {
          allFieldsPassed = false;
          output.push(result(rule, snapshot.id, 'MISSING', `Required statutory field(s) [${missingFields.join(', ')}] not found in uploaded ${doc.originalName || doc.documentType}.`, {
            documentType: doc.documentType,
            evidenceLocation: doc.originalName,
            recommendedNextAction: 'Review source document manually to record missing statutory references or request clear resubmission.',
            evidenceComparison: {
              expectedFields: requiredFields,
              presentFields: [...presentFields],
              missingFields,
              document: doc.originalName,
            },
          }));
        }
      }
      if (allFieldsPassed) {
        output.push(result(rule, snapshot.id, 'PASSED', `All required statutory fields are present across evaluated documents.`, {
          recommendedNextAction: 'Field completeness satisfied.',
          evidenceComparison: { requiredFields },
        }));
      }
      continue;
    }

    if (rule.ruleType === 'DATE_CONSISTENCY') {
      let dateMismatchFound = false;
      for (const doc of docs) {
        const issueField = doc.extractedFields.find((f) => f.fieldName === 'ISSUE_DATE' && f.fieldValue);
        const expiryField = doc.extractedFields.find((f) => (f.fieldName === 'EXPIRY_DATE' || f.fieldName === 'FIRE_NOC_EXPIRY_DATE') && f.fieldValue);
        if (issueField && expiryField) {
          const issueDate = new Date(issueField.fieldValue);
          const expiryDate = new Date(expiryField.fieldValue);
          if (!Number.isNaN(issueDate.getTime()) && !Number.isNaN(expiryDate.getTime())) {
            if (expiryDate <= issueDate) {
              dateMismatchFound = true;
              output.push(result(rule, snapshot.id, 'MISMATCH', `Inconsistent statutory dates in ${doc.originalName}: Expiry date (${expiryField.fieldValue}) is on or before Issue date (${issueField.fieldValue}).`, {
                documentType: doc.documentType,
                evidenceLocation: doc.originalName,
                evidenceSnippet: `Issue: ${issueField.fieldValue} | Expiry: ${expiryField.fieldValue}`,
                recommendedNextAction: 'Flag deficiency: document indicates non-chronological order validity sequence.',
                evidenceComparison: {
                  issueDate: issueField.fieldValue,
                  expiryDate: expiryField.fieldValue,
                  inconsistent: true,
                },
              }));
            }
          }
        }
      }
      if (!dateMismatchFound) {
        output.push(result(rule, snapshot.id, 'PASSED', 'Statutory order issue and expiry dates follow valid chronological sequence across submitted documents.', {
          recommendedNextAction: 'Chronological date consistency verified.',
        }));
      }
      continue;
    }

    if (rule.ruleType === 'IDENTIFIER_CONSISTENCY') {
      let idMismatchFound = false;
      const expectedPid = application.institution.aictePermanentId;
      for (const doc of docs) {
        const pidField = doc.extractedFields.find((f) => f.fieldName === 'AICTE_PERMANENT_ID' && f.fieldValue);
        if (pidField) {
          const observedPid = pidField.fieldValue.trim();
          if (observedPid && observedPid !== expectedPid) {
            idMismatchFound = true;
            output.push(result(rule, snapshot.id, 'MISMATCH', `Document contains AICTE Permanent ID '${observedPid}' which does not match authorized institution ID '${expectedPid}'.`, {
              documentType: doc.documentType,
              evidenceLocation: doc.originalName,
              evidenceSnippet: pidField.evidenceSnippet || observedPid,
              recommendedNextAction: 'Issue deficiency notice: submitted certificate cites a different AICTE Permanent Institute ID.',
              evidenceComparison: {
                expectedPermanentId: expectedPid,
                observedPermanentId: observedPid,
                document: doc.originalName,
              },
            }));
          }
        }
      }
      if (!idMismatchFound) {
        output.push(result(rule, snapshot.id, 'PASSED', `Extracted institutional identifiers align with authorized application record (${expectedPid}).`, {
          recommendedNextAction: 'Institutional identifier consistency verified.',
        }));
      }
      continue;
    }

    if (rule.ruleType === 'FORMAT_VALIDITY') {
      output.push(result(rule, snapshot.id, 'MANUAL_REVIEW_REQUIRED', 'Statutory order authenticity and registration format require officer verification.', {
        recommendedNextAction: 'Officer must inspect registration order against state society registrar records.',
      }));
      continue;
    }

    // Unknown or not-yet-implemented rule types never pass silently.
    output.push(result(rule, snapshot.id, 'MANUAL_REVIEW_REQUIRED', `Rule type ${rule.ruleType} requires a reviewer because no deterministic evaluator is configured.`, {
      recommendedNextAction: 'Reviewer manual evaluation required for unconfigured rule type.',
    }));
  }
  return output;
}

function result(rule: Rule, ruleVersionId: string, status: FindingStatus, message: string, extra: Partial<RuleEvaluationResult> = {}): RuleEvaluationResult {
  return { ruleCode: rule.code, ruleVersionId, status, severity: rule.severity, title: rule.title, message, ...extra };
}
