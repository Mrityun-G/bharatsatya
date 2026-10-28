// Synthetic responses for anomaly indicators, source verification, infrastructure compliance
// and alerts in frontend-only demo mode. No external source is contacted and no file is analysed.

const EXTRAS_KEY = 'bharatsatya_frontend_demo_extras_v1';
const DEMO_APP = 'AICTE-DEMO-2026-0001';

type Rec = Record<string, any>;
interface ExtrasState { verifications: Rec[]; notifications: Rec[] }

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function freshExtras(): ExtrasState {
  const v = (id: string, documentName: string, documentType: string, provider: string, referenceId: string, status: string, responseSummary: string, evidenceReference: string, minutes: number) => ({
    id, applicationId: DEMO_APP, provider, referenceId, status, responseSummary, evidenceReference, isDemoSimulation: true,
    requestedAt: ago(minutes + 1), completedAt: status === 'PENDING' ? null : ago(minutes),
    document: { id: `${id}-DOC`, originalName: documentName, documentType },
    requestedBy: { name: 'Demo Reviewer', role: 'REVIEWER' },
  });
  return {
    verifications: [
      v('VER-DEMO-01', 'nba-accreditation.pdf', 'AICTE_PREVIOUS_EOA', 'NBA_ACCREDITATION_REGISTER', 'NBA/2025/ENG/0417', 'VERIFIED', '[DEMO SIMULATION] Accredited programmes and validity match the register.', 'Official portal lookup · simulated', 40),
      v('VER-DEMO-02', 'state-dte-noc.pdf', 'BUILDING_PLAN_APPROVAL', 'STATE_TECHNICAL_EDUCATION_DIRECTORATE', 'DTE/TS/NOC/2026/3381', 'MISMATCH_DETECTED', '[DEMO SIMULATION] Source returned NOC number DTE/TS/NOC/2026/3318 and 3 permitted programmes; submission lists 4.', 'Authorized API · simulated', 55),
      v('VER-DEMO-03', 'fire-noc.pdf', 'FIRE_SAFETY_NOC', 'STATE_FIRE_SERVICES_PORTAL', 'TSFS/HYD/2025/11873', 'EXPIRED', '[DEMO SIMULATION] QR code genuine; certificate valid upto 14 Sep 2026.', 'QR code on document · simulated', 90),
      v('VER-DEMO-04', 'trust-registration.pdf', 'SOCIETY_TRUST_REGISTRATION', 'REGISTRAR_OF_SOCIETIES', 'SOC/RR/112/1998', 'PENDING', '[DEMO SIMULATION] Request queued with the registrar.', 'Reference number lookup · simulated', 180),
      v('VER-DEMO-05', 'occupancy-certificate.pdf', 'OCCUPANCY_CERTIFICATE', 'MUNICIPAL_BUILDING_PORTAL', 'GHMC/OC/2019/2231', 'SOURCE_UNAVAILABLE', '[DEMO SIMULATION] Municipal portal timed out three times.', 'Official portal lookup · simulated', 240),
      v('VER-DEMO-06', 'land-title-deed.pdf', 'LAND_TITLE_DEED', 'BHU_NAKSHA_STATE_LAND_REGISTRY', 'KH-214/2', 'MANUAL_REVIEW_REQUIRED', '[DEMO SIMULATION] Digital signature valid; owner name only partly matches the trust record.', 'Digital signature check · simulated', 300),
    ],
    notifications: [
      { id: 'ALERT-DEMO-1', applicationId: DEMO_APP, type: 'ANOMALY', title: 'Possible anomaly in occupancy-certificate.pdf', message: 'Produced with editing software; File saved with later revisions. Preliminary indicator for human verification.', isRead: false, createdAt: ago(12) },
      { id: 'ALERT-DEMO-2', applicationId: DEMO_APP, type: 'EXPIRED', title: 'Source confirms document expired', message: 'The state fire services portal reports the Fire NOC is no longer valid.', isRead: false, createdAt: ago(90) },
      { id: 'ALERT-DEMO-3', applicationId: DEMO_APP, type: 'SOURCE_UNAVAILABLE', title: 'Verification source unavailable', message: 'The municipal building portal could not be reached. Manual confirmation is needed.', isRead: false, createdAt: ago(240) },
      { id: 'ALERT-DEMO-4', applicationId: DEMO_APP, type: 'MISSING', title: 'Missing information or documents', message: '1 item(s): Audited balance sheet FY 2025–26', isRead: true, createdAt: ago(600) },
    ],
  };
}

let extras: ExtrasState | null = null;
function load(): ExtrasState {
  if (extras) return extras;
  try {
    const stored = localStorage.getItem(EXTRAS_KEY);
    if (stored) { extras = JSON.parse(stored) as ExtrasState; return extras; }
  } catch { /* fall through to a fresh synthetic set */ }
  extras = freshExtras();
  return extras;
}
function save() { try { localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras)); } catch { /* demo state stays in memory */ } }
export function resetDemoExtras() { extras = null; try { localStorage.removeItem(EXTRAS_KEY); } catch { /* no-op */ } }

