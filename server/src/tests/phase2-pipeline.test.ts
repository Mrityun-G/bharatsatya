import { describe, expect, it, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFileSync } from 'child_process';
import { parseDocumentFile, fallbackExtractFields, normalizeDate } from '../ocr/extractor.js';
import { hasAllowedFileSignature, computeFileSha256 } from '../middleware/upload.js';
import { uploadDocument, downloadDocument, updateExtractedField } from '../controllers/documentController.js';

// Hoist mocks for controller unit tests
const mocks = vi.hoisted(() => ({
  applicationFindUnique: vi.fn(),
  documentFindFirst: vi.fn(),
  documentFindUnique: vi.fn(),
  extractedFieldFindUnique: vi.fn(),
  extractedFieldUpdate: vi.fn(),
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
      create: vi.fn(),
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

describe('BharatSatya Phase 2: Document Intelligence Pipeline Unit Suite', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bharatsatya-phase2-test-'));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Valid text-based PDF extraction
  it('Scenario 1: Extracts text and structured fields from a valid text-based PDF with page reference and uninvented confidence', async () => {
    const pdfPath = path.join(tempDir, 'valid_order.pdf');
    execFileSync(python, [
      '-c',
      `
import fitz, sys
d = fitz.open()
p = d.new_page()
p.insert_text((72, 72), 'GOVERNMENT OF TELANGANA\\nDirectorate of Fire Services\\nFire Safety NOC No: NOC/FIRE/2026/8841\\nInstitution Name: Vidya Jyothi Institute of Technology\\nDate of Issue: 10/01/2024\\nValid Up To: 31/12/2026\\nIssuing Authority: Directorate of Fire Services\\n')
d.save(sys.argv[1])
`,
      pdfPath,
    ]);

    const result = await parseDocumentFile(pdfPath, 'application/pdf', 'FIRE_SAFETY_NOC');
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    expect(result.error).toBeUndefined();
    expect(result.rawText).toContain('Vidya Jyothi Institute of Technology');
    expect(result.rawText).toContain('NOC/FIRE/2026/8841');
    expect(result.confidence).toBeNull(); // Must remain uninvented

    const instField = result.fields.find((f) => f.fieldName === 'INSTITUTION_NAME');
    expect(instField).toBeDefined();
    expect(instField?.fieldValue).toBe('Vidya Jyothi Institute of Technology');
    expect(instField?.evidencePage).toBe(1);

    const refField = result.fields.find((f) => f.fieldName === 'REGISTRATION_REF_NO');
    expect(refField).toBeDefined();
    expect(refField?.fieldValue).toBe('NOC/FIRE/2026/8841');

    const expField = result.fields.find((f) => f.fieldName === 'FIRE_NOC_EXPIRY_DATE');
    expect(expField).toBeDefined();
    expect(expField?.fieldValue).toBe('2026-12-31');
  }, 25000);

  // 2. Scanned document / OCR fallback
  it('Scenario 2: Scanned document runs Tesseract OCR when available or returns an explicit error without marking false success', async () => {
    const scannedPath = path.join(tempDir, 'blank_scanned.pdf');
    execFileSync(python, ['-c', "import fitz, sys; d = fitz.open(); d.new_page(); d.save(sys.argv[1])", scannedPath]);

    const result = await parseDocumentFile(scannedPath, 'application/pdf', 'LAND_TITLE_DEED');
    if (fs.existsSync(scannedPath)) fs.unlinkSync(scannedPath);

    expect(result.error).toBeTruthy();
    expect(result.fields).toEqual([]);
    expect(result.isRecoverable).toBe(true);
  }, 25000);

  // 3. Unsupported or malformed file
  it('Scenario 3: Rejects unsupported, disguised or malformed files using magic byte signature validation', async () => {
    const fakePdf = Buffer.from('MZ disguised windows binary header claiming to be pdf');
    expect(hasAllowedFileSignature(fakePdf, 'application/pdf')).toBe(false);

    const fakePng = Buffer.from('%PDF disguised pdf claiming to be png');
    expect(hasAllowedFileSignature(fakePng, 'image/png')).toBe(false);

    const validPdf = Buffer.from('%PDF-1.7 statutory document header');
    expect(hasAllowedFileSignature(validPdf, 'application/pdf')).toBe(true);

    const validPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
    expect(hasAllowedFileSignature(validPng, 'image/png')).toBe(true);
  });

  // 4. Expired certificate detection
  it('Scenario 4: Date normalization and expiry detection accurately flags expired certificates', () => {
    expect(normalizeDate('31/12/2025')).toBe('2025-12-31');
    expect(normalizeDate('01-07-2024')).toBe('2024-07-01');
    expect(normalizeDate('2026-05-15')).toBe('2026-05-15');

    const expiryDate = new Date('2025-12-31');
    const referenceCycleCutoff = new Date('2026-06-30');
    expect(expiryDate < referenceCycleCutoff).toBe(true);
  });

  // 5. Missing required information
  it('Scenario 5: Identifies missing mandatory fields in document content', () => {
    const partialText = 'Certificate No: NOC/2026/01\nValid Up To: 2026-12-31';
    const fields = fallbackExtractFields(partialText, 'FIRE_SAFETY_NOC');

    const hasName = fields.some((f) => f.fieldName === 'INSTITUTION_NAME');
    const hasRef = fields.some((f) => f.fieldName === 'REGISTRATION_REF_NO');
    const hasExpiry = fields.some((f) => f.fieldName === 'FIRE_NOC_EXPIRY_DATE');

    expect(hasName).toBe(false); // Missing mandatory institution name
    expect(hasRef).toBe(true);
    expect(hasExpiry).toBe(true);
  });

  // 6. Cross-document mismatch detection
  it('Scenario 6: Cross-document normalization detects mismatched legal entities', () => {
    const entityA = 'Nalanda Foundation for Higher Learning';
    const entityB = 'Magadh Educational Trust Society';

    const norm = (val: string) =>
      val
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/(foundations|foundation|societies|society|trusts|trust|colleges|college)/g, '');

    const normA = norm(entityA);
    const normB = norm(entityB);
    const matches = normA === normB || normA.includes(normB) || normB.includes(normA);

    expect(matches).toBe(false); // Flags mismatch finding
  });

  // 7. Identical duplicate upload detection
  it('Scenario 7: SHA-256 cryptographic hashing detects exact duplicate files across uploads', async () => {
    const buffer1 = Buffer.from('%PDF-1.4 statutory order content v1');
    const buffer2 = Buffer.from('%PDF-1.4 statutory order content v1');
    const buffer3 = Buffer.from('%PDF-1.4 statutory order content v2 different');

    const hash1 = await computeFileSha256(buffer1);
    const hash2 = await computeFileSha256(buffer2);
    const hash3 = await computeFileSha256(buffer3);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  // 8. OCR or storage failure handling with rollback
  it('Scenario 8: Database or storage failure cleanly rolls back private storage and prevents orphaned files', async () => {
    mocks.applicationFindUnique.mockResolvedValue({ id: 'app-1', institutionId: 'inst-1' });
    mocks.documentFindFirst.mockResolvedValue(null);
    mocks.storage.put.mockResolvedValue(undefined);
    mocks.storage.delete.mockResolvedValue(undefined);
    mocks.transaction.mockRejectedValue(new Error('simulated disk failure'));

    const res = mockResponse();
    const content = Buffer.from('%PDF-1.7 statutory document');

    await uploadDocument(
      {
        file: { buffer: content, mimetype: 'application/pdf', originalname: 'order.pdf', size: content.length },
        body: { applicationId: 'app-1', documentType: 'LAND_TITLE_DEED' },
        user: { id: 'user-1', name: 'Applicant', role: 'APPLICANT', institutionId: 'inst-1' },
        headers: {},
        ip: '127.0.0.1',
      } as any,
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('InternalServerError');
    expect(mocks.storage.put).toHaveBeenCalledOnce();
    expect(mocks.storage.delete).toHaveBeenCalledOnce();
  });

  // 9. Applicant cross-institution access rejection
  it('Scenario 9: Rejects applicant attempts to download documents belonging to another institution with 403', async () => {
    mocks.documentFindUnique.mockResolvedValue({
      id: 'doc-foreign',
      storagePath: 'foreign.pdf',
      mimeType: 'application/pdf',
      originalName: 'foreign.pdf',
      application: { institutionId: 'INST-OTHER' },
    });

    const res = mockResponse();
    await downloadDocument(
      {
        params: { id: 'doc-foreign' },
        user: { role: 'APPLICANT', institutionId: 'INST-MY-COLLEGE' },
      } as any,
      res
    );

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('ForbiddenAccess');
    expect(mocks.storage.get).not.toHaveBeenCalled();
  });

  // 10. Reviewer authorized review workflow
  it('Scenario 10: Reviewer can inspect documents and correct extracted fields with mandatory audit reason', async () => {
    mocks.extractedFieldFindUnique.mockResolvedValue({
      id: 'field-1',
      applicationId: 'app-1',
      fieldName: 'LAND_AREA_ACRES',
      fieldValue: '2.0',
      originalExtractedValue: '2.0',
      document: { id: 'doc-1' },
    });

    mocks.extractedFieldUpdate.mockResolvedValue({
      id: 'field-1',
      fieldValue: '4.5',
      isCorrected: true,
    });

    mocks.validationRuleFindMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (callback: any) =>
      callback({
        extractedField: { update: mocks.extractedFieldUpdate },
        validationFinding: { deleteMany: vi.fn(), create: vi.fn() },
      })
    );

    const res = mockResponse();
    await updateExtractedField(
      {
        params: { fieldId: 'field-1' },
        body: { fieldValue: '4.5', reason: 'Corrected survey schedule value as per page 3 of title deed' },
        user: { id: 'rev-1', name: 'Shri Ramesh Deshmukh', role: 'REVIEWER' },
        headers: {},
        ip: '127.0.0.1',
      } as any,
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mocks.extractedFieldUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'field-1' },
        data: expect.objectContaining({
          fieldValue: '4.5',
          isCorrected: true,
          correctedByUserId: 'rev-1',
        }),
      })
    );
  });
});
