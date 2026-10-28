# BharatSatya (भारतसत्य)
### AI-Assisted Application Validation & Regulatory Compliance Decision-Support Platform for AICTE
**Problem Statement:** SIH26261 · AI-Powered Application Validation, Document Authentication and Regulatory Compliance Verification

---

## 1. Executive Summary

**BharatSatya** is a prototype decision-support application for SIH26261. Seeded applications and external-source responses are synthetic demonstrations. Rule references and thresholds have not been independently verified against official AICTE guidance; do not use this prototype to make regulatory decisions.

### Core Capabilities:
- **Statutory Document Intake:** Authenticated local disk intake supporting PDF and image files with MIME metadata checks, 10MB limits, and SHA-256 hashing.
- **Rules Scrutiny:** Active rules, categories, thresholds and versions are read from PostgreSQL. Unsupported or incomplete checks require manual review. Seed rules are illustrative until independently verified.
- **Document Intelligence Workspace:** Text PDFs are extracted with PyMuPDF. Scanned PDFs and images use Tesseract when installed; unavailable or unreadable extraction returns an explicit error. Confidence remains unset where no calibrated extraction score exists.
- **Digital Integrity Safeguards:** Real-time cryptographic duplicate file detection preventing recycled or conflicting submissions.
- **External verification:** Seeded verification records are labeled as simulations. Adapter implementations are not connected to the application flow; no external services are queried.
- **Audit:** Rule changes, review actions and status changes are written in the same transaction as their mutation. PostgreSQL blocks update/delete of audit rows. Some events, including verification requests, have no interactive action path yet.

---

## 2. Visual Design & Indian Public Sector UI Philosophy

BharatSatya reflects modern Indian public-sector enterprise software (inspired by GeM, DigiLocker, and AICTE National Portals):
- **Typography:** Calibri and high-legibility system sans-serif fallback.
- **National Government Palette:**
  - Deep Navy: `#17365D` (Command & Primary Actions)
  - Restrained Saffron: `#E87524` (Alerts & High-Priority Scrutiny)
  - Muted Forest Green: `#287A52` (Statutory Compliance & Clear Passes)
  - Neutral Slate Grey: `#5D6673` (Data labels & Secondary metadata)
  - Background: Pristine White (`#FFFFFF`) and Light Neutral Grey (`#F8F9FA`).
- **Layout:** National tri-color header accent strip, Satyameva Jayate council banner, persistent sidebar navigation, hierarchical breadcrumbs, compact high-density data tables, and evidence comparison panels.
- **Strictly Avoided:** AI-generated glowing gradients, glassmorphism, oversized marketing hero cards, and superficial placeholder charts.

---

## 3. Technology Stack

- **Frontend:** React 18, TypeScript 5, Vite 5, React Router v6, Axios, Lucide Icons, Custom CSS Design Token System.
- **Backend:** Node.js v22, Express, TypeScript, Prisma ORM, Multer (bounded in-memory upload staging), private local/S3-compatible document storage, Zod schema validation, JWT / Bcrypt authentication.
- **Database:** PostgreSQL is the only active Prisma provider. `DATABASE_URL` is the application/pooler URL; `DIRECT_URL` is for migration connections.
- **Document Processing:** SHA-256 checksum engine, PyMuPDF text extraction and optional Tesseract OCR for scanned PDFs/images.
- **Testing:** Vitest suite and Supertest API integration tests.
- **Deployment:** Vercel serverless runtime and static hosting configuration.

---

## 4. User Roles & Demo Credentials

The platform includes a 1-click **Demo Role Switcher** in the top navigation bar:

| Role | Name & Title | Institution / Department | Email |
|---|---|---|---|
| Applicant | Demo Applicant | Vidya Jyothi Institute of Technology | `principal@vjit.ac.in` |
| Reviewer | Demo Reviewer | AICTE Regional Directorate | `reviewer.deshmukh@aicte.gov.in` |
| Administrator | Demo Administrator | AICTE Headquarters, New Delhi | `admin@aicte.gov.in` |

