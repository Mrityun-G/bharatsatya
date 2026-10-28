import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { prisma } from './prisma.js';
import { assertRuntimeMatchesTestDatabase } from './config/testDatabaseSafety.js';

dotenv.config();

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function createSampleDocFile(filename: string, content: string): { storageKey: string; hash: string; size: number } {
  const storageKey = `${crypto.randomUUID()}${path.extname(filename).toLowerCase() || '.pdf'}`;
  const filePath = path.join(uploadsDir, storageKey);
  fs.writeFileSync(filePath, content, 'utf-8');
  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return { storageKey, hash, size: buffer.length };
}

async function main() {
  console.log('[BharatSatya Seed] Initializing synthetic regulatory database...');

  assertRuntimeMatchesTestDatabase();

  if (process.env.ALLOW_SYNTHETIC_SEED !== 'true') {
    throw new Error('Synthetic seeding requires ALLOW_SYNTHETIC_SEED=true as an explicit disposable-database safeguard.');
  }

  const tableCounts = await Promise.all([
    prisma.institution.count(), prisma.user.count(), prisma.application.count(), prisma.document.count(),
    prisma.extractedField.count(), prisma.validationRule.count(), prisma.validationFinding.count(),
    prisma.validationRuleVersion.count(), prisma.verificationRequest.count(), prisma.reviewAction.count(),
    prisma.auditEvent.count(), prisma.notification.count(),
  ]);
  if (tableCounts.some((count) => count > 0)) {
    throw new Error('Refusing to seed a non-empty database. Create a fresh disposable database first.');
  }

  const demoPasswords = [process.env.DEMO_ADMIN_PASSWORD, process.env.DEMO_REVIEWER_PASSWORD, process.env.DEMO_APPLICANT_PASSWORD];
  if (demoPasswords.some((password) => !password || password.length < 12)) {
    throw new Error('Set DEMO_ADMIN_PASSWORD, DEMO_REVIEWER_PASSWORD, and DEMO_APPLICANT_PASSWORD to values of at least 12 characters before seeding.');
  }

  const [hashedAdminPassword, hashedReviewerPassword, hashedApplicantPassword] = await Promise.all(
    demoPasswords.map((password) => bcrypt.hash(password!, 10))
  );

  // 1. Create Institutions
  const vjitInst = await prisma.institution.create({
    data: {
      id: 'INST-001',
      name: 'Vidya Jyothi Institute of Technology',
      aictePermanentId: '1-458920194',
      address: 'Himayatnagar, CB Post, Aziznagar Gate',
      district: 'Rangareddy',
      state: 'Telangana',
      pincode: '500075',
      contactEmail: 'principal@vjit.ac.in',
      contactPhone: '+91 84132 35300',
      establishedYear: 1998,
      category: 'ENGINEERING_TECH',
    },
  });

  const kimsInst = await prisma.institution.create({
    data: {
      id: 'INST-002',
      name: 'Kalinga Institute of Management Studies',
      aictePermanentId: '1-893021948',
      address: 'Plot No. 12, Chandaka Industrial Area, Patia',
      district: 'Khordha',
      state: 'Odisha',
      pincode: '751024',
      contactEmail: 'director@kims.edu.in',
      contactPhone: '+91 674 2741998',
      establishedYear: 2005,
      category: 'MANAGEMENT',
    },
  });

  const saraswatiInst = await prisma.institution.create({
    data: {
      id: 'INST-003',
      name: 'Saraswati College of Pharmacy',
      aictePermanentId: '1-229401831',
      address: 'Survey No. 46/2, Hinjewadi Phase 3',
      district: 'Pune',
      state: 'Maharashtra',
      pincode: '411057',
      contactEmail: 'principal@scpharmacy.edu.in',
      contactPhone: '+91 20 22934001',
      establishedYear: 2012,
      category: 'PHARMACY',
    },
  });

  const nalandaInst = await prisma.institution.create({
    data: {
      id: 'INST-004',
      name: 'Nalanda School of Architecture',
      aictePermanentId: '1-394018241',
      address: 'Bailey Road, Saguna More',
      district: 'Patna',
      state: 'Bihar',
      pincode: '801503',
      contactEmail: 'dean@nalanda-arch.ac.in',
      contactPhone: '+91 612 2390144',
      establishedYear: 2016,
      category: 'ARCHITECTURE',
    },
  });

  const ambedkarInst = await prisma.institution.create({
    data: {
      id: 'INST-005',
      name: 'Dr. B.R. Ambedkar Polytechnic Institute',
      aictePermanentId: '1-550192849',
      address: 'Hingna Road, MIDC Industrial Area',
      district: 'Nagpur',
      state: 'Maharashtra',
      pincode: '440016',
      contactEmail: 'principal@bra-polytechnic.org',
      contactPhone: '+91 712 2549021',
      establishedYear: 2008,
      category: 'POLYTECHNIC',
    },
  });

  // 2. Create Users
  const adminUser = await prisma.user.create({
    data: {
      id: 'USER-ADMIN-01',
      email: 'admin@aicte.gov.in',
      passwordHash: hashedAdminPassword,
      name: 'Dr. Anil Sahasrabudhe',
      role: 'ADMIN',
      department: 'Approval & Regulatory Standards Bureau',
      designation: 'Chief Scrutiny Director',
    },
  });

  const reviewerUser = await prisma.user.create({
    data: {
      id: 'USER-REV-01',
      email: 'reviewer.deshmukh@aicte.gov.in',
      passwordHash: hashedReviewerPassword,
      name: 'Shri Ramesh Deshmukh',
      role: 'REVIEWER',
      department: 'Western Regional Directorate',
      designation: 'Senior Regional Scrutiny Officer',
    },
  });

  const applicantUser1 = await prisma.user.create({
    data: {
      id: 'USER-APP-01',
      email: 'principal@vjit.ac.in',
      passwordHash: hashedApplicantPassword,
      name: 'Dr. P. Venugopal Rao',
      role: 'APPLICANT',
      department: 'Academic Administration',
      designation: 'Principal & Authorized Signatory',
      institutionId: vjitInst.id,
    },
  });

  await prisma.user.create({
    data: {
      id: 'USER-APP-02',
      email: 'director@kims.edu.in',
      passwordHash: hashedApplicantPassword,
      name: 'Prof. Sunita Patnaik',
      role: 'APPLICANT',
      department: 'Management Faculty',
      designation: 'Director',
      institutionId: kimsInst.id,
    },
  });

  // 3. Create Validation Rules
  const rules = [
    {
      code: 'RULE-APH-01',
      title: 'Mandatory Statutory Document Completeness',
      description: 'Illustrative test only; not a statement of official AICTE requirements. Checks configured document presence.',
      category: 'ALL',
      officialSourceReference: 'Illustrative prototype assumption; source not independently verified',
      isOfficial: false,
      ruleType: 'MANDATORY_DOCUMENT',
      severity: 'CRITICAL',
      logicConfigJson: JSON.stringify({ requiredCategories: ['LAND_TITLE_DEED', 'BUILDING_PLAN_APPROVAL', 'FIRE_SAFETY_NOC', 'OCCUPANCY_CERTIFICATE', 'SOCIETY_TRUST_REGISTRATION', 'FDR_FINANCIAL_ENDOWMENT'] }),
    },
    {
      code: 'RULE-APH-02',
      title: 'Fire Safety NOC Validity Assessment',
      description: 'Illustrative test only; not a statement of official AICTE requirements. Checks expiry against a configured reference date.',
      category: 'ALL',
      officialSourceReference: 'Illustrative prototype assumption; source not independently verified',
      isOfficial: false,
      ruleType: 'EXPIRY_CHECK',
      severity: 'CRITICAL',
      logicConfigJson: JSON.stringify({ referenceDate: '2026-06-30', documentType: 'FIRE_SAFETY_NOC' }),
    },
    {
      code: 'RULE-APH-03',
      title: 'Minimum Contiguous Land Area Norm',
      description: 'Illustrative test only; acreage thresholds are unverified and configurable in this prototype.',
      category: 'ENGINEERING_TECH',
      officialSourceReference: 'Illustrative prototype assumption; threshold not independently verified',
      isOfficial: false,
      ruleType: 'MINIMUM_THRESHOLD',
      severity: 'CRITICAL',
      logicConfigJson: JSON.stringify({ minimumAcres: { ENGINEERING_TECH: 2.5, MANAGEMENT: 1.0, PHARMACY: 0.75, ARCHITECTURE: 1.0, POLYTECHNIC: 1.5 } }),
    },
    {
      code: 'RULE-APH-04',
      title: 'Cross-Document Sponsoring Entity Name Consistency',
      description: 'Illustrative test only; compares configured names across two uploaded documents.',
      category: 'ALL',
      officialSourceReference: 'Illustrative prototype assumption; source not independently verified',
      isOfficial: false,
      ruleType: 'CROSS_DOCUMENT_CONSISTENCY',
      severity: 'MAJOR',
      logicConfigJson: JSON.stringify({ matchThreshold: 0.85 }),
    },
    {
      code: 'RULE-APH-05',
      title: 'Sponsoring Society / Trust Legal Standing',
      description: 'Illustrative rule type; no deterministic registration verification is implemented, so findings require human review.',
      category: 'ALL',
      officialSourceReference: 'Illustrative prototype assumption; source not independently verified',
      isOfficial: false,
      ruleType: 'FORMAT_VALIDITY',
      severity: 'CRITICAL',
      logicConfigJson: JSON.stringify({ documentType: 'SOCIETY_TRUST_REGISTRATION' }),
    },
    {
      code: 'RULE-APH-06',
      title: 'Municipal Building Sanction & Structural Safety',
      description: 'Illustrative test only; checks configured document presence and is not an official requirement.',
      category: 'ALL',
      officialSourceReference: 'Illustrative prototype assumption; source not independently verified',
      isOfficial: false,
      ruleType: 'MANDATORY_DOCUMENT',
      severity: 'CRITICAL',
      logicConfigJson: JSON.stringify({ documentType: 'BUILDING_PLAN_APPROVAL' }),
    },
    {
      code: 'RULE-APH-07',
      title: 'Joint FDR Financial Endowment Corpus',
      description: 'Verifies creation of Fixed Deposit Receipt in joint name of Regional Officer AICTE and Sponsoring Society (Min ₹1.00 Crore for Engineering).',
      category: 'ENGINEERING_TECH',
      officialSourceReference: 'Illustrative prototype assumption; threshold not independently verified',
      isOfficial: false,
      ruleType: 'MINIMUM_THRESHOLD',
      severity: 'CRITICAL',
      logicConfigJson: JSON.stringify({ minimumCorpusInr: 10000000 }),
    },
    {
      code: 'RULE-APH-08',
      title: 'Cryptographic Document Integrity & Duplicate Detection',
      description: 'Illustrative integrity check for repeated file hashes; it does not determine intent or fraud.',
      category: 'ALL',
      officialSourceReference: 'BharatSatya Automated Digital Integrity Safeguard Standard (SIH26261)',
      isOfficial: false, // Illustrative Antigravity rule
      ruleType: 'DUPLICATE_CHECK',
      severity: 'CRITICAL',
      logicConfigJson: JSON.stringify({ algorithm: 'SHA-256' }),
    },
    {
      code: 'RULE-APH-09',
      title: 'Mandatory Statutory Field Completeness',
      description: 'Illustrative test only; verifies that statutory registration, authority, and validity fields are present on uploaded clearances.',
      category: 'ALL',
      officialSourceReference: 'Illustrative prototype assumption; threshold not independently verified',
      isOfficial: false,
      ruleType: 'MANDATORY_FIELD_CHECK',
      severity: 'MAJOR',
      logicConfigJson: JSON.stringify({ requiredFields: ['REGISTRATION_REF_NO'] }),
    },
    {
      code: 'RULE-APH-10',
      title: 'Statutory Order Chronological Date Sequence',
      description: 'Illustrative test only; checks that certificate expiry dates chronologically succeed sanction and issue dates.',
      category: 'ALL',
      officialSourceReference: 'Illustrative prototype assumption; threshold not independently verified',
      isOfficial: false,
      ruleType: 'DATE_CONSISTENCY',
      severity: 'CRITICAL',
      logicConfigJson: JSON.stringify({ checkChronology: true }),
    },
    {
      code: 'RULE-APH-11',
      title: 'Institutional Permanent Identifier Alignment',
      description: 'Illustrative test only; verifies that document permanent institution identifiers match authorized application records.',
      category: 'ALL',
      officialSourceReference: 'Illustrative prototype assumption; threshold not independently verified',
      isOfficial: false,
      ruleType: 'IDENTIFIER_CONSISTENCY',
      severity: 'CRITICAL',
      logicConfigJson: JSON.stringify({ checkPermanentId: true }),
    },
    {
      code: 'RULE-INF-01',
      title: 'Library and Reading Room Area',
      description: 'Illustrative test only; compares library area measured from the floor plan with a configured minimum.',
      category: 'ALL',
      officialSourceReference: 'Illustrative prototype assumption; threshold not independently verified',
      isOfficial: false,
      ruleType: 'INFRASTRUCTURE_NORM',
      severity: 'MAJOR',
      logicConfigJson: JSON.stringify({ facility: 'Library and reading room', documentType: 'FLOOR_PLAN', fieldName: 'LIBRARY_AREA_SQM', unit: 'm²', minimumByCategory: { ENGINEERING_TECH: 400, MANAGEMENT: 150, PHARMACY: 150, ARCHITECTURE: 200, POLYTECHNIC: 150 } }),
    },
    {
      code: 'RULE-INF-02',
      title: 'Classroom Carpet Area',
      description: 'Illustrative test only; compares total classroom area measured from the floor plan with a configured minimum.',
      category: 'ALL',
      officialSourceReference: 'Illustrative prototype assumption; threshold not independently verified',
      isOfficial: false,
      ruleType: 'INFRASTRUCTURE_NORM',
      severity: 'MAJOR',
      logicConfigJson: JSON.stringify({ facility: 'Classrooms', documentType: 'FLOOR_PLAN', fieldName: 'CLASSROOM_AREA_SQM', unit: 'm²', minimum: 396 }),
    },
  ];

  for (const r of rules) {
    const createdRule = await prisma.validationRule.create({
      data: {
        code: r.code,
        title: r.title,
        description: r.description,
        category: r.category,
        officialSourceReference: r.officialSourceReference,
        isOfficial: r.isOfficial,
        ruleType: r.ruleType,
        severity: r.severity as 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO',
        logicConfigJson: r.logicConfigJson,
        version: 1,
        isActive: true,
      },
    });

    await prisma.validationRuleVersion.create({
      data: {
        ruleId: createdRule.id,
        version: 1,
        title: createdRule.title,
        description: createdRule.description,
        category: createdRule.category,
        officialSourceReference: createdRule.officialSourceReference,
        isOfficial: createdRule.isOfficial,
        ruleType: createdRule.ruleType,
        severity: createdRule.severity,
        isActive: createdRule.isActive,
        logicConfigJson: createdRule.logicConfigJson,
        changedByUserId: adminUser.id,
        changeReason: 'Baseline regulatory framework import',
      },
    });
  }

  // 4. Case 1: Fully Compliant Application (AICTE-2026-ENG-4821)
  const app1 = await prisma.application.create({
    data: {
      id: 'AICTE-2026-ENG-4821',
      institutionId: vjitInst.id,
      category: 'ENGINEERING_TECH',
      academicYear: '2026-2027',
      status: 'VERIFIED_RECOMMENDED',
      currentStage: 'Automated Compliance Scrutiny Clear',
      assignedReviewerId: reviewerUser.id,
      submissionDate: new Date('2026-09-15T10:30:00Z'),
      lastEvaluatedAt: new Date('2026-09-16T14:20:00Z'),
      recommendedAction: 'Forward to Regional Committee for Extension of Approval (EOA) issuance.',
      remarks: 'All 6 statutory documents verified against official state registries. Land area 5.25 acres exceeds norm.',
    },
  });

  const land1 = createSampleDocFile('vjit_land_deed.pdf', 'REGISTERED LAND TITLE DEED\nInstitution Name: Vidya Jyothi Institute of Technology\nSurvey No: 48/1A, 48/2\nArea measuring 5.25 Acres in clear unencumbered possession\nSub-Registrar Office Hyderabad 1998');
  const fire1 = createSampleDocFile('vjit_fire_noc.pdf', 'STATE DISASTER RESPONSE & FIRE SERVICES DEPARTMENT\nCertificate No: NOC/FIRE/HYD/2024/8812\nInstitution Name: Vidya Jyothi Institute of Technology\nValid Up To: 2027-08-31\nOperational hydrant and emergency exits verified.');
  const bld1 = createSampleDocFile('vjit_building_plan.pdf', 'GREATER HYDERABAD MUNICIPAL CORPORATION\nSanction Order No: GHMC/BP/1092/2019\nApproval Date: 2019-04-12\nApproved Institutional Campus Built-up Area 28,450 sq.m.');
  const occ1 = createSampleDocFile('vjit_occupancy_cert.pdf', 'OCCUPANCY CERTIFICATE GHMC\nCertificate No: OC/9912/GHMC\nInstitution: Vidya Jyothi Institute of Technology\nCertified structurally sound and fit for educational occupancy.');
  const soc1 = createSampleDocFile('vjit_society_reg.pdf', 'REGISTRAR OF SOCIETIES TELANGANA\nReg No: 1402/1997\nSociety Name: Vidya Jyothi Educational Society\nRegistered Office: Hyderabad.');
  const fdr1 = createSampleDocFile('vjit_fdr_receipt.pdf', 'STATE BANK OF INDIA - FIXED DEPOSIT RECEIPT\nJoint Account: Regional Officer AICTE and Vidya Jyothi Educational Society\nPrincipal Sum of INR 1,50,00,000 (One Crore Fifty Lakhs Only)\nMaturity Date: 2031-03-31');

  // Documents for App 1
  const docLand1 = await prisma.document.create({
    data: {
      applicationId: app1.id,
      documentType: 'LAND_TITLE_DEED',
      title: 'Registered Land Title Deed',
      fileName: land1.storageKey,
      originalName: 'Land_Title_Deed_5.25Acres.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: land1.size,
      fileHashSha256: land1.hash,
      storagePath: land1.storageKey,
      status: 'VALIDATED',
    },
  });
  await prisma.extractedField.create({
    data: {
      documentId: docLand1.id,
      applicationId: app1.id,
      fieldName: 'LAND_AREA_ACRES',
      fieldLabel: 'Contiguous Land Area (Acres)',
      fieldValue: '5.25',
      originalExtractedValue: '5.25 Acres',
      confidence: null,
      evidenceSnippet: '...Area measuring 5.25 Acres in clear unencumbered possession...',
    },
  });
  await prisma.extractedField.create({
    data: {
      documentId: docLand1.id,
      applicationId: app1.id,
      fieldName: 'INSTITUTION_NAME',
      fieldLabel: 'Institution / Sponsoring Legal Entity Name',
      fieldValue: 'Vidya Jyothi Institute of Technology',
      originalExtractedValue: 'Vidya Jyothi Institute of Technology',
      confidence: null,
      evidenceSnippet: '...Institution Name: Vidya Jyothi Institute of Technology...',
    },
  });

  const docFire1 = await prisma.document.create({
    data: {
      applicationId: app1.id,
      documentType: 'FIRE_SAFETY_NOC',
      title: 'State Fire Services Clearance NOC',
      fileName: fire1.storageKey,
      originalName: 'Fire_Safety_NOC_2024_2027.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: fire1.size,
      fileHashSha256: fire1.hash,
      storagePath: fire1.storageKey,
      status: 'VALIDATED',
    },
  });
  await prisma.extractedField.create({
    data: {
      documentId: docFire1.id,
      applicationId: app1.id,
      fieldName: 'FIRE_NOC_EXPIRY_DATE',
      fieldLabel: 'Fire Safety NOC Validity / Expiry Date',
      fieldValue: '2027-08-31',
      originalExtractedValue: '2027-08-31',
      confidence: null,
      evidenceSnippet: '...Valid Up To: 2027-08-31...',
    },
  });

  const docSoc1 = await prisma.document.create({
    data: {
      applicationId: app1.id,
      documentType: 'SOCIETY_TRUST_REGISTRATION',
      title: 'Society Registration Certificate',
      fileName: soc1.storageKey,
      originalName: 'Society_Reg_1402.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: soc1.size,
      fileHashSha256: soc1.hash,
      storagePath: soc1.storageKey,
      status: 'VALIDATED',
    },
  });
  await prisma.extractedField.create({
    data: {
      documentId: docSoc1.id,
      applicationId: app1.id,
      fieldName: 'INSTITUTION_NAME',
      fieldLabel: 'Institution / Sponsoring Legal Entity Name',
      fieldValue: 'Vidya Jyothi Educational Society',
      originalExtractedValue: 'Vidya Jyothi Educational Society',
      confidence: null,
      evidenceSnippet: '...Society Name: Vidya Jyothi Educational Society...',
    },
  });

  const docFdr1 = await prisma.document.create({
    data: {
      applicationId: app1.id,
      documentType: 'FDR_FINANCIAL_ENDOWMENT',
      title: 'Joint AICTE Fixed Deposit Receipt',
      fileName: fdr1.storageKey,
      originalName: 'SBI_FDR_1.5Cr.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: fdr1.size,
      fileHashSha256: fdr1.hash,
      storagePath: fdr1.storageKey,
      status: 'VALIDATED',
    },
  });
  await prisma.extractedField.create({
    data: {
      documentId: docFdr1.id,
      applicationId: app1.id,
      fieldName: 'FDR_AMOUNT_INR',
      fieldLabel: 'Joint FDR Corpus Amount (INR)',
      fieldValue: '15000000',
      originalExtractedValue: '₹ 1,50,00,000',
      confidence: null,
      evidenceSnippet: '...Principal Sum of INR 1,50,00,000 (One Crore Fifty Lakhs Only)...',
    },
  });

  await prisma.document.create({
    data: {
      applicationId: app1.id,
      documentType: 'BUILDING_PLAN_APPROVAL',
      title: 'Municipal Building Sanction Order',
      fileName: bld1.storageKey,
      originalName: 'GHMC_Sanction_Plan.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: bld1.size,
      fileHashSha256: bld1.hash,
      storagePath: bld1.storageKey,
      status: 'VALIDATED',
    },
  });

  await prisma.document.create({
    data: {
      applicationId: app1.id,
      documentType: 'OCCUPANCY_CERTIFICATE',
      title: 'Municipal Occupancy Certificate',
      fileName: occ1.storageKey,
      originalName: 'Occupancy_Certificate_GHMC.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: occ1.size,
      fileHashSha256: occ1.hash,
      storagePath: occ1.storageKey,
      status: 'VALIDATED',
    },
  });

  // App 1 Verification Requests
  await prisma.verificationRequest.create({
    data: {
      applicationId: app1.id,
      provider: 'BHU_NAKSHA_STATE_LAND_REGISTRY',
      referenceId: 'Survey-48/1A-Rangareddy',
      status: 'VERIFIED',
      responseSummary: '[DEMO SIMULATION] Clear institutional land title registered with Department of Revenue, Telangana.',
      evidenceReference: 'Survey Registry Khata Vol 14, Page 22',
      isDemoSimulation: true,
    },
  });

  await prisma.verificationRequest.create({
    data: {
      applicationId: app1.id,
      provider: 'STATE_FIRE_SERVICES_PORTAL',
      referenceId: 'NOC/FIRE/HYD/2024/8812',
      status: 'VERIFIED',
      responseSummary: '[DEMO SIMULATION] Fire Safety Clearance order active in Directorate of Fire Services portal.',
      evidenceReference: 'Fire NOC Archive 8812/2024',
      isDemoSimulation: true,
    },
  });

  // 5. Case 2: Missing Required Document (AICTE-2026-MGT-2041)
  const app2 = await prisma.application.create({
    data: {
      id: 'AICTE-2026-MGT-2041',
      institutionId: kimsInst.id,
      category: 'MANAGEMENT',
      academicYear: '2026-2027',
      status: 'DEFICIENCY_FLAGGED',
      currentStage: 'Deficiency Identified — Scrutiny Observations Filed',
      assignedReviewerId: reviewerUser.id,
      submissionDate: new Date('2026-09-20T11:00:00Z'),
      lastEvaluatedAt: new Date('2026-09-21T09:30:00Z'),
      recommendedAction: 'Issue statutory deficiency notice to upload mandatory Fire Safety NOC.',
      remarks: 'Application submitted without mandatory Fire Safety NOC clearance.',
    },
  });

  const land2 = createSampleDocFile('kims_land_deed.pdf', 'REGISTERED LEASE DEED\nInstitution Name: Kalinga Institute of Management Studies\nArea measuring 2.10 Acres\nBhubaneswar Development Authority.');
  await prisma.document.create({
    data: {
      applicationId: app2.id,
      documentType: 'LAND_TITLE_DEED',
      title: 'Land Title / Lease Deed',
      fileName: land2.storageKey,
      originalName: 'KIMS_Land_Deed.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: land2.size,
      fileHashSha256: land2.hash,
      storagePath: land2.storageKey,
      status: 'EXTRACTED',
    },
  });

  // 6. Case 3: Expired Fire Safety Certificate (AICTE-2026-PHR-1190)
  const app3 = await prisma.application.create({
    data: {
      id: 'AICTE-2026-PHR-1190',
      institutionId: saraswatiInst.id,
      category: 'PHARMACY',
      academicYear: '2026-2027',
      status: 'DEFICIENCY_FLAGGED',
      currentStage: 'Deficiency Identified — Expired Statutory Clearance',
      assignedReviewerId: reviewerUser.id,
      submissionDate: new Date('2026-09-25T14:15:00Z'),
      lastEvaluatedAt: new Date('2026-09-26T16:00:00Z'),
      recommendedAction: 'Direct institution to provide renewed Fire Safety NOC before approval consideration.',
      remarks: 'Fire Safety NOC expired on 2025-12-31, prior to 2026-27 cycle evaluation date.',
    },
  });

  const fire3 = createSampleDocFile('saraswati_fire_expired.pdf', 'MAHARASHTRA FIRE SERVICES DIRECTORATE\nCertificate No: NOC/PUNE/2023/1029\nInstitution: Saraswati College of Pharmacy\nValid Up To: 2025-12-31\nAnnual mock drill pending.');
  const docFire3 = await prisma.document.create({
    data: {
      applicationId: app3.id,
      documentType: 'FIRE_SAFETY_NOC',
      title: 'Expired Fire Safety NOC',
      fileName: fire3.storageKey,
      originalName: 'Fire_NOC_Expired_2025.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: fire3.size,
      fileHashSha256: fire3.hash,
      storagePath: fire3.storageKey,
      status: 'DEFICIENT',
    },
  });
  await prisma.extractedField.create({
    data: {
      documentId: docFire3.id,
      applicationId: app3.id,
      fieldName: 'FIRE_NOC_EXPIRY_DATE',
      fieldLabel: 'Fire Safety NOC Validity / Expiry Date',
      fieldValue: '2025-12-31',
      originalExtractedValue: '2025-12-31',
      confidence: null,
      evidenceSnippet: '...Valid Up To: 2025-12-31...',
    },
  });

  // 7. Case 4: Mismatched Legal Name across Documents (AICTE-2026-ARC-8902)
  const app4 = await prisma.application.create({
    data: {
      id: 'AICTE-2026-ARC-8902',
      institutionId: nalandaInst.id,
      category: 'ARCHITECTURE',
      academicYear: '2026-2027',
      status: 'DEFICIENCY_FLAGGED',
      currentStage: 'Legal Title Inconsistency Flagged',
      assignedReviewerId: reviewerUser.id,
      submissionDate: new Date('2026-10-01T09:45:00Z'),
      lastEvaluatedAt: new Date('2026-10-02T11:10:00Z'),
      recommendedAction: 'Require registered deed of rectification establishing title continuity.',
      remarks: 'Entity name mismatch between Land Title Deed and Society Registration.',
    },
  });

  const land4 = createSampleDocFile('nalanda_land.pdf', 'DEED OF CONVEYANCE\nInstitution Name: Nalanda Foundation for Higher Learning\nSurvey No: 91/B\nArea: 1.85 Acres.');
  const soc4 = createSampleDocFile('nalanda_soc.pdf', 'REGISTRATION OF SOCIETIES BIHAR\nReg No: 409/2014\nSociety Name: Magadh Educational Trust Society\nPatna.');

  const docLand4 = await prisma.document.create({
    data: {
      applicationId: app4.id,
      documentType: 'LAND_TITLE_DEED',
      title: 'Land Conveyance Deed',
      fileName: land4.storageKey,
      originalName: 'Land_Title_Foundation.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: land4.size,
      fileHashSha256: land4.hash,
      storagePath: land4.storageKey,
      status: 'EXTRACTED',
    },
  });
  await prisma.extractedField.create({
    data: {
      documentId: docLand4.id,
      applicationId: app4.id,
      fieldName: 'INSTITUTION_NAME',
      fieldLabel: 'Institution / Sponsoring Legal Entity Name',
      fieldValue: 'Nalanda Foundation for Higher Learning',
      originalExtractedValue: 'Nalanda Foundation for Higher Learning',
      confidence: null,
      evidenceSnippet: '...Institution Name: Nalanda Foundation for Higher Learning...',
    },
  });

  const docSoc4 = await prisma.document.create({
    data: {
      applicationId: app4.id,
      documentType: 'SOCIETY_TRUST_REGISTRATION',
      title: 'Society Registration Certificate',
      fileName: soc4.storageKey,
      originalName: 'Magadh_Society_Reg.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: soc4.size,
      fileHashSha256: soc4.hash,
      storagePath: soc4.storageKey,
      status: 'EXTRACTED',
    },
  });
  await prisma.extractedField.create({
    data: {
      documentId: docSoc4.id,
      applicationId: app4.id,
      fieldName: 'INSTITUTION_NAME',
      fieldLabel: 'Institution / Sponsoring Legal Entity Name',
      fieldValue: 'Magadh Educational Trust Society',
      originalExtractedValue: 'Magadh Educational Trust Society',
      confidence: null,
      evidenceSnippet: '...Society Name: Magadh Educational Trust Society...',
    },
  });

  // 8. Case 5: Exact Cryptographic Duplicate File (AICTE-2026-POL-7714)
  const app5 = await prisma.application.create({
    data: {
      id: 'AICTE-2026-POL-7714',
      institutionId: ambedkarInst.id,
      category: 'POLYTECHNIC',
      academicYear: '2026-2027',
      status: 'DEFICIENCY_FLAGGED',
      currentStage: 'Digital Integrity Alert — Duplicate File Submitted',
      assignedReviewerId: reviewerUser.id,
      submissionDate: new Date('2026-10-05T15:00:00Z'),
      lastEvaluatedAt: new Date('2026-10-06T10:00:00Z'),
      recommendedAction: 'Summon institution representative for verification of authentic building clearance.',
      remarks: 'Building Plan approval is a duplicate copy of the occupancy certificate (identical SHA-256 hash).',
    },
  });

  const dupContent = 'MUNICIPAL TOWN PLANNING SANCTION ORDER\nNagpur Municipal Corporation Order No 4402/2018\nIdentical Byte Level Content';
  const dupFile1 = createSampleDocFile('ambedkar_bld.pdf', dupContent);
  const dupFile2 = createSampleDocFile('ambedkar_occ_duplicate.pdf', dupContent); // exact duplicate bytes

  await prisma.document.create({
    data: {
      applicationId: app5.id,
      documentType: 'BUILDING_PLAN_APPROVAL',
      title: 'Municipal Building Sanction Order',
      fileName: dupFile1.storageKey,
      originalName: 'Building_Sanction_NMC.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: dupFile1.size,
      fileHashSha256: dupFile1.hash,
      storagePath: dupFile1.storageKey,
      status: 'DEFICIENT',
      isDuplicate: false,
    },
  });

  await prisma.document.create({
    data: {
      applicationId: app5.id,
      documentType: 'OCCUPANCY_CERTIFICATE',
      title: 'Occupancy Certificate (Duplicate Upload)',
      fileName: dupFile2.storageKey,
      originalName: 'Occupancy_Certificate_NMC.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: dupFile2.size,
      fileHashSha256: dupFile2.hash,
      storagePath: dupFile2.storageKey,
      status: 'DEFICIENT',
      isDuplicate: true,
    },
  });

  // Execute compliance evaluation on all applications to generate real findings
  const { evaluateApplicationCompliance } = await import('./rules/engine.js');
  const dbRules = await prisma.validationRule.findMany();
  const ruleMap = new Map(dbRules.map((r) => [r.code, r.id]));

  for (const appId of [app1.id, app2.id, app3.id, app4.id, app5.id]) {
    const findings = await evaluateApplicationCompliance(appId);
    for (const f of findings) {
      const ruleId = ruleMap.get(f.ruleCode);
      if (!ruleId) continue;
      await prisma.validationFinding.create({
        data: {
          applicationId: appId,
          ruleId,
          ruleVersionId: f.ruleVersionId,
          status: f.status,
          severity: f.severity,
          title: f.title,
          message: f.message,
          evidenceLocation: f.evidenceLocation,
          evidenceSnippet: f.evidenceSnippet,
          evidenceComparisonJson: f.evidenceComparison ? JSON.stringify(f.evidenceComparison) : null,
        },
      });
    }
  }

  // 9. Initial Audit Trail Events
  await prisma.auditEvent.create({
    data: {
      actorId: adminUser.id,
      actorName: adminUser.name,
      actorRole: adminUser.role,
      action: 'SYSTEM_INITIALIZATION',
      entityType: 'System',
      entityId: 'ROOT',
      afterStateJson: JSON.stringify({ version: '1.0.0', framework: 'APH 2026-27' }),
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorId: reviewerUser.id,
      actorName: reviewerUser.name,
      actorRole: reviewerUser.role,
      action: 'COMPLIANCE_EVALUATION_EXECUTED',
      entityType: 'Application',
      entityId: app1.id,
      afterStateJson: JSON.stringify({ status: 'VERIFIED_RECOMMENDED' }),
    },
  });

  console.log('[BharatSatya Seed] Database seeded successfully with 5 institutions, 3 roles, 8 rules, and 5 test cases.');
}

main()
  .catch(() => {
    console.error('[BharatSatya Seed] Failed. Database and credential details are suppressed. Check the test target, migrations, and seed safeguards.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
