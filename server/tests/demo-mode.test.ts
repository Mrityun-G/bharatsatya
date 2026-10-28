import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDemoRole, createDemoProfile, demoAdapter, demoSignIn, demoStorageAvailable, getDemoSnapshot, isDemoModeEnabled, resetDemoData, restoreDemoUser, setDemoRole } from '../../client/src/services/demoData.js';
import { createApiClient } from '../../client/src/services/api.js';
import { validateSignup } from '../../client/src/services/signupValidation.js';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
  };
}
function request(url: string, method = 'get', data?: unknown, params?: unknown) {
  return { url, method, data, params, headers: {} } as any;
}
async function demoRequest(url: string, method = 'get', data?: unknown, params?: unknown) {
  return demoAdapter(request(url, method, data, params));
}

describe('frontend-only demo data adapter', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    resetDemoData();
    clearDemoRole();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('persists role selection and restores each presentation role without credentials', () => {
    for (const role of ['APPLICANT', 'REVIEWER', 'ADMIN'] as const) {
      expect(demoSignIn(role).role).toBe(role);
      expect(restoreDemoUser()?.role).toBe(role);
      setDemoRole(role);
    }
  });

  it('enables the demo adapter only for the exact build-time value "true"', () => {
    expect(isDemoModeEnabled('true')).toBe(true);
    expect(isDemoModeEnabled('TRUE')).toBe(false);
    expect(isDemoModeEnabled('1')).toBe(false);
    expect(isDemoModeEnabled(undefined)).toBe(false);
  });

  it('creates a browser-local applicant profile and associates new applications with its institution', async () => {
    const profile = createDemoProfile({ name: 'Synthetic Applicant', email: 'NEW@EXAMPLE.INVALID', institutionName: 'Sample Institute', designation: 'Principal' });
    expect(profile).toMatchObject({ name: 'Synthetic Applicant', email: 'new@example.invalid', role: 'APPLICANT', institution: { name: 'Sample Institute' } });
    expect(restoreDemoUser()).toEqual(profile);
    expect(localStorage.getItem('bharatsatya_frontend_demo_profiles_v1')).not.toContain('password');
    expect(localStorage.getItem('bharatsatya_frontend_demo_profiles_v1')).not.toContain('confirmPassword');
    demoSignIn('REVIEWER');
    expect(demoSignIn('APPLICANT').id).toBe(profile.id);
    const created = await demoRequest('/applications', 'post', { institutionId: profile.institution?.id, category: 'MANAGEMENT' });
    expect(created.data.data.institution.name).toBe('Sample Institute');
  });

  it('rejects incomplete and duplicate browser-local demo profiles', () => {
    expect(() => createDemoProfile({ name: ' ', email: 'x@example.invalid', institutionName: 'Institute', designation: 'Principal' })).toThrow('Complete all profile fields.');
    const input = { name: 'Synthetic Applicant', email: 'new@example.invalid', institutionName: 'Sample Institute', designation: 'Principal' };
    createDemoProfile(input);
    expect(() => createDemoProfile({ ...input, email: 'NEW@example.invalid' })).toThrow('already uses this email');
  });

  it('validates sign-up email, required fields, password strength floor and confirmation', () => {
    expect(validateSignup({ name: '', email: 'not-an-email', institutionName: '', designation: '', password: 'short', confirmPassword: 'different' })).toMatchObject({
      name: 'Enter your full name.', email: 'Enter a valid email address.', institutionName: 'Enter your institution name.', designation: 'Enter your designation.', password: 'Use at least 8 characters.', confirmPassword: 'The passwords do not match.',
    });
    expect(validateSignup({ name: 'A User', email: 'a@example.edu', institutionName: 'Institute', designation: 'Principal', password: 'long-enough', confirmPassword: 'long-enough' })).toEqual({});
  });

  it('keeps applications and mutations in browser storage and supports reset', async () => {
    const beforeCount = getDemoSnapshot().applications.length;
    const created = await demoRequest('/applications', 'post', { category: 'MANAGEMENT', academicYear: '2026-2027' });
    expect(created.data.data.category).toBe('MANAGEMENT');
    expect(getDemoSnapshot().applications).toHaveLength(beforeCount + 1);
    expect(localStorage.getItem('bharatsatya_frontend_demo_v1')).toContain(created.data.data.id);
    resetDemoData();
    expect(getDemoSnapshot().applications).toHaveLength(beforeCount);
  });

  it('changes validation output when an illustrative rule is deactivated and records the event', async () => {
    const initial = await demoRequest('/applications/AICTE-DEMO-2026-0001');
    expect(initial.data.data.validationFindings.some((finding: any) => finding.status === 'MISSING')).toBe(true);
    await demoRequest('/rules/RULE-DEMO-01/toggle', 'patch', { changeReason: 'Demo test toggle' });
    await demoRequest('/applications/AICTE-DEMO-2026-0001/validate', 'post');
    const updated = await demoRequest('/applications/AICTE-DEMO-2026-0001');
    expect(updated.data.data.validationFindings.some((finding: any) => finding.status === 'MISSING')).toBe(false);
    expect((await demoRequest('/audit')).data.data.some((event: any) => event.action === 'DEMO_RULE_TOGGLED')).toBe(true);
  });

  it('serves requests through the local adapter without invoking fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const demoClient = createApiClient(true);
    expect(demoClient.defaults.baseURL).toBe('/');
    expect(createApiClient(false).defaults.baseURL).toBe('/api');
    const response = await demoClient.get('/applications');
    expect(response.data.success).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not offer original file downloads because binaries are never saved in demo mode', async () => {
    await expect(demoRequest('/documents/anything/download')).rejects.toMatchObject({ response: { status: 501 } });
  });

  it('falls back to in-memory synthetic data when browser storage fails', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('storage unavailable'); }, setItem() { throw new Error('storage unavailable'); }, removeItem() { throw new Error('storage unavailable'); } });
    expect(demoStorageAvailable()).toBe(false);
    expect(() => resetDemoData()).not.toThrow();
    expect(getDemoSnapshot().applications).toHaveLength(1);
  });
});