Demo passwords must be supplied through local environment variables; do not use demo accounts in a deployed environment.
---

## 5. Acceptance Test Suite

The existing suite in `server/src/tests/acceptance.test.ts` exercises upload rejection, duplicate hashing, rule evaluation, OCR recovery, review actions, role checks, and report data using synthetic seed data. Passing these tests does not establish official rule correctness or production readiness.

1. **Synthetic application:** `AICTE-2026-ENG-4821` contains seeded land, fire NOC, and FDR values; these are fixtures, not verified compliance conclusions.
2. **Missing Required Document:** `AICTE-2026-MGT-2041` flags missing Fire Safety NOC (`RULE-APH-01`, Status: `MISSING`, Severity: `CRITICAL`).
3. **Expired Certificate Flagging:** `AICTE-2026-PHR-1190` flags Fire Safety NOC expired on `2025-12-31` relative to the cycle reference date `2026-06-30` (`RULE-APH-02`, Status: `EXPIRED`).
4. **Mismatched Identifiers / Legal Names:** `AICTE-2026-ARC-8902` detects discrepancy between Land Conveyance Deed (*"Nalanda Foundation"*) and Society Registration (*"Magadh Educational Trust"*) (`RULE-APH-04`, Status: `MISMATCH`).
5. **Exact Cryptographic Duplicate File:** `AICTE-2026-POL-7714` detects identical SHA-256 hash across two uploaded files (`RULE-APH-08`, Status: `MISMATCH`).
6. **OCR Failure Recoverability:** Corrupted or unreadable files produce structured recoverable errors with manual field entry fallback.
7. **Clarification Persistence:** Reviewer issues a clarification notice, transitions status to `CLARIFICATION_REQUESTED`, and persists state across refreshes.
8. **Audit Trail Logging:** Every consequential status transition creates an immutable append-only `AuditEvent` record with actor identity and reason.
9. **Role-Based Access Enforcement:** Unauthorized applicants cannot transition review statuses or access admin rule management (HTTP 403 Forbidden).
10. **Validation Report Parity:** Downloadable and printable Validation Dossier accurately reflects all saved findings, checksums, and verification adapter results.

---

## 6. Local Setup & Execution Guide

### Prerequisites
- Node.js (v18+ or v22 LTS)
- npm (v9+)

### Installation & Initialization

1. **Clone or Navigate to the Workspace:**
   ```bash
   cd C:\Users\chris\.gemini\antigravity\scratch\bharatsatya
   ```

2. **Configure local environment and install dependencies:**
   ```powershell
   if (-not (Test-Path server/.env)) { Copy-Item .env.example server/.env }
   cd server
   npm install
   ```
   Configure local authentication/demo values as needed. Do not run migrations or synthetic seeding against the ordinary database in `server/.env`; use the isolated test workflow below.

3. **Run Automated Test Suite:**
   ```bash
   npm test
   ```
   `npm test` runs database-independent unit tests. The database-backed suite is available only through `npm run test:acceptance`, which requires explicitly designated local test URLs.

4. **Install Client Dependencies:**
   ```bash
   cd ../client
   npm install
   npm run build
   ```

5. **Start Development Servers:**
   Follow the safe **First Local Run (Windows PowerShell)** workflow below. It creates a new uniquely named disposable local database and never resets an existing one.

