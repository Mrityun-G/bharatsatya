import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../index.js';
import { prisma } from '../prisma.js';
import { evaluateApplicationCompliance } from '../rules/engine.js';
import { parseDocumentFile } from '../ocr/extractor.js';
import { signJwtToken } from '../middleware/auth.js';
import { assertRuntimeMatchesTestDatabase } from '../config/testDatabaseSafety.js';

// Keep direct Vitest invocation safe too; the acceptance config sets these to the TEST_* URLs.
assertRuntimeMatchesTestDatabase();

describe('BharatSatya Statutory Compliance & Regulatory Verification Acceptance Suite', () => {
  let adminToken: string;
  let reviewerToken: string;
  let applicantToken: string;
  const testUploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

  beforeAll(async () => {
    // Generate valid tokens for each role
    adminToken = signJwtToken({
      id: 'USER-ADMIN-01',
      email: 'admin@aicte.gov.in',
      name: 'Dr. Anil Sahasrabudhe',
      role: 'ADMIN',
    });

    reviewerToken = signJwtToken({
      id: 'USER-REV-01',
      email: 'reviewer.deshmukh@aicte.gov.in',
      name: 'Shri Ramesh Deshmukh',
      role: 'REVIEWER',
    });

    applicantToken = signJwtToken({
      id: 'USER-APP-01',
      email: 'principal@vjit.ac.in',
      name: 'Dr. P. Venugopal Rao',
      role: 'APPLICANT',
      institutionId: 'INST-001',
    });
  });

  // 1. Upload Validation Test: Rejects Invalid File Format
  it('Upload Validation: Rejects unsupported file types and prevents unvalidated uploads', async () => {
    const invalidFilePath = path.join(testUploadDir, 'test_script.exe');
    fs.writeFileSync(invalidFilePath, 'MZ dummy binary content');

    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${applicantToken}`)
      .field('applicationId', 'AICTE-2026-ENG-4821')
      .field('documentType', 'LAND_TITLE_DEED')
      .attach('file', invalidFilePath);

    // Clean up temporary test file
    if (fs.existsSync(invalidFilePath)) fs.unlinkSync(invalidFilePath);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  // 2. Duplicate Detection: Uploading Identical File Detects Duplicate SHA-256 Hash
  it('Duplicate Detection: Uploading identical file detects duplicate SHA-256 hash', async () => {
    // Create dedicated application with unique ID for duplicate testing
    const testAppId = `AICTE-2026-ENG-DUP-${Date.now()}`;
    const testApp = await prisma.application.create({
      data: {
        id: testAppId,
        institutionId: 'INST-001',
        category: 'ENGINEERING_TECH',
        academicYear: '2026-2027',
        status: 'SUBMITTED',
      },
    });

    const duplicateContent = '%PDF-1.4\nIDENTICAL REGULATORY CLEARANCE ORDER CERTIFIED COPY BY TEST RUNNER\n%%EOF';
    const sampleFile1 = path.join(testUploadDir, 'sample_dup_1.pdf');
    fs.writeFileSync(sampleFile1, duplicateContent);

    // First upload
    const res1 = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${applicantToken}`)
      .field('applicationId', testApp.id)
      .field('documentType', 'OCCUPANCY_CERTIFICATE')
      .field('title', 'Initial Certificate Upload')
      .attach('file', sampleFile1);

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    expect(res1.body.data.isDuplicate).toBe(false);

    // Second upload of identical content
    const res2 = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${applicantToken}`)
      .field('applicationId', testApp.id)
      .field('documentType', 'OCCUPANCY_CERTIFICATE')
      .field('title', 'Duplicate Certificate Re-Upload')
      .attach('file', sampleFile1);

    // Clean up test file
    if (fs.existsSync(sampleFile1)) fs.unlinkSync(sampleFile1);

    expect(res2.status).toBe(201);
    expect(res2.body.data.isDuplicate).toBe(true);
    expect(res2.body.data.document.isDuplicate).toBe(true);
  });

  // 3. Scenario 1: A complete compliant application passes all applicable rules
  it('Scenario 1: A complete compliant application passes all applicable rules', async () => {
    const findings = await evaluateApplicationCompliance('AICTE-2026-ENG-4821');
    const nonPassed = findings.filter(
      (f) => f.status === 'MISSING' || f.status === 'EXPIRED' || f.status === 'MISMATCH'
    );
    expect(nonPassed.length).toBe(0);

    const docCompleteness = findings.find((f) => f.ruleCode === 'RULE-APH-01');
    expect(docCompleteness?.status).toBe('PASSED');

    const fireNoc = findings.find((f) => f.ruleCode === 'RULE-APH-02');
    expect(fireNoc?.status).toBe('PASSED');
  });

  // 4. Scenario 2: A missing required document creates a visible finding
  it('Scenario 2: A missing required document creates a visible finding', async () => {
    const findings = await evaluateApplicationCompliance('AICTE-2026-MGT-2041');
    const missingFinding = findings.find((f) => f.ruleCode === 'RULE-APH-01');

    expect(missingFinding).toBeDefined();
    expect(missingFinding?.status).toBe('MISSING');
    expect(missingFinding?.severity).toBe('CRITICAL');
    expect(missingFinding?.evidenceComparison?.missing).toContain('FIRE_SAFETY_NOC');
  });

  // 5. Scenario 3: An expired certificate is flagged using the configured reference date
  it('Scenario 3: An expired certificate is flagged using the configured reference date', async () => {
    const findings = await evaluateApplicationCompliance('AICTE-2026-PHR-1190');
    const expiredFinding = findings.find((f) => f.ruleCode === 'RULE-APH-02');

    expect(expiredFinding).toBeDefined();
    expect(expiredFinding?.status).toBe('EXPIRED');
    expect(expiredFinding?.severity).toBe('CRITICAL');
    expect(expiredFinding?.evidenceComparison?.isExpired).toBe(true);
    expect(expiredFinding?.evidenceComparison?.extractedExpiryDate).toBe('2025-12-31');
  });

  // 6. Scenario 4: Two documents with mismatched identifiers produce an evidence-linked finding
  it('Scenario 4: Two documents with mismatched identifiers produce an evidence-linked finding', async () => {
    const findings = await evaluateApplicationCompliance('AICTE-2026-ARC-8902');
    const mismatchFinding = findings.find((f) => f.ruleCode === 'RULE-APH-04');

    expect(mismatchFinding).toBeDefined();
    expect(mismatchFinding?.status).toBe('MISMATCH');
    expect(mismatchFinding?.severity).toBe('MAJOR');
    expect(mismatchFinding?.evidenceLocation).toContain('vs');
    expect(mismatchFinding?.evidenceComparison?.landDeedEntityName).toBe('Nalanda Foundation for Higher Learning');
    expect(mismatchFinding?.evidenceComparison?.societyRegistrationEntityName).toBe('Magadh Educational Trust Society');
  });

  // 7. Scenario 5: Uploading duplicate file produces cryptographic finding
  it('Scenario 5: Uploading duplicate file produces cryptographic duplicate finding', async () => {
    const findings = await evaluateApplicationCompliance('AICTE-2026-POL-7714');
    const duplicateFinding = findings.find((f) => f.ruleCode === 'RULE-APH-08');

    expect(duplicateFinding).toBeDefined();
    expect(duplicateFinding?.status).toBe('MISMATCH');
    expect(duplicateFinding?.severity).toBe('CRITICAL');
    expect(duplicateFinding?.message).toContain('identical SHA-256 byte digest');
  });

  // 8. Scenario 6: OCR failure produces a recoverable error allowing manual entry
  it('Scenario 6: OCR failure produces a recoverable error allowing manual entry', async () => {
    const result = await parseDocumentFile('C:\\non_existent_corrupted_file.xyz', 'application/pdf', 'LAND_TITLE_DEED');

    expect(result.isRecoverable).toBe(true);
    expect(result.error).toBeDefined();
    expect(result.fields.length).toBe(0);
  });

  // 9. Scenario 7: A reviewer can request clarification and the status persists
  it('Scenario 7: A reviewer can request clarification and the status persists', async () => {
    const res = await request(app)
      .post('/api/reviews/clarification')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        applicationId: 'AICTE-2026-ENG-4821',
        deficiencyTitle: 'Clarification regarding Survey demarcation boundary',
        clarificationMessage: 'Please provide certified municipal sketch for Survey No 48/2 boundary wall.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('CLARIFICATION_REQUESTED');

    // Verify persistence via separate GET call
    const getRes = await request(app)
      .get('/api/applications/AICTE-2026-ENG-4821')
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.status).toBe('CLARIFICATION_REQUESTED');
    expect(getRes.body.data.reviewActions.length).toBeGreaterThan(0);
  });

  // 10. Scenario 8: Important status transitions create an audit event
  it('Scenario 8: Important status transitions create an audit event', async () => {
    const res = await request(app)
      .patch('/api/applications/AICTE-2026-ENG-4821/status')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        newStatus: 'VERIFIED_RECOMMENDED',
        reason: 'Institutional response received and scrutinized with favorable recommendation.',
      });

    expect(res.status).toBe(200);

    const auditRes = await request(app)
      .get('/api/audit?entityId=AICTE-2026-ENG-4821')
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(auditRes.status).toBe(200);
    const transitionEvent = auditRes.body.data.find(
      (e: any) => e.action === 'APPLICATION_STATUS_TRANSITION'
    );
    expect(transitionEvent).toBeDefined();
    expect(transitionEvent.actorRole).toBe('REVIEWER');
  });

  it('Reviewer verification requests persist simulated evidence and an actor-linked audit event', async () => {
    const verifyRes = await request(app)
      .post('/api/verifications')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ applicationId: 'AICTE-2026-ENG-4821', provider: 'AICTE_CENTRAL_PORTAL_DATABASE', referenceId: 'TEST-VERIFY-0001' });

    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.data).toMatchObject({ requestedByUserId: 'USER-REV-01', isDemoSimulation: true, status: 'VERIFIED' });
    expect(verifyRes.body.data.evidenceReference).toBeTruthy();
    const auditRes = await request(app)
      .get(`/api/audit?entityId=${verifyRes.body.data.id}`)
      .set('Authorization', `Bearer ${reviewerToken}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'VERIFICATION_REQUESTED', actorId: 'USER-REV-01', entityId: verifyRes.body.data.id }),
    ]));
  });

  // 11. Scenario 9: Role-based authorization prevents unauthorized operations
  it('Scenario 9: Unauthorized users cannot access reviewer or administrator operations', async () => {
    // Applicant trying to update status (Reviewer/Admin only)
    const statusRes = await request(app)
      .patch('/api/applications/AICTE-2026-ENG-4821/status')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({ newStatus: 'APPROVED', reason: 'Attempt unauthorized approval' });

    expect(statusRes.status).toBe(403);
    expect(statusRes.body.error).toBe('ForbiddenRole');

    const verificationRes = await request(app)
      .post('/api/verifications')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({ applicationId: 'AICTE-2026-ENG-4821', provider: 'AICTE_CENTRAL_PORTAL_DATABASE', referenceId: 'TEST-VERIFY-UNAUTHORIZED' });
    expect(verificationRes.status).toBe(403);

    // Reviewer trying to create a new rule (Admin only)
    const ruleRes = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        code: 'RULE-UNAUTH-01',
        title: 'Unauthorized Rule',
        description: 'Test rule created without admin role',
        officialSourceReference: 'Test',
        ruleType: 'MANDATORY_DOCUMENT',
        severity: 'MAJOR',
        logicConfigJson: '{}',
      });

    expect(ruleRes.status).toBe(403);
    expect(ruleRes.body.error).toBe('ForbiddenRole');
  });

  it('Applicant cannot download a document belonging to a different institution application', async () => {
    const foreignDocument = await prisma.document.findFirst({ where: { applicationId: 'AICTE-2026-MGT-2041' } });
    expect(foreignDocument).toBeTruthy();
    const res = await request(app)
      .get(`/api/documents/${foreignDocument!.id}/download`)
      .set('Authorization', `Bearer ${applicantToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ForbiddenAccess');
  });

  // 12. Scenario 10: Validation dossier matches saved application findings
  it('Scenario 10: The validation report matches the saved application findings', async () => {
    const reportRes = await request(app)
      .get('/api/applications/AICTE-2026-ENG-4821/report')
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(reportRes.status).toBe(200);
    expect(reportRes.body.success).toBe(true);

    const report = reportRes.body.data;
    expect(report.applicationDetails.applicationId).toBe('AICTE-2026-ENG-4821');
    expect(report.institutionDetails.name).toBe('Vidya Jyothi Institute of Technology');
    expect(report.regulatoryFindings.length).toBeGreaterThan(0);
    expect(report.externalSourceVerifications.length).toBeGreaterThanOrEqual(2);
  });
});
