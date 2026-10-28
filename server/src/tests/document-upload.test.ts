import { beforeEach, describe, expect, it, vi } from 'vitest';

const { applicationFindUnique, documentFindFirst, transaction, parseDocument, storage } = vi.hoisted(() => ({
  applicationFindUnique: vi.fn(),
  documentFindFirst: vi.fn(),
  transaction: vi.fn(),
  parseDocument: vi.fn(),
  storage: { put: vi.fn(), delete: vi.fn() },
}));

vi.mock('../prisma.js', () => ({
  prisma: {
    application: { findUnique: applicationFindUnique },
    document: { findFirst: documentFindFirst },
    $transaction: transaction,
  },
}));
vi.mock('../ocr/extractor.js', () => ({ parseDocumentBuffer: parseDocument }));
vi.mock('../storage/provider.js', () => ({ getDocumentStorage: () => storage }));

import { uploadDocument } from '../controllers/documentController.js';

function response() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((body: unknown) => { res.body = body; return res; });
  return res;
}

describe('document upload rollback cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applicationFindUnique.mockResolvedValue({ id: 'application-1', institutionId: 'institution-1' });
    documentFindFirst.mockResolvedValue(null);
    parseDocument.mockResolvedValue({ rawText: '', confidence: null, fields: [], isRecoverable: true });
    storage.put.mockResolvedValue(undefined);
    storage.delete.mockResolvedValue(undefined);
    transaction.mockRejectedValue(new Error('database write failed'));
  });

  it('deletes the private object when the document database transaction fails', async () => {
    const res = response();
    const content = Buffer.from('%PDF-1.7 private test document');
    await uploadDocument({
      file: { buffer: content, mimetype: 'application/pdf', originalname: 'evidence.pdf', size: content.length },
      body: { applicationId: 'application-1', documentType: 'LAND_TITLE_DEED' },
      user: { id: 'applicant-1', name: 'Synthetic Applicant', role: 'APPLICANT', institutionId: 'institution-1' },
      headers: {}, ip: '127.0.0.1',
    } as any, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('InternalServerError');
    expect(storage.put).toHaveBeenCalledOnce();
    const objectKey = storage.put.mock.calls[0][0];
    expect(objectKey).toMatch(/^[a-f0-9-]{36}\.pdf$/i);
    expect(storage.delete).toHaveBeenCalledWith(objectKey);
  });

  it('denies applicants uploading to another institution before parsing or storage writes', async () => {
    applicationFindUnique.mockResolvedValue({ id: 'foreign-application', institutionId: 'institution-2' });
    const res = response();
    const content = Buffer.from('%PDF-1.7 private test document');
    await uploadDocument({
      file: { buffer: content, mimetype: 'application/pdf', originalname: 'evidence.pdf', size: content.length },
      body: { applicationId: 'foreign-application', documentType: 'LAND_TITLE_DEED' },
      user: { id: 'applicant-1', name: 'Synthetic Applicant', role: 'APPLICANT', institutionId: 'institution-1' },
      headers: {}, ip: '127.0.0.1',
    } as any, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('ForbiddenAccess');
    expect(parseDocument).not.toHaveBeenCalled();
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('does not hide cleanup failure or leak object keys in the response', async () => {
    storage.delete.mockRejectedValue(new Error('private provider detail'));
    const res = response();
    const content = Buffer.from('%PDF-1.7 private test document');
    const loggedErrors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await uploadDocument({
        file: { buffer: content, mimetype: 'application/pdf', originalname: 'evidence.pdf', size: content.length },
        body: { applicationId: 'application-1', documentType: 'LAND_TITLE_DEED' },
        user: { id: 'applicant-1', name: 'Synthetic Applicant', role: 'APPLICANT', institutionId: 'institution-1' },
        headers: {}, ip: '127.0.0.1',
      } as any, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('InternalServerError');
    expect(JSON.stringify(res.body)).not.toContain('database write failed');
    expect(loggedErrors).toHaveBeenCalledWith(expect.stringContaining('private orphan object'));
    expect(loggedErrors.mock.calls.flat().join(' ')).not.toContain('private provider detail');
    loggedErrors.mockRestore();
  });
});