const anomalyFlags = (institutionName: string) => [
  { code: 'CROSS_INSTITUTION_DUPLICATE', severity: 'HIGH', title: 'Same file submitted by another institution', documentName: 'land-title-deed.pdf', evidence: 'SHA-256 9f2ca71e04b3… also in application AICTE-DEMO-2026-0007', reason: 'A byte-identical document was uploaded for a different institution.', nextStep: 'Hold both cases and compare the documents side by side.' },
  { code: 'MISMATCHED_IDENTIFIER', severity: 'HIGH', title: 'Identifier does not match the record', documentName: 'state-dte-noc.pdf', evidence: "Document PID '1-4251310' vs authorized '1-4251301'", reason: 'RULE-APH-11: Document contains a Permanent ID that does not match the institution record.', nextStep: 'Verify the identifier with the issuing authority.' },
  { code: 'EDITING_SOFTWARE', severity: 'MEDIUM', title: 'Produced with editing software', documentName: 'occupancy-certificate.pdf', evidence: 'PDF producer/creator: "iLovePDF"', reason: 'Issuing offices normally scan or export certificates; an editing tool in the metadata means the file was opened and saved in an editor.', nextStep: 'Request the original scanned copy or verify with the issuing authority.' },
  { code: 'INCREMENTAL_REVISIONS', severity: 'MEDIUM', title: 'File saved with later revisions', documentName: 'occupancy-certificate.pdf', evidence: '3 revision markers (%%EOF) in an unsigned PDF', reason: 'Content was appended after the first save, which is how in-place edits to a PDF are stored.', nextStep: 'Compare the earliest revision with the submitted version.' },
  { code: 'CREATED_LONG_AFTER_ISSUE', severity: 'LOW', title: 'File created long after stated issue date', documentName: 'occupancy-certificate.pdf', evidence: 'Issue date 2019-03-17; file created 2026-10-19', reason: 'The digital file is much newer than the certificate it claims to be.', nextStep: 'Request the originally issued copy.' },
  { code: 'NO_CAPTURE_METADATA', severity: 'LOW', title: 'No camera metadata', documentName: 'computer-lab-2.jpg', evidence: 'No EXIF block found', reason: 'Capture date, device and location cannot be confirmed; metadata is often removed when an image is edited or forwarded.', nextStep: 'Ask for originals straight from the camera, or a geotagged photo.' },
].map((f) => ({ ...f, id: `${DEMO_APP}:${f.code}:${f.documentName}`, applicationId: DEMO_APP, institutionName }));

function infrastructureFor(app: Rec) {
  const base = { application: { id: app.id, category: app.category, status: app.status, institution: { name: app.institution?.name, aictePermanentId: app.institution?.aictePermanentId } }, advisory: 'Synthetic demonstration. Automated observations are advisory; inspection and approval decisions remain with the competent AICTE authority.' };
  if (app.id !== DEMO_APP) return { ...base, norms: [], evidence: [], recommendation: 'NO_INFRASTRUCTURE_RULES', reasons: [] };
  const norm = (id: string, facility: string, required: number, measured: number | null, unit: string, status: string, message: string, evidenceLocation: string) => ({ id, ruleCode: id, facility, required, measured, unit, status, message, evidenceLocation, citation: 'Illustrative prototype assumption' });
  return {
    ...base,
    norms: [
      norm('RULE-INF-02', 'Classrooms', 396, 462, 'm²', 'PASSED', 'Classrooms: 462 m² measured meets the configured norm of 396 m².', 'floor-plan-A02.pdf'),
      norm('RULE-INF-01', 'Library and reading room', 400, 248, 'm²', 'MISMATCH', 'Library and reading room: 248 m² measured is below the configured norm of 400 m².', 'floor-plan-A03.pdf'),
      norm('RULE-INF-03', 'Computer centre seats', 90, null, 'PCs', 'MANUAL_REVIEW_REQUIRED', 'Computer centre seats could not be measured from computer-lab photos; a reviewer must record the value.', 'computer-lab-2.jpg'),
    ],
    evidence: [
      { id: 'EV-1', documentType: 'FLOOR_PLAN', title: 'Floor plan sheet A-03 (library)', originalName: 'floor-plan-A03.pdf', measuredFields: [{ fieldName: 'LIBRARY_AREA_SQM', label: 'Library and Reading Room Area (m²)', value: '248', isCorrected: false }], observations: [], result: 'CONSISTENT' },
      { id: 'EV-2', documentType: 'INFRASTRUCTURE_PHOTO', title: 'Computer lab 2', originalName: 'computer-lab-2.jpg', measuredFields: [], observations: [{ code: 'REUSED_PHOTO', title: 'Same photo used more than once', severity: 'MEDIUM', detail: 'Identical image submitted for lab 2 and lab 4.' }, { code: 'NO_CAPTURE_METADATA', title: 'No camera metadata', severity: 'LOW', detail: 'Capture date, device and location cannot be confirmed.' }], result: 'NEEDS_EVIDENCE' },
      { id: 'EV-3', documentType: 'INFRASTRUCTURE_PHOTO', title: 'Classrooms 1–7', originalName: 'classrooms.jpg', measuredFields: [], observations: [], result: 'CONSISTENT' },
    ],
    recommendation: 'PHYSICAL_INSPECTION_SUGGESTED',
    reasons: ['Library and reading room: 248 m² measured against 400 m² required.', 'Computer centre seats could not be measured from the photos.', 'Computer lab 2: Same photo used more than once.'],
  };
}

