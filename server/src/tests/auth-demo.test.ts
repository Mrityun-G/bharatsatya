import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../prisma.js', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock('../services/audit.js', () => ({ logAuditEvent: vi.fn() }));
vi.mock('../middleware/auth.js', () => ({ signJwtToken: vi.fn() }));

import { getDemoAccounts } from '../controllers/authController.js';
import { isLocalDemoEnabled } from '../config/demoMode.js';

function response() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((body: unknown) => { res.body = body; return res; });
  return res;
}

describe('local demo-account discovery', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DEMO_ACCOUNTS_MODE', 'disabled');
    vi.stubEnv('ENABLE_DEMO_ACCOUNTS', 'true');
    vi.stubEnv('DEMO_APPLICANT_PASSWORD', 'test-only-applicant-password');
    vi.stubEnv('DEMO_REVIEWER_PASSWORD', 'test-only-reviewer-password');
    vi.stubEnv('DEMO_ADMIN_PASSWORD', 'test-only-admin-password');
    vi.stubEnv('JWT_SECRET', 'test-only-jwt-secret-never-return');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('requires the explicit local mode and development environment', () => {
    expect(isLocalDemoEnabled()).toBe(false);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_ACCOUNTS_MODE', 'local');
    expect(isLocalDemoEnabled()).toBe(false);
    vi.stubEnv('NODE_ENV', 'development');
    expect(isLocalDemoEnabled()).toBe(true);
    vi.stubEnv('VERCEL', '1');
    expect(isLocalDemoEnabled()).toBe(false);
  });

  it('denies discovery when local demo mode is disabled or legacy flag is used', async () => {
    const res = response();
    await getDemoAccounts({} as any, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'NotFound' });
  });

  it('returns safe account metadata only and never serializes credentials', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEMO_ACCOUNTS_MODE', 'local');
    const res = response();
    await getDemoAccounts({} as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.accounts.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash|secret|token/i);
    expect(JSON.stringify(res.body)).not.toContain('test-only-applicant-password');
    expect(JSON.stringify(res.body)).not.toContain('test-only-reviewer-password');
    expect(JSON.stringify(res.body)).not.toContain('test-only-admin-password');
    expect(JSON.stringify(res.body)).not.toContain('test-only-jwt-secret-never-return');
  });
});
