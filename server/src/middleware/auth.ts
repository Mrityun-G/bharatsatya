import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load local configuration before capturing the secret. Production environments
// should provide JWT_SECRET through the platform's environment configuration.
dotenv.config();

const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  }
  return secret;
})();

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: 'APPLICANT' | 'REVIEWER' | 'ADMIN';
  department?: string | null;
  institutionId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function signJwtToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      institutionId: user.institutionId,
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'AuthenticationRequired',
      message: 'Access denied. Valid Bearer authorization token is required.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'InvalidToken',
      message: 'Invalid or expired authorization session.',
    });
  }
}

export function requireRole(...allowedRoles: ('APPLICANT' | 'REVIEWER' | 'ADMIN')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'AuthenticationRequired',
        message: 'Authentication is required for this operation.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'ForbiddenRole',
        message: `Access denied. Role '${req.user.role}' lacks authorization for this endpoint. Required: [${allowedRoles.join(', ')}]`,
      });
      return;
    }

    next();
  };
}
