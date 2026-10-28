import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique, update, audit, signToken, verify } = vi.hoisted(() => ({
  findUnique: vi.fn(), update: vi.fn(), audit: vi.fn(), signToken: vi.fn(), verify: vi.fn(),
}));
vi.mock('../prisma.js', () => ({ prisma: { user: { findUnique, update } } }));
vi.mock('../services/audit.js', () => ({ logAuditEvent: audit }));
vi.mock('../middleware/auth.js', () => ({ signJwtToken: signToken }));
vi.mock('../services/googleIdentity.js', () => ({
  verifyGoogleIdToken: verify,
  GoogleVerificationUnavailableError: class GoogleVerificationUnavailableError extends Error {},
}));

import { loginWithGoogle } from '../controllers/authController.js';
import { GoogleVerificationUnavailableError } from '../services/googleIdentity.js';

function makeResponse() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((body: unknown) => { res.body = body; return res; });
  return res;
}
const request = (idToken = 'signed-google-id-token') => ({ body: { idToken }, ip: '127.0.0.1', headers: {} } as any);
const account = { id: 'user-1', email: 'person@example.edu', name: 'Provisioned User', role: 'APPLICANT', department: null, institutionId: 'inst-1', designation: 'Principal', googleSubject: null, institution: { id: 'inst-1' } };

describe('Google authentication endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GOOGLE_CLIENT_ID', 'public-client-id.apps.googleusercontent.com');
    verify.mockResolvedValue({ subject: 'google-subject-1', email: 'person@example.edu' });
    findUnique.mockResolvedValue(account);
    update.mockResolvedValue({ ...account, googleSubject: 'google-subject-1' });
    audit.mockResolvedValue({ id: 'audit-1' });
    signToken.mockReturnValue('application-session-token');
  });

  it('verifies token, links an existing account, audits, then issues the normal session', async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(account);
    const res = makeResponse();
    await loginWithGoogle(request(), res);
    expect(verify).toHaveBeenCalledWith('signed-google-id-token', 'public-client-id.apps.googleusercontent.com');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user-1' }, data: { googleSubject: 'google-subject-1' } }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'user-1', action: 'USER_GOOGLE_LOGIN_SUCCESS', afterState: expect.objectContaining({ provider: 'google' }) }));
    expect(signToken).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }));
    expect(res.body.data.token).toBe('application-session-token');
  });

  it('rejects invalid Google tokens without issuing a session', async () => {
    verify.mockRejectedValue(new Error('signature mismatch'));
    const res = makeResponse();
    await loginWithGoogle(request(), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('InvalidGoogleCredential');
    expect(signToken).not.toHaveBeenCalled();
  });

  it('reports Google verification outages as retryable service errors', async () => {
    verify.mockRejectedValue(new GoogleVerificationUnavailableError());
    const res = makeResponse();
    await loginWithGoogle(request(), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe('GoogleVerificationUnavailable');
    expect(signToken).not.toHaveBeenCalled();
  });

  it('fails clearly when the server OAuth client ID is absent', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    const res = makeResponse();
    await loginWithGoogle(request(), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe('GoogleSignInUnavailable');
    expect(verify).not.toHaveBeenCalled();
  });

  it('does not create an account when the verified email is not provisioned', async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const res = makeResponse();
    await loginWithGoogle(request(), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('AccountNotProvisioned');
    expect(update).not.toHaveBeenCalled();
    expect(signToken).not.toHaveBeenCalled();
  });

  it('rejects an account already bound to a different Google subject', async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...account, googleSubject: 'another-subject' });
    const res = makeResponse();
    await loginWithGoogle(request(), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('GoogleIdentityConflict');
    expect(signToken).not.toHaveBeenCalled();
  });

  it('rejects database and audit failures without returning a session', async () => {
    audit.mockRejectedValue(new Error('audit unavailable'));
    const res = makeResponse();
    await loginWithGoogle(request(), res);
    expect(res.statusCode).toBe(500);
    expect(signToken).not.toHaveBeenCalled();
  });

  it('returns a safe retryable response and logs only the database code when the database is unreachable', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    findUnique.mockRejectedValue(Object.assign(new Error('private connection details'), { code: 'P1001' }));
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = makeResponse();

    await loginWithGoogle(request(), res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      success: false,
      error: 'AuthenticationServiceUnavailable',
      message: 'The authentication service cannot reach its database right now. Please try again later.',
    });
    expect(diagnostic).toHaveBeenCalledWith('[BharatSatya Auth] Google sign-in persistence failed (P1001).');
    expect(diagnostic.mock.calls.flat().join(' ')).not.toContain('private connection details');
    expect(signToken).not.toHaveBeenCalled();
    diagnostic.mockRestore();
  });
});
