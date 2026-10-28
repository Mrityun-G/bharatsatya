-- Infrastructure evidence document types
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'FLOOR_PLAN';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'INFRASTRUCTURE_PHOTO';

-- Preliminary document forensics (metadata and tamper indicators), computed at upload
ALTER TABLE "Document" ADD COLUMN "forensicsJson" TEXT;
