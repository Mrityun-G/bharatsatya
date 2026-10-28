import assert from 'assert';

const BASE_URL = 'http://127.0.0.1:5000/api';

async function req(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('--- 1. Verifying /api/health ---');
  const health = await req('/health');
  assert.strictEqual(health.status, 200, 'Health check must be 200');
  assert.strictEqual(health.data.status, 'UP');
  assert.strictEqual(health.data.dependencies.database, 'available');
  console.log('✓ /api/health passed: DB available');

  console.log('\n--- 2. Verifying Unauthenticated Rejection ---');
  const unauth = await req('/applications');
  assert.strictEqual(unauth.status, 401, 'Unauthenticated request must return 401');
  assert.strictEqual(unauth.data.error, 'AuthenticationRequired');
  console.log('✓ Unauthenticated request rejected with 401 AuthenticationRequired');

  console.log('\n--- 3. Verifying Authentication & Token Minting ---');
  // Applicant Login
  const appLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'principal@vjit.ac.in', password: process.env.DEMO_APPLICANT_PASSWORD || 'Applicant@VJIT2026' }),
  });
  assert.strictEqual(appLogin.status, 200, 'Applicant login must be 200');
  assert.strictEqual(appLogin.data.data.user.role, 'APPLICANT');
  const applicantToken = appLogin.data.data.token;
  const applicantInstId = appLogin.data.data.user.institution.id;
  console.log(`✓ Applicant authenticated: ${appLogin.data.data.user.name} (${applicantInstId})`);

  // Reviewer Login
  const revLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'reviewer.deshmukh@aicte.gov.in', password: process.env.DEMO_REVIEWER_PASSWORD || 'Reviewer@AICTE2026' }),
  });
  assert.strictEqual(revLogin.status, 200, 'Reviewer login must be 200');
  assert.strictEqual(revLogin.data.data.user.role, 'REVIEWER');
  const reviewerToken = revLogin.data.data.token;
  console.log(`✓ Reviewer authenticated: ${revLogin.data.data.user.name}`);

  // Admin Login
  const adminLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@aicte.gov.in', password: process.env.DEMO_ADMIN_PASSWORD || 'Admin@AICTE2026' }),
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login must be 200');
  assert.strictEqual(adminLogin.data.data.user.role, 'ADMIN');
  const adminToken = adminLogin.data.data.token;
  console.log(`✓ Admin authenticated: ${adminLogin.data.data.user.name}`);

  console.log('\n--- 4. Verifying Application Listing & Scoping ---');
  // Reviewer lists all
  const revApps = await req('/applications', { headers: { Authorization: `Bearer ${reviewerToken}` } });
  assert.strictEqual(revApps.status, 200);
  console.log(`✓ Reviewer views all applications: ${revApps.data.data.length} total applications found`);

  // Reviewer views dashboard overview
  const revOverview = await req('/dashboard/overview', { headers: { Authorization: `Bearer ${reviewerToken}` } });
  assert.strictEqual(revOverview.status, 200);
  assert.strictEqual(revOverview.data.success, true);
  assert(revOverview.data.data.summary, 'Dashboard must include summary');
  console.log(`✓ Reviewer dashboard loaded: total=${revOverview.data.data.summary.totalApplications}, recent=${revOverview.data.data.recentApplications?.length}`);

  // Applicant lists only their institution
  const appApps = await req('/applications', { headers: { Authorization: `Bearer ${applicantToken}` } });
  assert.strictEqual(appApps.status, 200);
  const foreignApps = appApps.data.data.filter((a: any) => a.institutionId !== applicantInstId);
  assert.strictEqual(foreignApps.length, 0, 'Applicant must not see other institutions');
  console.log(`✓ Applicant views scoped applications: ${appApps.data.data.length} applications (all belonging to ${applicantInstId})`);

  // Applicant views scoped dashboard overview
  const appOverview = await req('/dashboard/overview', { headers: { Authorization: `Bearer ${applicantToken}` } });
  assert.strictEqual(appOverview.status, 200);
  assert.strictEqual(appOverview.data.success, true);
  console.log(`✓ Applicant dashboard loaded: total=${appOverview.data.data.summary.totalApplications}`);

  console.log('\n--- 5. Verifying Application Creation ---');
  const createRes = await req('/applications', {
    method: 'POST',
    headers: { Authorization: `Bearer ${applicantToken}` },
    body: JSON.stringify({
      institutionId: applicantInstId,
      category: 'ENGINEERING_TECH',
      academicYear: '2026-2027',
    }),
  });
  assert.strictEqual(createRes.status, 201, 'Application creation must return 201 Created');
  const newAppId = createRes.data.data.id;
  assert.match(newAppId, /^AICTE-2026-ENG-\d+$/, 'Application ID must match regulatory pattern');
  assert.strictEqual(createRes.data.data.status, 'SUBMITTED');
  console.log(`✓ Application created successfully: ${newAppId} (Status: ${createRes.data.data.status})`);

  console.log('\n--- 6. Verifying Cross-Institution Data Isolation ---');
  // Applicant trying to view an application belonging to KIMS (INST-002)
  const foreignAppId = 'AICTE-2026-MGT-2041';
  const forbiddenView = await req(`/applications/${foreignAppId}`, { headers: { Authorization: `Bearer ${applicantToken}` } });
  assert.strictEqual(forbiddenView.status, 403, 'Applicant accessing foreign application must return 403 Forbidden');
  assert.strictEqual(forbiddenView.data.error, 'ForbiddenAccess');
  console.log(`✓ Cross-institution access blocked: 403 ForbiddenAccess for foreign app ${foreignAppId}`);

  console.log('\n--- 7. Verifying Role-Based Access Control (RBAC) ---');
  // Applicant trying to modify rules (Admin only)
  const forbiddenRule = await req('/rules', {
    method: 'POST',
    headers: { Authorization: `Bearer ${applicantToken}` },
    body: JSON.stringify({ title: 'Illegal Rule' }),
  });
  assert.strictEqual(forbiddenRule.status, 403, 'Applicant creating rule must return 403 Forbidden');
  console.log('✓ Applicant blocked from Admin route: 403 Forbidden');

  // Reviewer trying to modify rules (Admin only)
  const reviewerRule = await req('/rules', {
    method: 'POST',
    headers: { Authorization: `Bearer ${reviewerToken}` },
    body: JSON.stringify({ title: 'Illegal Rule' }),
  });
  assert.strictEqual(reviewerRule.status, 403, 'Reviewer creating rule must return 403 Forbidden');
  console.log('✓ Reviewer blocked from Admin route: 403 Forbidden');

  // Admin listing rules (Permitted)
  const adminRules = await req('/rules', { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.strictEqual(adminRules.status, 200);
  console.log(`✓ Admin successfully accesses rules: ${adminRules.data.data.length} active rules`);

  console.log('\n======================================================');
  console.log('>>> ALL BACKEND VERIFICATION CHECKS PASSED (100%) <<<');
  console.log('======================================================');
}

run().catch((e) => {
  console.error('VERIFICATION FAILURE:', e);
  process.exit(1);
});
