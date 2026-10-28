import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { parseDocumentBuffer, parseDocumentFile } from '../ocr/extractor.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bharatsatya-ocr-test-'));
const python = process.platform === 'win32' ? 'python' : 'python3';

afterEach(() => {
  for (const name of fs.readdirSync(tempDir)) fs.rmSync(path.join(tempDir, name), { force: true, recursive: true });
});

describe('document extraction', () => {
  it('extracts embedded text from a text-based PDF without invented confidence', async () => {
    const file = path.join(tempDir, 'text.pdf');
    execFileSync(python, ['-c', "import fitz,sys; d=fitz.open(); p=d.new_page(); p.insert_text((72,72),'Institution Name: Example Technical Institute'); d.save(sys.argv[1])", file]);
    const result = await parseDocumentFile(file, 'application/pdf', 'LAND_TITLE_DEED');
    expect(result.error).toBeUndefined();
    expect(result.rawText).toContain('Example Technical Institute');
    expect(result.fields[0]?.confidence).toBeNull();
    expect(result.confidence).toBeNull();
  }, 20000);

  it('returns an explicit error for unreadable documents rather than decoding arbitrary bytes', async () => {
    const file = path.join(tempDir, 'broken.pdf');
    fs.writeFileSync(file, Buffer.from([0, 255, 0, 254, 17, 0]));
    const result = await parseDocumentFile(file, 'application/pdf', 'LAND_TITLE_DEED');
    expect(result.error).toBeTruthy();
    expect(result.rawText).toBe('');
    expect(result.fields).toEqual([]);
    expect(result.confidence).toBeNull();
  }, 20000);

  it('returns an explicit OCR result for a scanned PDF/image with no readable text', async () => {
    const file = path.join(tempDir, 'scanned.pdf');
    execFileSync(python, ['-c', "import fitz,sys; d=fitz.open(); d.new_page(); d.save(sys.argv[1])", file]);
    const result = await parseDocumentFile(file, 'application/pdf', 'LAND_TITLE_DEED');
    expect(result.error).toBeTruthy();
    expect(result.fields).toEqual([]);
    expect(result.rawText).toBe('');
  }, 20000);

  it('processes an image upload through the OCR path or reports that Tesseract is unavailable', async () => {
    const file = path.join(tempDir, 'image.png');
    execFileSync(python, ['-c', "import fitz,sys; d=fitz.open(); p=d.new_page(); p.insert_text((72,72),'Institution Name: Example Technical Institute'); p.get_pixmap(matrix=fitz.Matrix(2,2)).save(sys.argv[1])", file]);
    const result = await parseDocumentFile(file, 'image/png', 'LAND_TITLE_DEED');
    if (result.error) expect(result.error).toMatch(/Tesseract|OCR|readable/i);
    else expect(result.rawText).toMatch(/Example|Technical|Institute/i);
  }, 20000);

  it('processes a JPEG upload through the OCR path or returns an explicit Tesseract failure', async () => {
    const file = path.join(tempDir, 'image.jpg');
    execFileSync(python, ['-c', "import fitz,sys; d=fitz.open(); p=d.new_page(); p.insert_text((72,72),'Institution Name: Example Technical Institute'); p.get_pixmap(matrix=fitz.Matrix(2,2)).save(sys.argv[1])", file]);
    const result = await parseDocumentFile(file, 'image/jpeg', 'LAND_TITLE_DEED');
    if (result.error) expect(result.error).toMatch(/Tesseract|OCR|readable/i);
    else expect(result.rawText).toMatch(/Example|Technical|Institute/i);
  }, 20000);

  it('uses the authenticated OCR service contract and preserves only supplied confidence', async () => {
    const previousUrl = process.env.OCR_SERVICE_URL;
    const previousToken = process.env.OCR_SERVICE_TOKEN;
    process.env.OCR_SERVICE_URL = 'https://ocr.example.test';
    process.env.OCR_SERVICE_TOKEN = 'unit-test-token-long-enough-123456789';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ rawText: 'source text', confidence: null, fields: [], isRecoverable: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const result = await parseDocumentBuffer(Buffer.from('%PDF-1.7'), 'application/pdf', 'LAND_TITLE_DEED');
      expect(result).toMatchObject({ rawText: 'source text', confidence: null, fields: [] });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://ocr.example.test/v1/extract');
      expect(init.headers.Authorization).toBe('Bearer unit-test-token-long-enough-123456789');
      expect(init.body).toBeInstanceOf(FormData);
    } finally {
      vi.unstubAllGlobals();
      if (previousUrl === undefined) delete process.env.OCR_SERVICE_URL; else process.env.OCR_SERVICE_URL = previousUrl;
      if (previousToken === undefined) delete process.env.OCR_SERVICE_TOKEN; else process.env.OCR_SERVICE_TOKEN = previousToken;
    }
  });

  it('returns an explicit unavailable error when remote OCR configuration is incomplete', async () => {
    const previousUrl = process.env.OCR_SERVICE_URL;
    const previousToken = process.env.OCR_SERVICE_TOKEN;
    process.env.OCR_SERVICE_URL = 'https://ocr.example.test';
    delete process.env.OCR_SERVICE_TOKEN;
    try {
      const result = await parseDocumentBuffer(Buffer.from('%PDF-1.7'), 'application/pdf', 'LAND_TITLE_DEED');
      expect(result.error).toMatch(/not fully configured/);
      expect(result.rawText).toBe('');
      expect(result.confidence).toBeNull();
    } finally {
      if (previousUrl === undefined) delete process.env.OCR_SERVICE_URL; else process.env.OCR_SERVICE_URL = previousUrl;
      if (previousToken === undefined) delete process.env.OCR_SERVICE_TOKEN; else process.env.OCR_SERVICE_TOKEN = previousToken;
    }
  });

  it('returns explicit timeout and payload-size errors for remote OCR requests', async () => {
    const previousUrl = process.env.OCR_SERVICE_URL;
    const previousToken = process.env.OCR_SERVICE_TOKEN;
    process.env.OCR_SERVICE_URL = 'https://ocr.example.test';
    process.env.OCR_SERVICE_TOKEN = 'unit-test-token-long-enough-123456789';
    const timeout = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout));
    try {
      const timedOut = await parseDocumentBuffer(Buffer.from('%PDF-1.7'), 'application/pdf', 'LAND_TITLE_DEED');
      expect(timedOut.error).toMatch(/timed out/);
      const tooLarge = await parseDocumentBuffer(Buffer.alloc(10 * 1024 * 1024 + 1), 'application/pdf', 'LAND_TITLE_DEED');
      expect(tooLarge.error).toMatch(/10 MB/);
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      if (previousUrl === undefined) delete process.env.OCR_SERVICE_URL; else process.env.OCR_SERVICE_URL = previousUrl;
      if (previousToken === undefined) delete process.env.OCR_SERVICE_TOKEN; else process.env.OCR_SERVICE_TOKEN = previousToken;
    }
  });
});
