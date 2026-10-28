import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { signJwtToken } from '../middleware/auth.js';
import { logAuditEvent } from '../services/audit.js';
import { isLocalDemoEnabled } from '../config/demoMode.js';
import { GoogleVerificationUnavailableError, verifyGoogleIdToken, type VerifiedGoogleIdentity } from '../services/googleIdentity.js';

const LoginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'ValidationError',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { email, password } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { institution: true },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'InvalidCredentials',
        message: 'Invalid administrative or institutional credentials provided.',
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        error: 'InvalidCredentials',
        message: 'Invalid administrative or institutional credentials provided.',
      });
      return;
    }

    const token = signJwtToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
      department: user.department,
      institutionId: user.institutionId,
    });

    await logAuditEvent({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'USER_LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      afterState: { email: user.email, role: user.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          designation: user.designation,
          institution: user.institution,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Authentication failed due to an internal error.',
    });
  }
}

const GoogleLoginSchema = z.object({ idToken: z.string().min(1).max(8192) });

export async function loginWithGoogle(req: Request, res: Response): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ success: false, error: 'GoogleSignInUnavailable', message: 'Google sign-in is not configured.' });
    return;
  }
  const parsed = GoogleLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'ValidationError', message: 'A Google ID token is required.' });
    return;
  }

  let identity: VerifiedGoogleIdentity;
  try {
    identity = await verifyGoogleIdToken(parsed.data.idToken, clientId);
  } catch (error) {
    if (error instanceof GoogleVerificationUnavailableError) {
      res.status(503).json({ success: false, error: 'GoogleVerificationUnavailable', message: 'Google verification is temporarily unavailable. Try again shortly.' });
      return;
    }
    res.status(401).json({ success: false, error: 'InvalidGoogleCredential', message: 'Google sign-in could not verify your account. Try again or use your institutional credentials.' });
    return;
  }

  try {
    let user = await prisma.user.findUnique({ where: { googleSubject: identity.subject }, include: { institution: true } });
    if (!user) {
      const emailUser = await prisma.user.findUnique({ where: { email: identity.email }, include: { institution: true } });
      if (!emailUser) {
        res.status(403).json({ success: false, error: 'AccountNotProvisioned', message: 'No provisioned account matches this verified Google identity. Contact your administrator.' });
        return;
      }
      if (emailUser.googleSubject && emailUser.googleSubject !== identity.subject) {
        res.status(409).json({ success: false, error: 'GoogleIdentityConflict', message: 'This account is linked to a different Google identity. Contact your administrator.' });
        return;
      }
      user = emailUser.googleSubject
        ? emailUser
        : await prisma.user.update({ where: { id: emailUser.id }, data: { googleSubject: identity.subject }, include: { institution: true } });
    }

    await logAuditEvent({
      actorId: user.id, actorName: user.name, actorRole: user.role,
      action: 'USER_GOOGLE_LOGIN_SUCCESS', entityType: 'User', entityId: user.id,
      afterState: { email: user.email, role: user.role, provider: 'google' },
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
    });
    const token = signJwtToken({ id: user.id, email: user.email, name: user.name, role: user.role as any, department: user.department, institutionId: user.institutionId });
    res.json({ success: true, data: { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, department: user.department, designation: user.designation, institution: user.institution } } });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ success: false, error: 'GoogleIdentityConflict', message: 'This Google identity is already linked to another account. Contact your administrator.' });
      return;
    }
    const errorCode = typeof error?.code === 'string' ? error.code : undefined;
    const databaseUnavailableCodes = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);
    if (process.env.NODE_ENV === 'development') {
      const diagnostic = errorCode && /^[A-Z0-9_]{1,24}$/.test(errorCode) ? errorCode : 'UnexpectedError';
      console.error(`[BharatSatya Auth] Google sign-in persistence failed (${diagnostic}).`);
    }
    if (errorCode && databaseUnavailableCodes.has(errorCode)) {
      res.status(503).json({ success: false, error: 'AuthenticationServiceUnavailable', message: 'The authentication service cannot reach its database right now. Please try again later.' });
      return;
    }
    res.status(500).json({ success: false, error: 'InternalServerError', message: 'Sign-in could not be completed. Please try again.' });
  }
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { institution: true },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'UserNotFound' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        designation: user.designation,
        institution: user.institution,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'InternalServerError' });
  }
}

export async function getDemoAccounts(_req: Request, res: Response): Promise<void> {
  if (!isLocalDemoEnabled()) {
    res.status(404).json({ success: false, error: 'NotFound' });
    return;
  }

  // Return display metadata only. Authentication always uses the normal login endpoint.
  res.json({
    success: true,
    enabled: true,
    accounts: [
      {
        role: 'APPLICANT',
        label: 'Applicant / Principal',
        institution: 'Vidya Jyothi Institute of Technology',
        email: 'principal@vjit.ac.in',
        description: 'Creates applications, uploads compliance documents, views deficiency findings.',
      },
      {
        role: 'REVIEWER',
        label: 'AICTE Scrutiny Officer',
        institution: 'AICTE Southern / Western Regional Directorate',
        email: 'reviewer.deshmukh@aicte.gov.in',
        description: 'Evaluates findings, inspects original vs extracted evidence, records observations & clarification requests.',
      },
      {
        role: 'ADMIN',
        label: 'AICTE Chief Regulatory Administrator',
        institution: 'AICTE Headquarters, New Delhi',
        email: 'admin@aicte.gov.in',
        description: 'Configures APH rules, manages officer accounts, reviews system audit trail.',
      },
    ],
  });
}