interface Ctx {
  method: string; path: string; params: Rec; body: Rec;
  applications: Rec[];
  actor: { id: string; name: string; role: string };
  audit: (action: string, entityType: string, entityId: string, before?: Rec, after?: Rec) => void;
}

/** Returns a response envelope for the extra endpoints, or undefined when the path is not one of them. */
export function dispatchExtras({ method, path, params, body, applications, actor, audit }: Ctx): Rec | undefined {
  const state = load();
  const ok = (data: unknown) => ({ success: true, data });
  const institutionOf = (id: string) => applications.find((a) => a.id === id)?.institution?.name || 'Synthetic institution';

  if (path === '/anomalies' && method === 'get') {
    const flags = applications.some((a) => a.id === DEMO_APP) ? anomalyFlags(institutionOf(DEMO_APP)) : [];
    const pick = params.applicationId ? flags.filter((f) => f.applicationId === params.applicationId) : flags;
    return ok({
      flags: pick,
      summary: { total: pick.length, high: pick.filter((f) => f.severity === 'HIGH').length, medium: pick.filter((f) => f.severity === 'MEDIUM').length, low: pick.filter((f) => f.severity === 'LOW').length, applications: new Set(pick.map((f) => f.applicationId)).size },
      disclaimer: 'Synthetic demonstration. Preliminary indicators for human verification; they are not findings of forgery or misconduct.',
    });
  }

  if (path === '/verifications' && method === 'get') {
    const all: Rec[] = state.verifications.map((v) => ({ ...v, application: { id: v.applicationId, institution: { name: institutionOf(v.applicationId) } } }));
    const scoped = params.applicationId ? all.filter((v) => v.applicationId === params.applicationId) : all;
    const counts: Rec = {};
    for (const s of ['VERIFIED', 'MISMATCH_DETECTED', 'EXPIRED', 'PENDING', 'SOURCE_UNAVAILABLE', 'MANUAL_REVIEW_REQUIRED']) counts[s] = scoped.filter((v) => v.status === s).length;
    return ok({ items: params.status ? scoped.filter((v) => v.status === params.status) : scoped, counts });
  }

  const manual = path.match(/^\/verifications\/([^/]+)\/manual$/);
  if (manual && method === 'patch') {
    const v = state.verifications.find((item) => item.id === decodeURIComponent(manual[1]));
    if (!v) throw Object.assign(new Error('Verification not found in synthetic demo data.'), { response: { status: 404 } });
    if (!['PENDING', 'SOURCE_UNAVAILABLE', 'MANUAL_REVIEW_REQUIRED'].includes(v.status)) throw Object.assign(new Error('Only pending, unavailable or inconclusive verifications can be confirmed manually.'), { response: { status: 409 } });
    const before = { status: v.status, responseSummary: v.responseSummary };
    Object.assign(v, { status: body.status, completedAt: new Date().toISOString(), responseSummary: `Manual confirmation by ${actor.name}: ${body.note}`, evidenceReference: body.confirmationReference });
    audit('DEMO_VERIFICATION_MANUALLY_CONFIRMED', 'VerificationRequest', v.id, before, { applicationId: v.applicationId, status: v.status, confirmationReference: body.confirmationReference });
    save();
    return ok(v);
  }

  const infra = path.match(/^\/infrastructure\/([^/]+)$/);
  if (infra && method === 'get') {
    const app = applications.find((a) => a.id === decodeURIComponent(infra[1]));
    if (!app) throw Object.assign(new Error('Application not found in synthetic demo data.'), { response: { status: 404 } });
    return ok(infrastructureFor(app));
  }

  if (path === '/notifications' && method === 'get') return ok({ items: state.notifications, unreadCount: state.notifications.filter((n) => !n.isRead).length });
  if (path === '/notifications/read-all' && method === 'post') { state.notifications.forEach((n) => { n.isRead = true; }); save(); return ok(null); }
  const read = path.match(/^\/notifications\/([^/]+)\/read$/);
  if (read && method === 'patch') {
    const n = state.notifications.find((item) => item.id === decodeURIComponent(read[1]));
    if (n) { n.isRead = true; save(); }
    return ok(null);
  }
  return undefined;
}
