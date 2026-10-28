import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { User, UserRole } from '../types';
import { dispatchExtras, resetDemoExtras } from './demoExtras';

export const isDemoModeEnabled = (value: unknown): boolean => value === 'true';
export const demoMode = isDemoModeEnabled(import.meta.env.VITE_DEMO_MODE);
const STORAGE_KEY = 'bharatsatya_frontend_demo_v1';
const SESSION_KEY = 'bharatsatya_frontend_demo_role';
const PROFILE_KEY = 'bharatsatya_frontend_demo_profiles_v1';
const PROFILE_SESSION_KEY = 'bharatsatya_frontend_demo_profile';

const applicantInstitution = {
  id: 'INST-DEMO-001', name: 'Vidya Jyothi Institute of Technology', aictePermanentId: '1-4251301',
  address: 'Aziznagar, Hyderabad, Telangana', state: 'Telangana', district: 'Rangareddy', pincode: '500075',
  contactEmail: 'demo-contact@example.invalid', contactPhone: '0000000000', establishedYear: 1998, category: 'ENGINEERING_TECH',
};
const reviewer = { id: 'USER-DEMO-REVIEWER', name: 'Demo Reviewer', email: 'reviewer@example.invalid', role: 'REVIEWER', designation: 'Synthetic Scrutiny Officer', department: 'Demonstration Workspace' };
const users: Record<UserRole, User> = {
  APPLICANT: { id: 'USER-DEMO-APPLICANT', email: 'applicant@example.invalid', name: 'Demo Applicant', role: 'APPLICANT', institution: applicantInstitution },
  REVIEWER: { id: reviewer.id, email: reviewer.email, name: reviewer.name, role: 'REVIEWER', designation: reviewer.designation, department: reviewer.department },
  ADMIN: { id: 'USER-DEMO-ADMIN', email: 'admin@example.invalid', name: 'Demo Administrator', role: 'ADMIN', designation: 'Synthetic Administrator', department: 'Demonstration Workspace' },
};
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const initialRules = [
  { id: 'RULE-DEMO-01', code: 'DEMO-DOC-01', title: 'Illustrative document presence check', description: 'Demonstration only: flags when the selected application has no document of the configured type.', category: 'ALL', officialSourceReference: 'Synthetic demo rule; no official source asserted', isOfficial: false, ruleType: 'MANDATORY_DOCUMENT', severity: 'MAJOR', logicConfigJson: '{"documentType":"FIRE_SAFETY_NOC"}', isActive: true, version: 1, effectiveDate: '2026-01-01T00:00:00.000Z' },
  { id: 'RULE-DEMO-02', code: 'DEMO-REVIEW-01', title: 'Illustrative manual review marker', description: 'Demonstration only: records that human review may be needed for a sample document.', category: 'ALL', officialSourceReference: 'Synthetic demo rule; no official source asserted', isOfficial: false, ruleType: 'MANUAL_REVIEW', severity: 'MINOR', logicConfigJson: '{}', isActive: true, version: 1, effectiveDate: '2026-01-01T00:00:00.000Z' },
];

