import { describe, expect, it, vi } from 'vitest';

const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock('google-auth-library', () => ({ OAuth2Client: vi.fn().mockImplementation(() => ({ verifyIdToken })) }));

import { verifyGoogleIdToken } from '../services/googleIdentity.js';

describe('Google ID token verification', () => {
  it('uses the configured OAuth client ID as the required token audience', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'subject-1', email: 'User@Example.edu', email_verified: true }) });
    await expect(verifyGoogleIdToken('signed-id-token', 'client-id.apps.googleusercontent.com')).resolves.toEqual({ subject: 'subject-1', email: 'user@example.edu' });
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'signed-id-token', audience: 'client-id.apps.googleusercontent.com' });
  });

  it('rejects verified signatures that lack a verified email or stable subject', async () => {
    verifyIdToken.mockResolvedValueOnce({ getPayload: () => ({ sub: 'subject-1', email: 'person@example.edu', email_verified: false }) });
    await expect(verifyGoogleIdToken('signed-id-token', 'client-id')).rejects.toThrow('verified email');
    verifyIdToken.mockResolvedValueOnce({ getPayload: () => ({ email: 'person@example.edu', email_verified: true }) });
    await expect(verifyGoogleIdToken('signed-id-token', 'client-id')).rejects.toThrow('verified email or subject');
  });

  it('propagates signature, issuer, audience, and expiry verification failures', async () => {
    verifyIdToken.mockRejectedValue(new Error('Invalid token signature'));
    await expect(verifyGoogleIdToken('forged-token', 'client-id')).rejects.toThrow('Invalid token signature');
  });

  it('distinguishes temporary Google verification network failures from invalid credentials', async () => {
    verifyIdToken.mockRejectedValue({ code: 'ETIMEDOUT' });
    await expect(verifyGoogleIdToken('signed-id-token', 'client-id')).rejects.toMatchObject({ name: 'GoogleVerificationUnavailableError' });
  });
});
