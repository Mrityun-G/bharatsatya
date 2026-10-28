import multer from 'multer';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Request, Response, NextFunction } from 'express';
import { getDocumentStorage } from '../storage/provider.js';

dotenv.config();

const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    req.fileValidationError = `Unsupported file type: ${file.mimetype || 'unknown'}. Only PDF, PNG, and JPEG documents are accepted.`;
    cb(null, false);
  }
};

export function getUploadFileSizeLimit(vercel = process.env.VERCEL): number {
  return vercel === '1' ? 4 * 1024 * 1024 : 10 * 1024 * 1024;
}

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: getUploadFileSizeLimit(),
  },
  fileFilter,
});

export async function handleSingleUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const storage = getDocumentStorage(); // Validate provider and all production credentials before accepting bytes.
    if (process.env.NODE_ENV === 'production' && storage.provider !== 's3') throw new Error('Production requires private object storage.');
    await storage.check();
  } catch {
    res.status(503).json({
      success: false,
      error: 'PrivateStorageNotConfigured',
      message: 'Document uploads are disabled until private persistent object storage is configured correctly.',
    });
    return;
  }
  uploadMiddleware.single('file')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: 'UploadValidationError',
        message: err.message || 'File upload failed validation criteria.',
      });
    }
    if ((req as any).fileValidationError) {
      return res.status(400).json({
        success: false,
        error: 'UnsupportedFileType',
        message: (req as any).fileValidationError,
      });
    }
    next();
  });
}

export function computeFileSha256(content: Buffer | string): Promise<string> {
  return Promise.resolve(crypto.createHash('sha256').update(content).digest('hex'));
}

export function hasAllowedFileSignature(content: Buffer | string, mimeType: string): boolean {
  const bytes = Buffer.isBuffer(content) ? content.subarray(0, 8) : Buffer.from(content).subarray(0, 8);
  if (mimeType === 'application/pdf') return bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/png') return bytes.length >= 8 && bytes.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
}
