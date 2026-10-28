import { describe, expect, it, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFileSync } from 'child_process';
import { parseDocumentFile, fallbackExtractFields, normalizeDate } from '../ocr/extractor.js';
import { hasAllowedFileSignature, computeFileSha256 } from '../middleware/upload.js';
import { evaluateApplicationCompliance } from '../rules/engine.js';
import { uploadDocument, downloadDocument, updateExtractedField, createExtractedField } from '../controllers/documentController.js';

// Hoist mocks for controller unit tests
const mocks = vi.hoisted(() => ({
  applicationFindUnique: vi.fn(),
  documentFindFirst: vi.fn(),
  documentFindUnique: vi.fn(),
  extractedFieldFindUnique: vi.fn(),
  extractedFieldUpdate: vi.fn(),
  extractedFieldCreate: vi.fn(),
  validationRuleFindMany: vi.fn(),
  transaction: vi.fn(),
  storage: {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
  },
}));

vi.mock('../prisma.js', () => ({
  prisma: {
    application: { findUnique: mocks.applicationFindUnique },
    document: {
      findFirst: mocks.documentFindFirst,
      findUnique: mocks.documentFindUnique,
      create: vi.fn(),
    },
    extractedField: {
      findUnique: mocks.extractedFieldFindUnique,
      update: mocks.extractedFieldUpdate,
      create: mocks.extractedFieldCreate,
    },
    validationRule: { findMany: mocks.validationRuleFindMany },
    validationFinding: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../storage/provider.js', () => ({
  getDocumentStorage: () => mocks.storage,
}));

vi.mock('../services/audit.js', () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

const python = process.platform === 'win32' ? 'python' : 'python3';

function mockResponse() {
  const res: any = { statusCode: 200, headers: {}, body: undefined };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.setHeader = vi.fn((name: string, value: string) => {
    res.headers[name] = value;
  });
  res.destroy = vi.fn();
  return res;
}

describe('BharatSatya Milestone 3: Document Intelligence & Evidence Validation Suite', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bharatsatya-m3-test-'));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Clean digital PDF with full structured field extraction
  it('Scenario 1: Clean digital PDF extracts complete statutory fields including AICTE PID, Intake and Validity', async () => {
    const pdfPath = path.join(tempDir, 'clean_approval_order.pdf');
    execFileSync(python, [
      '-c',
      `
import fitz, sys
d = fitz.open()
p = d.new_page()
p.insert_text((72, 72), 'ALL INDIA COUNCIL FOR TECHNICAL EDUCATION\\nApproval Process Bureau, New Delhi\\nAICTE Permanent ID: 1-10923481\\nApplication Ref No: AICTE-2026-ENG-4821\\nInstitution Name: Vidya Jyothi Institute of Technology\\nProgramme Name: Computer Science and Engineering\\nApproved Intake: 180\\nDate of Issue: 2024-05-10\\nValid Up To: 2027-05-09\\nValidity Status: APPROVED\\nIssuing Authority: Member Secretary AICTE\\n')
d.save(sys.argv[1])
`,
      pdfPath,
    ]);

    const result = await parseDocumentFile(pdfPath, 'application/pdf', 'AICTE_PREVIOUS_EOA');
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    expect(result.error).toBeUndefined();
    expect(result.confidence).toBeNull(); // Must remain uninvented

    // Check extracted fields
    const pidField = result.fields.find((f) => f.fieldName === 'AICTE_PERMANENT_ID');
    expect(pidField).toBeDefined();
    expect(pidField?.fieldValue).toBe('1-10923481');
    expect(pidField?.evidencePage).toBe(1);

    const appRefField = result.fields.find((f) => f.fieldName === 'APPLICATION_REF_NO');
    expect(appRefField).toBeDefined();
    expect(appRefField?.fieldValue).toBe('AICTE-2026-ENG-4821');

    const intakeField = result.fields.find((f) => f.fieldName === 'APPROVED_INTAKE');
    expect(intakeField).toBeDefined();
    expect(intakeField?.fieldValue).toBe('180');

    const statusField = result.fields.find((f) => f.fieldName === 'VALIDITY_STATUS');
    expect(statusField).toBeDefined();
    expect(statusField?.fieldValue).toBe('APPROVED');

    const instField = result.fields.find((f) => f.fieldName === 'INSTITUTION_NAME');
    expect(instField?.fieldValue).toBe('Vidya Jyothi Institute of Technology');

    const progField = result.fields.find((f) => f.fieldName === 'PROGRAMME_NAME');
    expect(progField?.fieldValue).toBe('Computer Science and Engineering');
  }, 25000);

  // 2. Missing required statutory field in document
  it('Scenario 2: Missing required statutory field is flagged by validation engine', async () => {
    const appWithIncompleteDoc = {
      id: 'APP-TEST-MISSING-FIELD',
      category: 'ENGINEERING_TECH',
      institution: {
        id: 'INST-01',
        name: 'Vidya Jyothi Institute of Technology',
        aictePermanentId: '1-10923481',
      },
      documents: [
        {
          id: 'DOC-FIRE-NO-REF',
          documentType: 'FIRE_SAFETY_NOC',
          originalName: 'Fire_NOC_Without_Ref.pdf',
          fileHashSha256: 'hash-abc-123',
          extractedFields: [
            { fieldName: 'INSTITUTION_NAME', fieldValue: 'Vidya Jyothi Institute of Technology' },
            // Note: REGISTRATION_REF_NO and EXPIRY_DATE are missing
          ],
        },
      ],
    };

    mocks.applicationFindUnique.mockResolvedValueOnce(appWithIncompleteDoc);
    mocks.validationRuleFindMany.mockResolvedValueOnce([
      {
        id: 'rule-field-check',
        code: 'RULE-APH-09',
        title: 'Mandatory Statutory Field Completeness',
        category: 'ALL',
        ruleType: 'MANDATORY_FIELD_CHECK',
        severity: 'MAJOR',
        isActive: true,
        version: 1,
        versions: [
          {
            id: 'v1',
            version: 1,
            logicConfigJson: JSON.stringify({
              documentType: 'FIRE_SAFETY_NOC',
              requiredFields: ['REGISTRATION_REF_NO'],
            }),
          },
        ],
      },
    ]);

    const findings = await evaluateApplicationCompliance('APP-TEST-MISSING-FIELD');
    expect(findings.length).toBe(1);
    expect(findings[0].status).toBe('MISSING');
    expect(findings[0].message).toContain('REGISTRATION_REF_NO');
    expect(findings[0].recommendedNextAction).toBeTruthy();
    expect(findings[0].evidenceComparison?.missingFields).toContain('REGISTRATION_REF_NO');
  });

  // 3. Expired certificate detection
  it('Scenario 3: Expired certificate creates an evidence-linked EXPIRED finding', async () => {
    const appWithExpiredCert = {
      id: 'APP-TEST-EXPIRED',
      category: 'ENGINEERING_TECH',
      institution: { id: 'INST-01', name: 'VJIT', aictePermanentId: '1-10923481' },
      documents: [
        {
          id: 'DOC-EXPIRED-FIRE',
          documentType: 'FIRE_SAFETY_NOC',
          originalName: 'Expired_Fire_NOC.pdf',
          fileHashSha256: 'hash-exp-123',
          extractedFields: [
            {
              fieldName: 'FIRE_NOC_EXPIRY_DATE',
              fieldValue: '2023-12-31',
              evidenceSnippet: 'Valid Up To: 31/12/2023',
            },
          ],
        },
      ],
    };

    mocks.applicationFindUnique.mockResolvedValueOnce(appWithExpiredCert);
    mocks.validationRuleFindMany.mockResolvedValueOnce([
      {
        id: 'rule-exp',
        code: 'RULE-APH-02',
        title: 'Fire Safety NOC Validity Assessment',
        category: 'ALL',
        ruleType: 'EXPIRY_CHECK',
        severity: 'CRITICAL',
        isActive: true,
        version: 1,
        versions: [
          {
            id: 'v1',
            version: 1,
            logicConfigJson: JSON.stringify({ referenceDate: '2026-06-30', documentType: 'FIRE_SAFETY_NOC' }),
          },
        ],
      },
    ]);

    const findings = await evaluateApplicationCompliance('APP-TEST-EXPIRED');
    expect(findings.length).toBe(1);
    expect(findings[0].status).toBe('EXPIRED');
    expect(findings[0].severity).toBe('CRITICAL');
    expect(findings[0].evidenceComparison?.isExpired).toBe(true);
    expect(findings[0].recommendedNextAction).toContain('Request updated valid renewal');
  });

  // 4. Chronological date sequence inconsistency
  it('Scenario 4: Inconsistent dates (expiry before issue date) flags a MISMATCH', async () => {
    const appWithInconsistentDates = {
      id: 'APP-TEST-DATE-SEQ',
      category: 'ENGINEERING_TECH',
      institution: { id: 'INST-01', name: 'VJIT', aictePermanentId: '1-10923481' },
      documents: [
        {
          id: 'DOC-INCONSISTENT-DATE',
          documentType: 'FIRE_SAFETY_NOC',
          originalName: 'Inconsistent_Dates_NOC.pdf',
          fileHashSha256: 'hash-date-123',
          extractedFields: [
            { fieldName: 'ISSUE_DATE', fieldValue: '2026-01-10' },
            { fieldName: 'EXPIRY_DATE', fieldValue: '2024-01-09' }, // Expiry BEFORE issue!
          ],
        },
      ],
    };

    mocks.applicationFindUnique.mockResolvedValueOnce(appWithInconsistentDates);
    mocks.validationRuleFindMany.mockResolvedValueOnce([
      {
        id: 'rule-date-seq',
        code: 'RULE-APH-10',
        title: 'Statutory Order Chronological Date Sequence',
        category: 'ALL',
        ruleType: 'DATE_CONSISTENCY',
        severity: 'CRITICAL',
        isActive: true,
        version: 1,
        versions: [
          {
            id: 'v1',
            version: 1,
            logicConfigJson: JSON.stringify({ checkChronology: true }),
          },
        ],
      },
    ]);

    const findings = await evaluateApplicationCompliance('APP-TEST-DATE-SEQ');
    expect(findings.length).toBe(1);
    expect(findings[0].status).toBe('MISMATCH');
    expect(findings[0].message).toContain('Inconsistent statutory dates');
    expect(findings[0].evidenceComparison?.inconsistent).toBe(true);
  });

  // 5. Mismatched institution identifier
  it('Scenario 5: Document AICTE Permanent ID mismatch flags a CRITICAL MISMATCH', async () => {
    const appWithMismatchedId = {
      id: 'APP-TEST-ID-MISMATCH',
      category: 'ENGINEERING_TECH',
      institution: {
        id: 'INST-01',
        name: 'Vidya Jyothi Institute of Technology',
        aictePermanentId: '1-10923481',
      },
      documents: [
        {
          id: 'DOC-WRONG-PID',
          documentType: 'AICTE_PREVIOUS_EOA',
          originalName: 'Other_College_EOA.pdf',
          fileHashSha256: 'hash-wrong-pid',
          extractedFields: [
            { fieldName: 'AICTE_PERMANENT_ID', fieldValue: '1-99999999' }, // Mismatched!
          ],
        },
      ],
    };

    mocks.applicationFindUnique.mockResolvedValueOnce(appWithMismatchedId);
    mocks.validationRuleFindMany.mockResolvedValueOnce([
      {
        id: 'rule-id-align',
        code: 'RULE-APH-11',
        title: 'Institutional Permanent Identifier Alignment',
        category: 'ALL',
        ruleType: 'IDENTIFIER_CONSISTENCY',
        severity: 'CRITICAL',
        isActive: true,
        version: 1,
        versions: [
          {
            id: 'v1',
            version: 1,
            logicConfigJson: JSON.stringify({ checkPermanentId: true }),
          },
        ],
      },
    ]);

    const findings = await evaluateApplicationCompliance('APP-TEST-ID-MISMATCH');
    expect(findings.length).toBe(1);
    expect(findings[0].status).toBe('MISMATCH');
    expect(findings[0].evidenceComparison?.expectedPermanentId).toBe('1-10923481');
    expect(findings[0].evidenceComparison?.observedPermanentId).toBe('1-99999999');
    expect(findings[0].recommendedNextAction).toContain('Issue deficiency notice');
  });

  // 6. Two identical files with different filenames produce identical SHA-256 and duplicate detection
  it('Scenario 6: Two identical files with different filenames compute identical SHA-256 hash and trigger DUPLICATE_CHECK', async () => {
    const fileContent = Buffer.from('%PDF-1.4 Identical duplicate test payload for cryptographic verification');
    const hash1 = await computeFileSha256(fileContent);
    const hash2 = await computeFileSha256(fileContent);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex string

    const appWithDuplicate = {
      id: 'APP-TEST-DUP',
      category: 'ENGINEERING_TECH',
      institution: { id: 'INST-01', name: 'VJIT', aictePermanentId: '1-10923481' },
      documents: [
        {
          id: 'DOC-ORIGINAL',
          documentType: 'LAND_TITLE_DEED',
          originalName: 'Original_Deed.pdf',
          fileHashSha256: hash1,
          extractedFields: [],
        },
        {
          id: 'DOC-DUPLICATE',
          documentType: 'BUILDING_PLAN_APPROVAL',
          originalName: 'Disguised_Duplicate_Deed.pdf',
          fileHashSha256: hash2,
          extractedFields: [],
        },
      ],
    };

    mocks.applicationFindUnique.mockResolvedValueOnce(appWithDuplicate);
    mocks.validationRuleFindMany.mockResolvedValueOnce([
      {
        id: 'rule-dup',
        code: 'RULE-APH-08',
        title: 'Cryptographic Document Integrity & Duplicate Detection',
        category: 'ALL',
        ruleType: 'DUPLICATE_CHECK',
        severity: 'CRITICAL',
        isActive: true,
        version: 1,
        versions: [
          {
            id: 'v1',
            version: 1,
            logicConfigJson: JSON.stringify({ algorithm: 'SHA-256' }),
          },
        ],
      },
    ]);

    const findings = await evaluateApplicationCompliance('APP-TEST-DUP');
    expect(findings.length).toBe(1);
    expect(findings[0].status).toBe('MISMATCH');
    expect(findings[0].evidenceComparison?.duplicate).toBe('Disguised_Duplicate_Deed.pdf');
    expect(findings[0].evidenceComparison?.original).toBe('Original_Deed.pdf');
  });

  // 7. Scanned PDF fallback reports limitation without false success
  it('Scenario 7: Scanned PDF without embedded text reports limitation error safely', async () => {
    const scannedPath = path.join(tempDir, 'blank_scanned_test.pdf');
    execFileSync(python, ['-c', 'import fitz, sys; d = fitz.open(); d.new_page(); d.save(sys.argv[1])', scannedPath]);

    const result = await parseDocumentFile(scannedPath, 'application/pdf', 'LAND_TITLE_DEED');
    if (fs.existsSync(scannedPath)) fs.unlinkSync(scannedPath);

    expect(result.error).toBeTruthy();
    expect(result.fields).toEqual([]);
    expect(result.isRecoverable).toBe(true);
  }, 25000);

  // 8. Malformed or unsupported file rejected safely
  it('Scenario 8: Rejects malformed and disguised binary files safely', () => {
    const emptyBuf = Buffer.alloc(0);
    expect(hasAllowedFileSignature(emptyBuf, 'application/pdf')).toBe(false);

    const disguisedExe = Buffer.from('MZ\x90\x00\x03\x00\x00\x00WindowsExecutableContent');
    expect(hasAllowedFileSignature(disguisedExe, 'application/pdf')).toBe(false);
    expect(hasAllowedFileSignature(disguisedExe, 'image/jpeg')).toBe(false);
    expect(hasAllowedFileSignature(disguisedExe, 'image/png')).toBe(false);

    const validPdfHeader = Buffer.from('%PDF-1.7\nSample');
    expect(hasAllowedFileSignature(validPdfHeader, 'application/pdf')).toBe(true);
  });

  // 9. Reviewer field correction provenance and mandatory justification enforcement
  it('Scenario 9: Rejects field correction without mandatory reason and audits valid correction', async () => {
    // 9a. Test rejection when reason is missing
    const reqInvalid: any = {
      params: { fieldId: 'FIELD-001' },
      body: { fieldValue: '10.5', reason: '' }, // Blank reason!
      user: { id: 'REV-01', name: 'Shri Ramesh Deshmukh', role: 'REVIEWER' },
    };
    const resInvalid = mockResponse();
    await updateExtractedField(reqInvalid, resInvalid);
    expect(resInvalid.statusCode).toBe(400);
    expect(resInvalid.body.error).toBe('ValidationError');

    // 9b. Test valid update with provenance and rule re-run
    mocks.extractedFieldFindUnique.mockResolvedValueOnce({
      id: 'FIELD-001',
      documentId: 'DOC-001',
      applicationId: 'AICTE-2026-ENG-4821',
      fieldName: 'LAND_AREA_ACRES',
      fieldValue: '2.0',
      originalExtractedValue: '2.0',
      document: { applicationId: 'AICTE-2026-ENG-4821' },
    });
    mocks.extractedFieldUpdate.mockResolvedValueOnce({
      id: 'FIELD-001',
      fieldValue: '5.25',
      isCorrected: true,
      correctedByUserId: 'REV-01',
    });
    mocks.transaction.mockImplementation(async (callback: any) => {
      const tx: any = {
        extractedField: { update: mocks.extractedFieldUpdate },
        validationFinding: { deleteMany: vi.fn(), create: vi.fn() },
      };
      return callback(tx);
    });
    mocks.applicationFindUnique.mockResolvedValueOnce({
      id: 'AICTE-2026-ENG-4821',
      category: 'ENGINEERING_TECH',
      institution: { id: 'INST-01', name: 'VJIT', aictePermanentId: '1-10923481' },
      documents: [],
    });
    mocks.validationRuleFindMany.mockResolvedValue([]);

    const reqValid: any = {
      params: { fieldId: 'FIELD-001' },
      body: { fieldValue: '5.25', reason: 'Verified against stamped survey registry khata copy' },
      user: { id: 'REV-01', name: 'Shri Ramesh Deshmukh', role: 'REVIEWER' },
      headers: { 'user-agent': 'Vitest-Agent/1.0' },
      ip: '127.0.0.1',
    };
    const resValid = mockResponse();
    await updateExtractedField(reqValid, resValid);

    expect(resValid.statusCode).toBe(200);
    expect(resValid.body.success).toBe(true);
    expect(resValid.body.data.fieldValue).toBe('5.25');
  });

  // 10. Manual field entry for unreadable / scanned document
  it('Scenario 10: Reviewer can manually record a missing field for unreadable document with audit provenance', async () => {
    mocks.documentFindUnique.mockResolvedValueOnce({
      id: 'DOC-SCANNED-01',
      applicationId: 'AICTE-2026-ENG-4821',
      application: { id: 'AICTE-2026-ENG-4821', institutionId: 'INST-01' },
    });
    mocks.extractedFieldCreate.mockResolvedValueOnce({
      id: 'FIELD-MANUAL-01',
      fieldName: 'FIRE_NOC_EXPIRY_DATE',
      fieldValue: '2026-12-31',
      isCorrected: true,
      evidencePage: 1,
    });
    mocks.transaction.mockImplementation(async (callback: any) => {
      const tx: any = {
        extractedField: { create: mocks.extractedFieldCreate },
        validationFinding: { deleteMany: vi.fn(), create: vi.fn() },
      };
      return callback(tx);
    });
    mocks.applicationFindUnique.mockResolvedValueOnce({
      id: 'AICTE-2026-ENG-4821',
      category: 'ENGINEERING_TECH',
      institution: { id: 'INST-01', name: 'VJIT', aictePermanentId: '1-10923481' },
      documents: [],
    });
    mocks.validationRuleFindMany.mockResolvedValue([]);

    const req: any = {
      params: { documentId: 'DOC-SCANNED-01' },
      body: {
        fieldName: 'FIRE_NOC_EXPIRY_DATE',
        fieldLabel: 'Fire Safety NOC Validity / Expiry Date',
        fieldValue: '2026-12-31',
        evidencePage: 1,
        reason: 'Officer verified stamp on physical certified copy',
      },
      user: { id: 'REV-01', name: 'Shri Ramesh Deshmukh', role: 'REVIEWER' },
      headers: { 'user-agent': 'Vitest-Agent/1.0' },
      ip: '127.0.0.1',
    };
    const res = mockResponse();
    await createExtractedField(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fieldValue).toBe('2026-12-31');
  });
});
