import { describe, expect, it } from 'vitest';
import { getUploadFileSizeLimit, handleSingleUpload, hasAllowedFileSignature } from '../middleware/upload.js';

describe('uploaded document content validation', () => {
  it('accepts recognized PDF, PNG and JPEG signatures', () => {
    const samples: Array<[string, Buffer, string]> = [
      ['sample.pdf', Buffer.from('%PDF-1.7'), 'application/pdf'],
      ['sample.png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'],
      ['sample.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), 'image/jpeg'],
    ];
    for (const [name, bytes, mime] of samples) {
      expect(hasAllowedFileSignature(bytes, mime)).toBe(true);
    }
  });

  it('rejects spoofed MIME types and content', () => {
    expect(hasAllowedFileSignature(Buffer.from('not actually a PDF'), 'application/pdf')).toBe(false);
  });

  it('keeps uploads below the Vercel function body limit and permits the larger local cap', () => {
    expect(getUploadFileSizeLimit('1')).toBe(4 * 1024 * 1024);
    expect(getUploadFileSizeLimit(undefined)).toBe(10 * 1024 * 1024);
  });

  it('keeps uploads disabled in production until private storage is available', async () => {
    const previous = process.env.NODE_ENV;
    const previousProvider = process.env.DOCUMENT_STORAGE_PROVIDER;
    process.env.NODE_ENV = 'production';
    process.env.DOCUMENT_STORAGE_PROVIDER = 'local';
    const res: any = { statusCode: 200 };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (body: any) => { res.body = body; return res; };
    try {
      await handleSingleUpload({} as any, res, () => { throw new Error('unexpected upload continuation'); });
      expect(res.statusCode).toBe(503);
      expect(res.body.error).toBe('PrivateStorageNotConfigured');
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
      if (previousProvider === undefined) delete process.env.DOCUMENT_STORAGE_PROVIDER;
      else process.env.DOCUMENT_STORAGE_PROVIDER = previousProvider;
    }
  });
});