type DemoRecord = Record<string, any>;
interface DemoState {
  applications: DemoRecord[];
  rules: DemoRecord[];
  auditEvents: DemoRecord[];
}
function freshState(): DemoState {
  const applicationId = 'AICTE-DEMO-2026-0001';
  const documentId = 'DOC-DEMO-001';
  const rules = structuredClone(initialRules);
  const docs = [{
    id: documentId, applicationId, documentType: 'LAND_TITLE_DEED', title: 'Synthetic sample land document', fileName: 'synthetic-land-sample.pdf', originalName: 'synthetic-land-sample.pdf', mimeType: 'application/pdf', fileSizeBytes: 24800, fileHashSha256: 'NOT_COMPUTED_IN_FRONTEND_DEMO', storagePath: 'DEMO-NO-BINARY-STORED', uploadDate: '2026-06-01T10:00:00.000Z', status: 'DEMO_METADATA_ONLY', isDuplicate: false, ocrConfidence: null, ocrRawText: null,
    extractedFields: [
      { id: 'FIELD-DEMO-1', documentId, applicationId, fieldName: 'institution_name', fieldLabel: 'Institution name', fieldValue: 'Vidya Jyothi Institute of Technology', originalExtractedValue: 'Vidya Jyothi Institute of Technology', confidence: null, isCorrected: false, evidencePage: 1, evidenceSnippet: 'Synthetic sample field; not extracted from a real file.' },
      { id: 'FIELD-DEMO-2', documentId, applicationId, fieldName: 'document_reference', fieldLabel: 'Document reference', fieldValue: 'SAMPLE-REF-2026', originalExtractedValue: 'SAMPLE-REF-2026', confidence: null, isCorrected: false, evidencePage: 1, evidenceSnippet: 'Synthetic sample field; not extracted from a real file.' },
    ],
  }];
  const app = {
    id: applicationId, institutionId: applicantInstitution.id, institution: applicantInstitution, category: 'ENGINEERING_TECH', academicYear: '2026-2027', status: 'DEFICIENCY_FLAGGED', submissionDate: '2026-06-01T09:00:00.000Z', lastEvaluatedAt: '2026-06-01T10:05:00.000Z', assignedReviewerId: reviewer.id, assignedReviewer: reviewer, currentStage: 'Illustrative rules review', recommendedAction: 'Human review required', remarks: 'Synthetic demonstration record only.', documents: docs, validationFindings: [], verificationRequests: [{ id: 'VERIFY-DEMO-1', applicationId, provider: 'SIMULATED_ISSUER', referenceId: 'DEMO-REF-001', requestedAt: '2026-06-01T10:02:00.000Z', completedAt: '2026-06-01T10:02:01.000Z', status: 'SIMULATED', responseSummary: 'No external issuer was contacted. This is a simulated demonstration response.', evidenceReference: 'Synthetic demo record', isDemoSimulation: true }], reviewActions: [], auditEvents: [], _count: { documents: 1, validationFindings: 0, verificationRequests: 1 },
  };
  const state = { applications: [app], rules, auditEvents: [] as any[] };
  appendAudit(state, 'DEMO SYSTEM', 'SYSTEM', 'DEMO_DATA_INITIALIZED', 'Application', app.id, undefined, { note: 'Synthetic demonstration dataset' });
  evaluateApplication(app, state.rules);
  return state;
}
let memoryState: DemoState | null = null;

function loadState(): DemoState {
  if (memoryState) return memoryState;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as DemoState;
      if (Array.isArray(parsed.applications) && Array.isArray(parsed.rules) && Array.isArray(parsed.auditEvents)) {
        memoryState = parsed;
        return memoryState;
      }
    }
  } catch { /* Use a fresh in-memory demo if browser storage is unavailable or invalid. */ }
  memoryState = freshState();
  saveState();
  return memoryState;
}
function saveState() {
  if (!memoryState) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState)); } catch { /* Demo remains usable for this tab. */ }
}
export function resetDemoData() {
  resetDemoExtras();
  memoryState = freshState();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState)); } catch { /* The reset still applies in memory. */ }
}
export function getDemoSnapshot() { return structuredClone(loadState()); }
export function demoStorageAvailable() {
  try { const key = `${STORAGE_KEY}_check`; localStorage.setItem(key, '1'); localStorage.removeItem(key); return true; } catch { return false; }
}
export function demoUser(role: UserRole): User { return structuredClone(users[role]); }
export function restoreDemoUser(): User | null {
  try {
    const role = localStorage.getItem(SESSION_KEY) as UserRole | null;
    if (role === 'APPLICANT') {
      const profileId = localStorage.getItem(PROFILE_SESSION_KEY);
      const profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || '[]') as User[];
      const profile = profiles.find((candidate) => candidate.id === profileId);
      if (profile) return structuredClone(profile);
    }
    return role && users[role] ? demoUser(role) : null;
  } catch { return null; }
}
export function setDemoRole(role: UserRole) {
  try { localStorage.setItem(SESSION_KEY, role); localStorage.removeItem(PROFILE_SESSION_KEY); } catch { /* The session remains active for this tab. */ }
}
export function clearDemoRole() { try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(PROFILE_SESSION_KEY); } catch { /* no-op */ } }

export interface DemoProfileInput { name: string; email: string; institutionName: string; designation: string }
export function createDemoProfile(input: DemoProfileInput): User {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const institutionName = input.institutionName.trim();
  const designation = input.designation.trim();
  if (!name || !email || !institutionName || !designation) throw new Error('Complete all profile fields.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  let profiles: User[] = [];
  try { profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || '[]') as User[]; } catch { profiles = []; }
  if (profiles.some((profile) => profile.email.toLowerCase() === email)) throw new Error('A browser-local demo profile already uses this email.');
  const profile: User = { id: id('USER-DEMO-PROFILE'), email, name, role: 'APPLICANT', designation, institution: { ...applicantInstitution, id: id('INST-DEMO-PROFILE'), name: institutionName, contactEmail: email } };
  profiles.push(profile);
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
    localStorage.setItem(SESSION_KEY, 'APPLICANT');
    localStorage.setItem(PROFILE_SESSION_KEY, profile.id);
  } catch {
    // Keep the current tab usable without claiming this profile will persist.
  }
  return structuredClone(profile);
}

