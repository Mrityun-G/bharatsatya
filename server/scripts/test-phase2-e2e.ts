import assert from 'assert';
import fs from 'fs';
import { execFileSync } from 'child_process';

async function testUpload() {
  console.log('--- 1. Authenticating as Applicant ---');
  const loginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'principal@vjit.ac.in', password: 'Applicant@VJIT2026' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data.token;
  assert(token, 'Must return token');

  console.log('--- 2. Creating New Regulatory Application ---');
  const appRes = await fetch('http://127.0.0.1:5000/api/applications', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ institutionId: 'INST-001', category: 'ENGINEERING_TECH', academicYear: '2026-2027' }),
  });
  const appData = await appRes.json();
  const appId = appData.data.id;
  console.log(`Created Application: ${appId}`);

  console.log('--- 3. Ingesting Digital PDF (Fire Safety NOC) ---');
  let pdfBuffer: Buffer;
  if (fs.existsSync('test_fire_noc.pdf')) {
    pdfBuffer = fs.readFileSync('test_fire_noc.pdf');
  } else {
    // Generate valid PDF via python if not present
    const python = process.platform === 'win32' ? 'python' : 'python3';
    execFileSync(python, [
      '-c',
      "import fitz; d=fitz.open(); p=d.new_page(); p.insert_text((72,72),'GOVERNMENT OF TELANGANA\\nFire Safety NOC No: NOC/FIRE/HYD/2026/8841\\nInstitution Name: Vidya Jyothi Institute of Technology\\nDate of Issue: 10/01/2024\\nValid Up To: 31/12/2026\\nIssuing Authority: Directorate of Fire Services\\n'); d.save('test_fire_noc.pdf')",
    ]);
    pdfBuffer = fs.readFileSync('test_fire_noc.pdf');
  }

  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  const form = new FormData();
  form.append('file', blob, 'fire_safety_noc.pdf');
  form.append('applicationId', appId);
  form.append('documentType', 'FIRE_SAFETY_NOC');
  form.append('title', 'Statutory Fire NOC Order');

  const uploadRes = await fetch('http://127.0.0.1:5000/api/documents/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const uploadJson = await uploadRes.json();
  console.log(`Upload HTTP Status: ${uploadRes.status}`);
  assert.strictEqual(uploadRes.status, 201, 'Upload must succeed with 201');
  assert.strictEqual(uploadJson.data.isDuplicate, false);
  console.log(`Extracted ${uploadJson.data.extractedFields?.length} structured fields:`);
  for (const f of uploadJson.data.extractedFields || []) {
    console.log(`  * ${f.fieldName} (Page ${f.evidencePage}): ${f.fieldValue}`);
  }

  console.log('\n--- 4. Authenticating as AICTE Scrutiny Reviewer ---');
  const revLogin = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'reviewer.deshmukh@aicte.gov.in', password: 'Reviewer@AICTE2026' }),
  });
  const revData = await revLogin.json();
  const revToken = revData.data.token;

  console.log('--- 5. Reviewer Inspecting Dossier & Regulatory Scrutiny Findings ---');
  const dossierRes = await fetch(`http://127.0.0.1:5000/api/applications/${appId}`, {
    headers: { Authorization: `Bearer ${revToken}` },
  });
  const dossier = await dossierRes.json();
  assert.strictEqual(dossierRes.status, 200);

  const doc = dossier.data.documents[0];
  console.log(`Document Ingested: ${doc.originalName} (${doc.documentType})`);
  console.log(`SHA-256 Checksum: ${doc.fileHashSha256}`);
  console.log(`Extraction Status: ${doc.status}`);
  console.log(`OCR Confidence: ${doc.ocrConfidence === null ? 'Null (Uninvented for Digital PDF)' : doc.ocrConfidence}`);

  console.log(`Active Regulatory Findings (${dossier.data.validationFindings?.length}):`);
  for (const finding of dossier.data.validationFindings || []) {
    console.log(`  [${finding.status}] ${finding.rule?.code || finding.ruleId}: ${finding.title}`);
  }

  console.log('\n--- 6. Testing Duplicate File Ingestion & Anomaly Flagging ---');
  const dupForm = new FormData();
  dupForm.append('file', blob, 'fire_safety_noc_reupload.pdf');
  dupForm.append('applicationId', appId);
  dupForm.append('documentType', 'OCCUPANCY_CERTIFICATE');
  dupForm.append('title', 'Re-uploaded identical binary under different type');

  const dupUploadRes = await fetch('http://127.0.0.1:5000/api/documents/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: dupForm,
  });

  const dupJson = await dupUploadRes.json();
  assert.strictEqual(dupUploadRes.status, 201);
  assert.strictEqual(dupJson.data.isDuplicate, true, 'Must detect duplicate SHA-256 hash');
  console.log(`Duplicate Hash Detected: ${dupJson.data.isDuplicate}`);
  console.log(`Document Status: ${dupJson.data.document.status} (Flagged Deficient)`);

  // Verify that RULE-APH-08 now triggers MISMATCH in findings
  const reDossierRes = await fetch(`http://127.0.0.1:5000/api/applications/${appId}`, {
    headers: { Authorization: `Bearer ${revToken}` },
  });
  const reDossier = await reDossierRes.json();
  const dupFinding = reDossier.data.validationFindings.find((f: any) => f.rule?.code === 'RULE-APH-08');
  assert.strictEqual(dupFinding.status, 'MISMATCH', 'RULE-APH-08 must flag MISMATCH for identical hash');
  console.log(`RULE-APH-08 Finding: [${dupFinding.status}] ${dupFinding.message}`);

  console.log('\n>>> Live End-to-End Ingestion & Scrutiny Verified Successfully <<<');
}

testUpload().catch((e) => {
  console.error('E2E FAILURE:', e);
  process.exit(1);
});