6. **Access Application:**
   Open [http://localhost:5173](http://localhost:5173) in your browser. Local demo-account metadata is visible only when `DEMO_ACCOUNTS_MODE=local` and `NODE_ENV=development`; the API returns no passwords. Enter the locally configured demo password through the normal login form.

### First Local Run (Windows PowerShell)

Prerequisites: PostgreSQL is installed, and Node/npm dependencies are installed. Inspect the installed service by name, then start only that exact service manually if needed (administrator rights may be required):

```powershell
Get-Service -Name 'postgresql*' | Select-Object Name, Status
Start-Service -Name '<exact PostgreSQL service name from the previous command>'
```

Do not use a wildcard with `Start-Service`. Do not use the example database name `bharatsatya` for setup; create a new uniquely named disposable database. The application will not start or manage PostgreSQL for you.

First create `server/.env` without replacing an existing file, then edit it locally with a long random `JWT_SECRET`, three demo passwords (at least 12 characters each), `NODE_ENV=development`, `DEMO_ACCOUNTS_MODE=local`, `CORS_ORIGIN="http://localhost:5173"`, `DOCUMENT_STORAGE_PROVIDER=local`, and a private local `UPLOAD_DIR`. Do not paste secrets into commands or commit `server/.env`. Demo discovery is bound to loopback in this mode and the API returns safe metadata only.

Google sign-in is available only in API mode for accounts already provisioned in PostgreSQL. Configure the same OAuth Web client ID as `GOOGLE_CLIENT_ID` in `server/.env` and `VITE_GOOGLE_CLIENT_ID` in `client/.env.local`, set `VITE_DEMO_MODE=false`, and follow [Google Identity setup](client/GOOGLE_OAUTH_SETUP.md). The popup flow uses authorized JavaScript origins rather than a redirect URI; no client secret belongs in frontend configuration. Apply the Google identity migration before using the endpoint. Demo mode remains synthetic and does not load Google Identity Services.

From `server/`, run the following in one PowerShell window. `createdb` fails if the generated name already exists; stop on any failed check and generate a different name. The URI and password variables are held only in this PowerShell process and are not printed. PostgreSQL tools may prompt for the local database account password.

```powershell
$dbName = "bharatsatya_test_$([guid]::NewGuid().ToString('N'))"
$dbUser = Read-Host 'Local PostgreSQL username'
$credential = Get-Credential -UserName $dbUser -Message 'Local PostgreSQL credentials'
$dbPassword = $credential.GetNetworkCredential().Password
$env:PGPASSWORD = $dbPassword
createdb -h 127.0.0.1 -U $dbUser $dbName
if ($LASTEXITCODE -ne 0) { throw 'Database creation failed; stop and use a new generated name.' }
$confirmedName = psql -h 127.0.0.1 -U $dbUser -d $dbName -Atc 'select current_database()'
if ($LASTEXITCODE -ne 0 -or $confirmedName -ne $dbName) { throw 'Connected database did not match the newly created database; stop.' }
$tableCount = psql -h 127.0.0.1 -U $dbUser -d $dbName -Atc "select count(*) from pg_tables where schemaname='public'"
if ($LASTEXITCODE -ne 0 -or [int]$tableCount -ne 0) { throw 'Database is not confirmed empty; stop without migrating or seeding.' }
$userPart = [uri]::EscapeDataString($credential.UserName)
$passwordPart = [uri]::EscapeDataString($dbPassword)
$databaseUrl = "postgresql://${userPart}:${passwordPart}@127.0.0.1:5432/$dbName?schema=public"
$env:DATABASE_URL = $databaseUrl
$env:DIRECT_URL = $databaseUrl
$env:TEST_DATABASE_URL = $databaseUrl
$env:TEST_DIRECT_URL = $databaseUrl
$env:PGPASSWORD = $null
$dbPassword = $null
npm exec -- prisma validate --schema=prisma/schema.prisma
if ($LASTEXITCODE -ne 0) { throw 'Prisma validation failed; stop.' }
npm exec -- prisma migrate deploy --schema=prisma/schema.prisma
if ($LASTEXITCODE -ne 0) { throw 'Migration failed; do not seed.' }
npm exec -- prisma migrate status --schema=prisma/schema.prisma
if ($LASTEXITCODE -ne 0) { throw 'Migration status failed; do not seed.' }
$env:ALLOW_SYNTHETIC_SEED = 'true'
npm run seed
if ($LASTEXITCODE -ne 0) { throw 'Seed failed; do not start the demo.' }
$env:ALLOW_SYNTHETIC_SEED = $null
$env:TEST_DATABASE_URL = $null
$env:TEST_DIRECT_URL = $null
npm run dev
```

The synthetic seed refuses non-empty databases. Keep this database disposable and do not run reset/drop commands against other databases. The server remains running in this window. In a second PowerShell window, run `cd C:\Users\chris\.gemini\antigravity\scratch\bharatsatya\client` then `npm run dev`; the Vite proxy forwards `/api` to `127.0.0.1:5000`. Check `http://localhost:5173` and `http://localhost:5000/api/health`; health returns HTTP 200 only when PostgreSQL is reachable and otherwise a sanitized HTTP 503.

To enable scanned-document OCR, install Python dependencies from `server/src/ocr/requirements.txt` and Tesseract separately. OCR is optional for starting the app; unavailable OCR must remain an explicit extraction failure.

---

## 7. Deployment Status

The Vercel configuration is an unverified API/static build target, not a verified production deployment. PostgreSQL is the active schema and the migration uses `DIRECT_URL`; API functions should receive a pooled PostgreSQL `DATABASE_URL`. Uploads use a private S3-compatible adapter when `DOCUMENT_STORAGE_PROVIDER=s3` and all required credentials are valid; otherwise production uploads fail closed. Downloads stream through the authenticated API after application authorization. The Python OCR service can be deployed separately using `server/ocr.Dockerfile`; it requires a service token and a restricted HTTPS/private network route. Do not process real records or documents until deployment-specific checks pass.

Before deployment, configure pooled and direct PostgreSQL URLs, provision a private S3-compatible bucket with public access blocked, set `DOCUMENT_STORAGE_PROVIDER=s3` and all `OBJECT_STORAGE_*` values in `.env.example`, and set `OBJECT_STORAGE_PRIVATE_BUCKET_CONFIRMED=true` only after verifying anonymous reads are blocked. The API runs an authenticated bucket preflight before accepting each upload. Grant the storage identity only bucket/prefix-scoped `ListBucket` (for preflight), `GetObject`, `PutObject`, and `DeleteObject` permissions. Deploy the separate OCR container, then set its base `OCR_SERVICE_URL` and a matching service token of at least 32 characters. These storage and OCR variables are consumed by the application. No deployment has been performed or verified.

S3-compatible access uses signed AWS Signature Version 4 requests from the API and streams downloads through the authenticated route; it does not issue object URLs. Set `OBJECT_STORAGE_FORCE_PATH_STYLE=true` for providers such as R2 or MinIO when required. Keep the bucket private with public access blocked. Existing rows containing legacy local filesystem paths need a deliberate, separately verified migration before changing an existing deployment to S3; local development retains safe read-only compatibility for paths contained within its private upload directory.

Deployment readiness checklist:

1. Provision PostgreSQL and set pooled `DATABASE_URL` plus direct `DIRECT_URL` in the deployment environment; apply migrations with `cd server && npm exec -- prisma migrate deploy --schema=prisma/schema.prisma`.
2. Set `NODE_ENV=production`, a unique `JWT_SECRET`, `DEMO_ACCOUNTS_MODE=disabled`, and the exact `CORS_ORIGIN`. Never copy local `.env` files into deployment settings.
3. Create a private bucket with public access blocked and configure all `OBJECT_STORAGE_*` values. Production uploads remain disabled (`503 PrivateStorageNotConfigured`) until the selected S3-compatible provider configuration validates.
4. Build the OCR service from the server directory with `docker build -f ocr.Dockerfile -t bharatsatya-ocr .`. For a local smoke run, inject a token via your local secrets manager/shell and run `docker run --rm -p 127.0.0.1:8000:8000 -e OCR_SERVICE_TOKEN bharatsatya-ocr`; health is `GET /healthz`. In deployment, publish it only on a private network or behind TLS and an ingress allowlist; where Vercel cannot reach a private route, use an authenticated gateway with strict ingress controls rather than unrestricted public access. Set the API's `OCR_SERVICE_URL` to the service base URL and the matching token. The API sends `Authorization: Bearer …` with multipart `file` and `documentType` fields to `POST /v1/extract`; success returns JSON `{rawText, confidence, fields, error, isRecoverable}`, while auth, size, and content errors return HTTP 401, 413, and 400/415. Both sides enforce a 10 MB cap, the API enforces a configurable timeout, and OCR workers cap scanned PDFs at 6 pages with a per-page Tesseract timeout.
5. Build with `npm run build:server` and `npm run build:client`; verify `/api/health`, role permissions, private document downloads, and the complete acceptance suite against a dedicated staging database. Vercel uploads are capped at 4 MiB to remain below the documented 4.5 MB Function request/response body cap; direct Node deployments accept 10 MiB. Configure the API function duration to accommodate the OCR timeout on the selected Vercel plan. [Vercel Functions limits](https://vercel.com/docs/functions/limitations).
6. Deploy only after each check passes, then test the deployed URL. No Vercel deployment or deployed URL has been tested for this repository.

### Frontend-only SIH demonstration deployment

The client supports a separate static Vercel deployment that does not require Express, PostgreSQL, OCR, or object storage. In this build, existing screens use one browser-local synthetic data adapter; the API-backed build remains the default when `VITE_DEMO_MODE` is not exactly `true`.

1. Create a separate Vercel project for this repository and set **Root Directory** to `client`.
2. Use `npm install` for installation, `npm run build` for build, and `dist` as the output directory. `client/vercel.json` rewrites nested routes to `index.html` so direct navigation and refresh work.
3. Add the build-time environment variable `VITE_DEMO_MODE=true`. This is a public frontend setting, not a secret. Never put database, JWT, OCR, or object-storage credentials in any `VITE_*` variable.
4. Deploy the project, then manually verify `/login`, each role, application creation, intake messaging, review, rule-management interactions, report output, and a refreshed nested route.

Demo role selection is only a presentation feature and is not secure authentication or authorization. All records and events are synthetic and persist only in the visitor's browser storage; if browser storage is unavailable, the page reports that changes last only for that tab. Selected file binaries are discarded and never uploaded, hashed, stored, or processed. The visible demo banner and report disclaimer identify the simulated behavior. The reset control restores the initial synthetic dataset. No Vercel project has been deployed or tested for this repository.

### Local OCR on Windows

Install Tesseract OCR for Windows (for example, the UB Mannheim Windows distribution), add its installation directory to `PATH`, then open a new PowerShell window and verify with `Get-Command tesseract` and `tesseract --version`. Set `OCR_TESSERACT_LANG` to installed language codes (default `eng`); trained-data files must be present in Tesseract's `tessdata` directory. The backend uses PyMuPDF for embedded PDF text and invokes Tesseract only for image-only PDFs and image uploads. Missing Tesseract or unreadable files return explicit extraction errors; OCR confidence remains null unless Tesseract supplies word confidence values.

### Safe PostgreSQL integration test setup

The acceptance suite and seed refuse targets unless both `TEST_DATABASE_URL` and `TEST_DIRECT_URL` point to the same local PostgreSQL database named `bharatsatya_test_<32-character-guid>`. The acceptance setup overrides `DATABASE_URL` and `DIRECT_URL` from those explicit test-only variables, forces local test storage into a temporary directory, and removes that directory after the suite. The seed independently checks that the runtime URLs match the designated local test database, requires `ALLOW_SYNTHETIC_SEED=true`, and refuses to seed if any application table contains rows. It never resets or deletes database records. Before seeding, configure `JWT_SECRET` with at least 32 characters and each of `DEMO_ADMIN_PASSWORD`, `DEMO_REVIEWER_PASSWORD`, and `DEMO_APPLICANT_PASSWORD` with at least 12 characters in the local server environment; do not print or commit these values.

After installing/configuring PostgreSQL and starting its local service yourself, run these commands from `server/`. The generated database name is unique; `createdb` must succeed, and the checks must confirm the target name and zero public tables before migrations. Replace the connection placeholders locally; do not commit credentials:

```powershell
$testDb = "bharatsatya_test_$([guid]::NewGuid().ToString('N'))"
createdb -h 127.0.0.1 -U TEST_USER $testDb
if ($LASTEXITCODE -ne 0) { throw 'Test database creation failed; do not continue.' }
$confirmedName = psql -h 127.0.0.1 -U TEST_USER -d $testDb -Atc 'select current_database()'
if ($confirmedName -ne $testDb) { throw 'Connected database name did not match the new test database.' }
$publicTableCount = psql -h 127.0.0.1 -U TEST_USER -d $testDb -Atc "select count(*) from pg_tables where schemaname='public'"
if ($LASTEXITCODE -ne 0) { throw 'Could not verify the public schema; do not continue.' }
if ([int]$publicTableCount -ne 0) { throw 'The new test database is not empty; do not migrate or seed it.' }
$env:TEST_DATABASE_URL = "postgresql://TEST_USER:TEST_PASSWORD@127.0.0.1:5432/$testDb?schema=public"
$env:TEST_DIRECT_URL = $env:TEST_DATABASE_URL
$env:DATABASE_URL = $env:TEST_DATABASE_URL
$env:DIRECT_URL = $env:TEST_DIRECT_URL
npm exec -- prisma validate --schema=prisma/schema.prisma
if ($LASTEXITCODE -ne 0) { throw 'Prisma validation failed; do not continue.' }
npm exec -- prisma migrate deploy --schema=prisma/schema.prisma
if ($LASTEXITCODE -ne 0) { throw 'Migration failed; do not seed or run acceptance tests.' }
npm exec -- prisma migrate status --schema=prisma/schema.prisma
if ($LASTEXITCODE -ne 0) { throw 'Migration status is not clean; do not seed or run acceptance tests.' }
$appliedMigrations = @(psql -h 127.0.0.1 -U TEST_USER -d $testDb -Atc 'select migration_name from public."_prisma_migrations" where finished_at is not null and rolled_back_at is null order by migration_name')
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect migration history; do not seed or run acceptance tests.' }
$expectedMigrations = @('20261022_init', '20261023_rule_snapshots_and_audit_guard', '20261024_google_identity', '20261024_verification_actor')
if (Compare-Object $expectedMigrations $appliedMigrations) { throw 'Migration history does not match the repository migrations; stop.' }
$env:ALLOW_SYNTHETIC_SEED = 'true'
npm run seed
if ($LASTEXITCODE -ne 0) { throw 'Synthetic seed failed; do not run acceptance tests.' }
npm run test:acceptance
```

If creation or target/empty checks fail, stop and choose another newly generated name. Never drop/reset a database to make room. Do not run `npm run test:acceptance` or `npm run seed` against a development or production database. `npm test` remains safe to run without PostgreSQL.

## 8. Illustrative Rule References

The seed data includes illustrative rule references and thresholds labeled with APH 2026-27 clauses. These references have not been verified and must not be represented as official requirements:
- **RULE-APH-01:** Mandatory Statutory Document Intake (Chapter II, Clause 2.1)
- **RULE-APH-02:** Fire Safety NOC Validity Assessment (Chapter II, Clause 2.14)
- **RULE-APH-03:** Minimum Contiguous Land Area Norms (Appendix 4, Table 4.1)
- **RULE-APH-04:** Cross-Document Legal Ownership Name Continuity (Chapter I, Clause 1.6)
- **RULE-APH-05:** Sponsoring Non-Profit Society / Trust Standing (Clause 1.4)
- **RULE-APH-06:** Municipal Building Sanction & Structural Safety (Clause 2.11)
- **RULE-APH-07:** Joint AICTE Regional Officer FDR Endowment Fund (Chapter I, Clause 1.9)
- **RULE-APH-08:** Cryptographic Document Duplicate Detection (Digital Integrity Standard SIH26261)

---

## 9. Security & Privacy Safeguards

- Passwords hashed using standard `bcryptjs` with 10 salt rounds.
- Role-based authorization enforced at every Express API route.
- Opaque random document keys, file signature/size checks, private storage, and authenticated application-scoped download streaming.
- Append-only audit database logging with actor IP address and user-agent.
- No sensitive institutional documents exposed to public third-party services.