function appendAudit(state: DemoState, actorName: string, actorRole: string, action: string, entityType: string, entityId: string, before?: unknown, after?: unknown) {
  const event = { id: id('AUDIT'), actorName, actorRole, action, entityType, entityId, beforeStateJson: before ? JSON.stringify(before) : undefined, afterStateJson: after ? JSON.stringify(after) : undefined, createdAt: now() };
  state.auditEvents.unshift(event);
  const app = state.applications.find((item: any) => item.id === entityId || item.id === (after as any)?.applicationId);
  if (app) app.auditEvents = state.auditEvents.filter((item: any) => item.entityId === app.id || item.afterStateJson?.includes(app.id));
}
function currentActor() {
  const current = restoreDemoUser();
  return current ? { name: current.name, role: current.role, id: current.id } : { name: 'Demo User', role: 'APPLICANT', id: users.APPLICANT.id };
}
function evaluateApplication(app: any, rules: any[]) {
  const docs = app.documents || [];
  const findings: any[] = [];
  for (const rule of rules.filter((candidate) => candidate.isActive && (candidate.category === 'ALL' || candidate.category === app.category))) {
    if (rule.ruleType === 'MANDATORY_DOCUMENT') {
      let documentType = 'FIRE_SAFETY_NOC';
      try { documentType = JSON.parse(rule.logicConfigJson).documentType || documentType; } catch { /* malformed demo rules require manual review */ }
      const found = docs.find((doc: any) => doc.documentType === documentType);
      if (!found) findings.push({ id: id('FINDING'), applicationId: app.id, ruleId: rule.id, rule, status: 'MISSING', severity: rule.severity, title: rule.title, message: `No ${documentType.replace(/_/g, ' ')} metadata is attached. This is an illustrative demo result, not an official compliance decision.`, reviewerAcknowledged: false, createdAt: now() });
      else findings.push({ id: id('FINDING'), applicationId: app.id, ruleId: rule.id, rule, documentId: found.id, document: { id: found.id, originalName: found.originalName, documentType: found.documentType }, status: 'MANUAL_REVIEW_REQUIRED', severity: rule.severity, title: rule.title, message: 'A synthetic document record exists. A human must inspect the actual source document in a real workflow.', evidenceLocation: 'Demo metadata', evidenceSnippet: 'No uploaded binary was stored or processed.', reviewerAcknowledged: false, createdAt: now() });
    } else {
      findings.push({ id: id('FINDING'), applicationId: app.id, ruleId: rule.id, rule, status: 'MANUAL_REVIEW_REQUIRED', severity: rule.severity, title: rule.title, message: 'Illustrative rule output requires human review.', reviewerAcknowledged: false, createdAt: now() });
    }
  }
  app.validationFindings = findings;
  app.lastEvaluatedAt = now();
  app._count = { documents: docs.length, validationFindings: findings.length, verificationRequests: (app.verificationRequests || []).length };
  if (findings.some((finding) => finding.status !== 'PASSED')) app.status = app.status === 'SUBMITTED' ? 'DEFICIENCY_FLAGGED' : app.status;
}
function envelope(data: unknown) { return { success: true, data }; }
function fail(status: number, message: string) { const error = new Error(message) as Error & { response?: unknown }; error.response = { status, data: { message } }; throw error; }
function bodyOf(config: InternalAxiosRequestConfig): any {
  if (!config.data) return {};
  if (typeof config.data === 'string') { try { return JSON.parse(config.data); } catch { return {}; } }
  if (config.data instanceof FormData) return Object.fromEntries(config.data.entries());
  return config.data;
}
function listApplications(params: any = {}) {
  let apps = loadState().applications;
  if (params.category && params.category !== 'ALL') apps = apps.filter((app: any) => app.category === params.category);
  if (params.status && params.status !== 'ALL') apps = apps.filter((app: any) => app.status === params.status);
  if (params.search) { const q = String(params.search).toLowerCase(); apps = apps.filter((app: any) => `${app.id} ${app.institution.name}`.toLowerCase().includes(q)); }
  return structuredClone(apps);
}
function reportFor(app: any) {
  return { reportTitle: 'Synthetic Validation Demonstration Dossier', subTitle: 'Not an official determination or submission', dossierReferenceNumber: `DEMO-${app.id}`, generatedAt: now(), generatedBy: 'Synthetic demo workspace', institutionDetails: app.institution, applicationDetails: app, documentsIntakeSummary: app.documents.map((doc: any) => ({ documentType: doc.documentType, originalName: doc.originalName, sha256Hash: doc.fileHashSha256, isDuplicate: false, simulated: true })), regulatoryFindings: app.validationFindings.map((finding: any) => ({ ruleCode: finding.rule.code, ruleTitle: finding.rule.title, officialReference: finding.rule.officialSourceReference, status: finding.status, message: finding.message, simulated: true })), auditEvents: app.auditEvents, isDemoSimulation: true };
}
function dispatch(config: InternalAxiosRequestConfig): any {
  const state = loadState();
  const method = (config.method || 'get').toLowerCase();
  const url = new URL(config.url || '/', 'http://demo.local');
  const path = url.pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/';
  const params = { ...Object.fromEntries(url.searchParams.entries()), ...(config.params || {}) };
  const body = bodyOf(config);
  const actor = currentActor();
  if (path === '/auth/login' && method === 'post') return envelope({ user: demoUser('APPLICANT'), token: 'demo-session-not-a-credential' });
  if (path === '/auth/me') return envelope(restoreDemoUser() || demoUser('APPLICANT'));
  if (path === '/auth/demo-accounts') return { enabled: false, accounts: [] };
  if (path === '/dashboard/overview') {
    const apps = state.applications;
    const allFindings = apps.flatMap((app: any) => app.validationFindings || []);
    return envelope({ summary: { totalApplications: apps.length, pendingReview: apps.filter((a: any) => !['APPROVED', 'REJECTED_NON_COMPLIANT'].includes(a.status)).length, verifiedRecommended: apps.filter((a: any) => a.status === 'VERIFIED_RECOMMENDED').length, deficiencies: { missingDocuments: allFindings.filter((f: any) => f.status === 'MISSING').length, expiredDocuments: 0, mismatches: 0, manualReviewRequired: allFindings.filter((f: any) => f.status === 'MANUAL_REVIEW_REQUIRED').length } }, recentApplications: structuredClone(apps) });
  }
  if (path === '/applications' && method === 'get') return envelope(listApplications(params));
  if (path === '/applications' && method === 'post') {
    const currentInstitution = restoreDemoUser()?.institution || applicantInstitution;
    const inst = body.institutionId === currentInstitution.id ? currentInstitution : body.institutionId === applicantInstitution.id ? applicantInstitution : { ...applicantInstitution, id: body.institutionId || applicantInstitution.id };
    const app = { id: `AICTE-DEMO-${new Date().getFullYear()}-${String(state.applications.length + 1).padStart(4, '0')}`, institutionId: inst.id, institution: inst, category: body.category || 'ENGINEERING_TECH', academicYear: body.academicYear || '2026-2027', status: 'SUBMITTED', submissionDate: now(), currentStage: 'Synthetic demo intake', remarks: body.remarks || '', documents: [], validationFindings: [], verificationRequests: [], reviewActions: [], auditEvents: [], _count: { documents: 0, validationFindings: 0, verificationRequests: 0 } };
    state.applications.unshift(app); appendAudit(state, actor.name, actor.role, 'DEMO_APPLICATION_CREATED', 'Application', app.id, undefined, { applicationId: app.id }); saveState(); return envelope(app);
  }
  const appMatch = path.match(/^\/applications\/([^/]+)(?:\/(validate|status|report))?$/);
  if (appMatch) {
    const app = state.applications.find((item: any) => item.id === decodeURIComponent(appMatch[1]));
    if (!app) return fail(404, 'Application not found in synthetic demo data.');
    if (appMatch[2] === 'report' && method === 'get') return envelope(reportFor(app));
    if (appMatch[2] === 'validate' && method === 'post') { evaluateApplication(app, state.rules); appendAudit(state, actor.name, actor.role, 'DEMO_VALIDATION_RUN', 'Application', app.id, undefined, { applicationId: app.id, findings: app.validationFindings.length }); saveState(); return envelope({ findings: app.validationFindings, isDemoSimulation: true }); }
    if (appMatch[2] === 'status' && method === 'patch') {
      const previous = app.status; app.status = body.newStatus; app.currentStage = 'Synthetic reviewer workflow'; app.reviewActions.unshift({ id: id('REVIEW'), applicationId: app.id, reviewerId: actor.id, reviewer: { name: actor.name, role: actor.role, designation: 'Demo role' }, actionType: 'STATUS_TRANSITION', previousStatus: previous, newStatus: app.status, reason: body.reason, notes: body.notes, createdAt: now(), simulated: true });
      appendAudit(state, actor.name, actor.role, 'DEMO_STATUS_CHANGED', 'Application', app.id, { status: previous }, { applicationId: app.id, status: app.status, reason: body.reason }); saveState(); return envelope(app);
    }
    return envelope(structuredClone(app));
  }
  if (path === '/documents/upload' && method === 'post') {
    const form = body;
    const app = state.applications.find((item: any) => item.id === form.applicationId);
    if (!app) return fail(404, 'Select an application in the synthetic demo dataset.');
    const file = form.file as File | undefined;
    if (!file?.name || file.size > 10 * 1024 * 1024) return fail(400, 'Select a supported file under 10 MB.');
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) return fail(415, 'Only PDF, PNG, and JPEG files are supported.');
    const doc = { id: id('DOC-DEMO'), applicationId: app.id, documentType: form.documentType || 'LAND_TITLE_DEED', title: form.title || file.name, fileName: file.name, originalName: file.name, mimeType: file.type, fileSizeBytes: file.size, fileHashSha256: 'NOT_COMPUTED_IN_FRONTEND_DEMO', storagePath: 'NO_BINARY_STORED', uploadDate: now(), status: 'DEMO_METADATA_ONLY', isDuplicate: false, ocrConfidence: null, ocrRawText: null, extractedFields: [{ id: id('FIELD-DEMO'), documentId: '', applicationId: app.id, fieldName: 'demo_note', fieldLabel: 'Demo status', fieldValue: 'Synthetic preview only; source file was not uploaded or processed.', originalExtractedValue: 'Synthetic preview only; source file was not uploaded or processed.', confidence: null, isCorrected: false, evidenceSnippet: 'Not extracted from the selected file.' }] };
    doc.extractedFields[0].documentId = doc.id; app.documents.unshift(doc); evaluateApplication(app, state.rules); appendAudit(state, actor.name, actor.role, 'DEMO_DOCUMENT_METADATA_ADDED', 'Application', app.id, undefined, { applicationId: app.id, documentId: doc.id, note: 'No binary or extracted document content stored' }); saveState(); return envelope({ document: doc, isDuplicate: false, isDemoSimulation: true });
  }
  if (path.startsWith('/documents/') && path.endsWith('/download')) return fail(501, 'Original binaries are not stored in frontend-only demo mode.');
  if (path.startsWith('/documents/fields/') && method === 'patch') {
    const fieldId = path.split('/').pop();
    for (const app of state.applications as any[]) for (const doc of app.documents) {
      const field = doc.extractedFields.find((candidate: any) => candidate.id === fieldId);
      if (field) { field.fieldValue = body.fieldValue; field.isCorrected = true; field.correctedByUserId = actor.id; field.correctedByUser = { name: actor.name, role: actor.role }; field.correctedAt = now(); appendAudit(state, actor.name, actor.role, 'DEMO_FIELD_CORRECTED', 'Application', app.id, { value: field.originalExtractedValue }, { applicationId: app.id, fieldId, value: field.fieldValue, reason: body.reason }); saveState(); return envelope(field); }
    }
    return fail(404, 'Demo field not found.');
  }
  if (path === '/reviews/clarification' && method === 'post') {
    const app = state.applications.find((item: any) => item.id === body.applicationId); if (!app) return fail(404, 'Application not found.');
    const previous = app.status; app.status = 'CLARIFICATION_REQUESTED'; app.reviewActions.unshift({ id: id('REVIEW'), applicationId: app.id, reviewerId: actor.id, reviewer: { name: actor.name, role: actor.role, designation: 'Demo role' }, actionType: 'CLARIFICATION_REQUESTED', previousStatus: previous, newStatus: app.status, reason: body.deficiencyTitle, notes: body.clarificationMessage, createdAt: now(), simulated: true }); appendAudit(state, actor.name, actor.role, 'DEMO_CLARIFICATION_REQUESTED', 'Application', app.id, { status: previous }, { applicationId: app.id, status: app.status, title: body.deficiencyTitle }); saveState(); return envelope(app.reviewActions[0]);
  }
  if (path === '/reviews/note' && method === 'post') {
    const app = state.applications.find((item: any) => item.id === body.applicationId); if (!app) return fail(404, 'Application not found.');
    const action = { id: id('REVIEW'), applicationId: app.id, reviewerId: actor.id, reviewer: { name: actor.name, role: actor.role, designation: 'Demo role' }, actionType: 'NOTE', reason: body.note, notes: body.note, createdAt: now(), simulated: true }; app.reviewActions.unshift(action); appendAudit(state, actor.name, actor.role, 'DEMO_REVIEW_NOTE_ADDED', 'Application', app.id, undefined, { applicationId: app.id, note: body.note }); saveState(); return envelope(action);
  }
  if (path === '/rules' && method === 'get') {
    const rules = params.category && params.category !== 'ALL' ? state.rules.filter((rule: any) => rule.category === 'ALL' || rule.category === params.category) : state.rules;
    return envelope(structuredClone(rules));
  }
  const ruleMatch = path.match(/^\/rules\/([^/]+)(?:\/(toggle))?$/);
  if (ruleMatch && method === 'patch' && ruleMatch[2] === 'toggle') {
    const rule = state.rules.find((item: any) => item.id === ruleMatch[1]); if (!rule) return fail(404, 'Demo rule not found.');
    const previous = rule.isActive; rule.isActive = !rule.isActive; appendAudit(state, actor.name, actor.role, 'DEMO_RULE_TOGGLED', 'Rule', rule.id, { isActive: previous }, { isActive: rule.isActive, reason: body.changeReason }); state.applications.forEach((app: any) => evaluateApplication(app, state.rules)); saveState(); return envelope(rule);
  }
  if (path === '/rules' && method === 'post') {
    const rule = { ...body, id: id('RULE-DEMO'), version: 1, isActive: true, effectiveDate: now(), versions: [] }; state.rules.unshift(rule); appendAudit(state, actor.name, actor.role, 'DEMO_RULE_CREATED', 'Rule', rule.id, undefined, { title: rule.title }); state.applications.forEach((app: any) => evaluateApplication(app, state.rules)); saveState(); return envelope(rule);
  }
  if (ruleMatch && method === 'put') {
    const rule = state.rules.find((item: any) => item.id === ruleMatch[1]); if (!rule) return fail(404, 'Demo rule not found.');
    const previous = { title: rule.title, version: rule.version }; rule.title = body.title; rule.description = body.description; rule.category = body.category; rule.logicConfigJson = body.logicConfigJson; rule.version += 1; (rule.versions ||= []).unshift({ id: id('VERSION'), ruleId: rule.id, version: rule.version, title: rule.title, description: rule.description, logicConfigJson: rule.logicConfigJson, changeReason: body.changeReason, createdAt: now() }); appendAudit(state, actor.name, actor.role, 'DEMO_RULE_VERSIONED', 'Rule', rule.id, previous, { title: rule.title, version: rule.version }); state.applications.forEach((app: any) => evaluateApplication(app, state.rules)); saveState(); return envelope(rule);
  }
  if (path === '/audit') return envelope(structuredClone(state.auditEvents.slice(0, Number(params.limit) || 50)));
  const extra = dispatchExtras({
    method, path, params, body, applications: state.applications, actor,
    audit: (action, entityType, entityId, before, after) => { appendAudit(state, actor.name, actor.role, action, entityType, entityId, before, after); saveState(); },
  });
  if (extra) return extra;
  return fail(404, `No demo behavior is configured for ${method.toUpperCase()} ${path}.`);
}

export const demoAdapter: AxiosAdapter = async (config) => {
  try {
    const data = dispatch(config);
    const response: AxiosResponse = { data, status: 200, statusText: 'OK', headers: {}, config, request: { demo: true } };
    return response;
  } catch (error: any) {
    const status = error.response?.status || 500;
    return Promise.reject({ ...error, config, response: { data: { success: false, message: error.message }, status, statusText: 'Demo response', headers: {}, config } });
  }
};

export function demoSignIn(role: UserRole) {
  setDemoRole(role);
  if (role === 'APPLICANT') {
    try {
      const profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || '[]') as User[];
      const latestProfile = profiles[profiles.length - 1];
      if (latestProfile) localStorage.setItem(PROFILE_SESSION_KEY, latestProfile.id);
    } catch { /* Fall back to the standard synthetic applicant profile. */ }
  }
  return restoreDemoUser() || demoUser(role);
}
export function demoSignOut() { clearDemoRole(); }
