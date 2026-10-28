import { Request, Response } from 'express';
import { analyzeDocumentBuffer } from '../forensics/analyzer.js';
import { raiseAlerts } from '../services/alerts.js';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { computeFileSha256, hasAllowedFileSignature } from '../middleware/upload.js';
import { parseDocumentBuffer } from '../ocr/extractor.js';
import { getDocumentStorage } from '../storage/provider.js';
import { evaluateApplicationCompliance } from '../rules/engine.js';
import { writeAuditEvent } from '../services/audit.js';
import { DocumentType } from '../types/index.js';

export async function uploadDocument(req: Request, res: Response): Promise<void> {
  let pendingObjectKey: string | undefined;
  let databaseCommitted = false;
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'NoFileUploaded', message: 'No file was received in payload.' });
      return;
    }

    if (!file.buffer || !hasAllowedFileSignature(file.buffer, file.mimetype)) {
      res.status(400).json({ success: false, error: 'InvalidFileContent', message: 'File content does not match its declared PDF or image type.' });
      return;
    }

    const { applicationId, documentType, title } = req.body;
    if (!applicationId || !documentType) {
      res.status(400).json({ success: false, error: 'MissingMetadata', message: 'applicationId and documentType are required.' });
      return;
    }

    const application = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) {
      res.status(404).json({ success: false, error: 'ApplicationNotFound' });
      return;
    }

    if (req.user?.role === 'APPLICANT' && application.institutionId !== req.user.institutionId) {
      res.status(403).json({ success: false, error: 'ForbiddenAccess', message: 'Applicants may only upload documents for their own institution.' });
      return;
    }

    // 1. Compute SHA-256 hash
    const fileHash = await computeFileSha256(file.buffer);

    // 2. Check for duplicate hash
    const existingDuplicate = await prisma.document.findFirst({
      where: {
        fileHashSha256: fileHash,
        applicationId,
      },
    });

    const isDuplicate = Boolean(existingDuplicate);

    // 3. Run Document Parser & Field Extractor
    const parseResult = await parseDocumentBuffer(file.buffer, file.mimetype, documentType as DocumentType);

    // 3b. Preliminary forensics (metadata and tamper indicators); advisory only
    const forensics = analyzeDocumentBuffer(file.buffer, file.mimetype);

    const extension = file.mimetype === 'application/pdf' ? '.pdf' : file.mimetype === 'image/png' ? '.png' : '.jpg';
    const objectKey = `${crypto.randomUUID()}${extension}`;
    pendingObjectKey = objectKey;
    await getDocumentStorage().put(objectKey, file.buffer, file.mimetype);

    // 4. Save Document & Fields in Database Transaction
    const createdDoc = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          applicationId,
          documentType,
          title: title || file.originalname,
          fileName: objectKey,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
          fileHashSha256: fileHash,
          storagePath: objectKey,
          isDuplicate,
          duplicateOfDocumentId: existingDuplicate?.id || null,
          ocrConfidence: parseResult.confidence,
          ocrRawText: parseResult.rawText,
          forensicsJson: JSON.stringify(forensics),
          status: parseResult.error ? 'EXTRACTION_FAILED' : (isDuplicate ? 'DEFICIENT' : 'EXTRACTED'),
        },
      });

      // Save extracted fields
      for (const field of parseResult.fields) {
        await tx.extractedField.create({
          data: {
            documentId: doc.id,
            applicationId,
            fieldName: field.fieldName,
            fieldLabel: field.fieldLabel,
            fieldValue: field.fieldValue,
            originalExtractedValue: field.originalExtractedValue,
            confidence: field.confidence,
            evidencePage: field.evidencePage || 1,
            evidenceSnippet: field.evidenceSnippet,
            evidenceCoordinates: field.evidenceCoordinates ? JSON.stringify(field.evidenceCoordinates) : null,
          },
        });
      }

      await writeAuditEvent(tx, {
        actorId: req.user?.id, actorName: req.user?.name || 'Applicant User', actorRole: req.user?.role || 'APPLICANT',
        action: 'DOCUMENT_UPLOADED', entityType: 'Document', entityId: doc.id,
        afterState: { originalName: doc.originalName, documentType: doc.documentType, sha256: fileHash, isDuplicate, extractedFieldsCount: parseResult.fields.length, extractionError: parseResult.error },
        ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });

      return doc;
    });
    databaseCommitted = true;

    // 5. Run deterministic rule evaluation
    const evaluationResults = await evaluateApplicationCompliance(applicationId);
    const dbRules = await prisma.validationRule.findMany();
    const ruleCodeMap = new Map(dbRules.map((r) => [r.code, r.id]));

    await prisma.$transaction(async (tx) => {
      await tx.validationFinding.deleteMany({ where: { applicationId } });

      for (const resItem of evaluationResults) {
        const dbRuleId = ruleCodeMap.get(resItem.ruleCode);
        if (!dbRuleId) continue;

        let matchedDocId: string | undefined = undefined;
        if (resItem.documentType) {
          const d = await tx.document.findFirst({
            where: { applicationId, documentType: resItem.documentType },
          });
          if (d) matchedDocId = d.id;
        }

        await tx.validationFinding.create({
          data: {
            applicationId,
            ruleId: dbRuleId,
            ruleVersionId: resItem.ruleVersionId,
            documentId: matchedDocId,
            status: resItem.status,
            severity: resItem.severity,
            title: resItem.title,
            message: resItem.message,
            evidenceLocation: resItem.evidenceLocation,
            evidenceSnippet: resItem.evidenceSnippet,
            evidenceComparisonJson: resItem.evidenceComparison ? JSON.stringify(resItem.evidenceComparison) : null,
          },
        });
      }
    });

    const serious = forensics.indicators.filter((i) => i.severity !== 'LOW');
    if (serious.length) {
      await raiseAlerts(applicationId, [{
        type: 'ANOMALY',
        title: `Possible anomaly in ${file.originalname}`,
        message: `${serious.map((i) => i.title).join('; ')}. Preliminary indicator for human verification.`,
      }]);
    }

    res.status(201).json({
      success: true,
      data: {
        document: createdDoc,
        extractedFields: parseResult.fields,
        isDuplicate,
        parseError: parseResult.error,
        forensics,
      },
    });
  } catch (error: any) {
    if (pendingObjectKey && !databaseCommitted) {
      try { await getDocumentStorage().delete(pendingObjectKey); }
      catch { console.error('[Document Storage] Rollback cleanup failed; a private orphan object may require reconciliation.'); }
    }
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

export async function downloadDocument(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const doc = await prisma.document.findUnique({ where: { id }, include: { application: true } });

    if (!doc) {
      res.status(404).json({ success: false, error: 'DocumentNotFound' });
      return;
    }

    if (req.user?.role === 'APPLICANT' && doc.application.institutionId !== req.user.institutionId) {
      res.status(403).json({ success: false, error: 'ForbiddenAccess', message: 'Applicants may only access documents belonging to their institution.' });
      return;
    }

    const storage = getDocumentStorage();
    if (!await storage.exists(doc.storagePath)) {
      res.status(404).json({ success: false, error: 'DocumentObjectNotFound' });
      return;
    }

    // Set secure download headers
    res.setHeader('Content-Type', doc.mimeType);
    const downloadName = path.posix.basename(doc.originalName.replace(/\\/g, '/')).replace(/[^a-zA-Z0-9._ -]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName || 'document'}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const stream = await storage.get(doc.storagePath);
    stream.on('error', (error) => {
      if (!res.headersSent) res.status(502).json({ success: false, error: 'DocumentStreamFailed' });
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

const UpdateFieldSchema = z.object({
  fieldValue: z.string().min(1, 'Field value cannot be blank'),
  reason: z.string().min(3, 'Reason for manual field correction is required for traceability'),
});

export async function updateExtractedField(req: Request, res: Response): Promise<void> {
  try {
    const { fieldId } = req.params;
    const parsed = UpdateFieldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'ValidationError', details: parsed.error.flatten() });
      return;
    }

    const { fieldValue, reason } = parsed.data;

    const field = await prisma.extractedField.findUnique({
      where: { id: fieldId },
      include: { document: true },
    });

    if (!field) {
      res.status(404).json({ success: false, error: 'FieldNotFound' });
      return;
    }

    if (req.user?.role === 'APPLICANT') {
      const application = await prisma.application.findUnique({ where: { id: field.applicationId }, select: { institutionId: true } });
      if (!application || application.institutionId !== req.user.institutionId) {
        res.status(403).json({ success: false, error: 'ForbiddenAccess' });
        return;
      }
    }

    const previousValue = field.fieldValue;

    const updatedField = await prisma.$transaction(async (tx) => {
      const updated = await tx.extractedField.update({
        where: { id: fieldId },
        data: { fieldValue, isCorrected: true, correctedByUserId: req.user?.id || null, correctedAt: new Date() },
      });
      await writeAuditEvent(tx, {
        actorId: req.user?.id, actorName: req.user?.name || 'Reviewer User', actorRole: req.user?.role || 'REVIEWER',
        action: 'EXTRACTED_FIELD_MANUALLY_CORRECTED', entityType: 'ExtractedField', entityId: field.id,
        beforeState: { fieldValue: previousValue, originalExtracted: field.originalExtractedValue },
        afterState: { fieldValue, reason, correctedBy: req.user?.name }, ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });
      return updated;
    });

    // Re-evaluate and replace persisted findings so the review UI and report
    // reflect the corrected value rather than stale extraction results.
    const findings = await evaluateApplicationCompliance(field.applicationId);
    const rules = await prisma.validationRule.findMany();
    const ruleIds = new Map(rules.map((rule) => [rule.code, rule.id]));
    await prisma.$transaction(async (tx) => {
      await tx.validationFinding.deleteMany({ where: { applicationId: field.applicationId } });
      for (const finding of findings) {
        const ruleId = ruleIds.get(finding.ruleCode);
        if (!ruleId) continue;
        const document = finding.documentType
          ? await tx.document.findFirst({ where: { applicationId: field.applicationId, documentType: finding.documentType } })
          : null;
        await tx.validationFinding.create({
          data: {
            applicationId: field.applicationId,
            ruleId,
            ruleVersionId: finding.ruleVersionId,
            documentId: document?.id,
            status: finding.status,
            severity: finding.severity,
            title: finding.title,
            message: finding.message,
            evidenceLocation: finding.evidenceLocation,
            evidenceSnippet: finding.evidenceSnippet,
            evidenceComparisonJson: finding.evidenceComparison ? JSON.stringify(finding.evidenceComparison) : null,
          },
        });
      }
    });

    res.json({ success: true, data: updatedField });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

const CreateFieldSchema = z.object({
  fieldName: z.string().min(1, 'Field name is required'),
  fieldLabel: z.string().min(1, 'Field label is required'),
  fieldValue: z.string().min(1, 'Field value cannot be blank'),
  evidencePage: z.number().int().positive().default(1),
  reason: z.string().min(3, 'Reason for manual field entry is mandatory for audit provenance'),
});

export async function createExtractedField(req: Request, res: Response): Promise<void> {
  try {
    const { documentId } = req.params;
    const parsed = CreateFieldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'ValidationError', details: parsed.error.flatten() });
      return;
    }

    const { fieldName, fieldLabel, fieldValue, evidencePage, reason } = parsed.data;

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { application: true },
    });

    if (!doc) {
      res.status(404).json({ success: false, error: 'DocumentNotFound' });
      return;
    }

    if (req.user?.role === 'APPLICANT' && doc.application.institutionId !== req.user.institutionId) {
      res.status(403).json({ success: false, error: 'ForbiddenAccess' });
      return;
    }

    const createdField = await prisma.$transaction(async (tx) => {
      const field = await tx.extractedField.create({
        data: {
          documentId,
          applicationId: doc.applicationId,
          fieldName,
          fieldLabel,
          fieldValue,
          originalExtractedValue: '[MANUAL_ENTRY]',
          confidence: null,
          isCorrected: true,
          correctedByUserId: req.user?.id || null,
          correctedAt: new Date(),
          evidencePage: evidencePage || 1,
          evidenceSnippet: `Manual entry: ${reason}`,
        },
      });

      await writeAuditEvent(tx, {
        actorId: req.user?.id,
        actorName: req.user?.name || 'Reviewer User',
        actorRole: req.user?.role || 'REVIEWER',
        action: 'EXTRACTED_FIELD_MANUALLY_RECORDED',
        entityType: 'ExtractedField',
        entityId: field.id,
        afterState: { fieldName, fieldValue, reason, recordedBy: req.user?.name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return field;
    });

    // Re-evaluate application compliance
    const findings = await evaluateApplicationCompliance(doc.applicationId);
    const rules = await prisma.validationRule.findMany();
    const ruleIds = new Map(rules.map((rule) => [rule.code, rule.id]));

    await prisma.$transaction(async (tx) => {
      await tx.validationFinding.deleteMany({ where: { applicationId: doc.applicationId } });
      for (const finding of findings) {
        const ruleId = ruleIds.get(finding.ruleCode);
        if (!ruleId) continue;
        const document = finding.documentType
          ? await tx.document.findFirst({ where: { applicationId: doc.applicationId, documentType: finding.documentType } })
          : null;
        await tx.validationFinding.create({
          data: {
            applicationId: doc.applicationId,
            ruleId,
            ruleVersionId: finding.ruleVersionId,
            documentId: document?.id,
            status: finding.status,
            severity: finding.severity,
            title: finding.title,
            message: finding.message,
            evidenceLocation: finding.evidenceLocation,
            evidenceSnippet: finding.evidenceSnippet,
            evidenceComparisonJson: finding.evidenceComparison ? JSON.stringify(finding.evidenceComparison) : null,
          },
        });
      }
    });

    res.status(201).json({ success: true, data: createdField });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}
