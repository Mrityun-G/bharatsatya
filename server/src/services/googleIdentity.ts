import { OAuth2Client } from 'google-auth-library';

export interface VerifiedGoogleIdentity {
  subject: string;
  email: string;
}

export class GoogleVerificationUnavailableError extends Error {
  constructor() {
    super('Google token verification is temporarily unavailable.');
    this.name = 'GoogleVerificationUnavailableError';
  }
}

export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<VerifiedGoogleIdentity> {
  const verifier = new OAuth2Client(clientId);
  let ticket;
  try {
    ticket = await verifier.verifyIdToken({ idToken, audience: clientId });
  } catch (error: any) {
    const status = error?.response?.status;
    const transientCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT']);
    if (status === 429 || status >= 500 || transientCodes.has(error?.code)) throw new GoogleVerificationUnavailableError();
    throw error;
  }
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new Error('Google identity is missing a verified email or subject.');
  }
  return { subject: payload.sub, email: payload.email.toLowerCase() };
}
