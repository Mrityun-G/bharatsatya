import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';
import { isAllowedBrowserOrigin } from './config/origin.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);

// 1. Helmet HTTP Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
      },
    },
  })
);

// 2. Controlled CORS Configuration
const allowedOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedBrowserOrigin(origin, allowedOrigin)) {
        callback(null, true);
      } else {
        const error: any = new Error('Origin is not allowed.');
        error.status = 403;
        error.name = 'CorsOriginRejected';
        callback(error);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// 3. Request Body Parsers (with safe limits)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. NOTE: Static upload directory is deliberately NOT mounted to ensure
// uploaded statutory documents are stored privately and accessible strictly
// through authenticated /api/documents/:id/download endpoints.

// 5. Mount REST API Routes
app.use('/api', apiRouter);

// 6. Centralized Secure Error Handling Middleware
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.status || err.statusCode || 500;
  const errorName = statusCode >= 500 ? 'InternalServerError' : (err.name || 'RequestError');
  const errorMessage = statusCode >= 500
    ? 'An unexpected internal error occurred.'
    : (err.message || 'The request could not be processed.');

  // Avoid logging sensitive internal stack in production
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[BharatSatya Error] ${req.method} ${req.path} -> ${errorName}`);
  }

  res.status(statusCode).json({
    success: false,
    error: errorName,
    message: errorMessage,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
  });
});

if (process.env.NODE_ENV !== 'test' && process.env.VERCEL !== '1') {
  const onListening = () => {
    console.log(`[BharatSatya Server] Regulatory Validation Engine active on port ${PORT}`);
    console.log(`[BharatSatya Server] Private storage: secure and non-static`);
    console.log(`[BharatSatya Server] Health endpoint: http://localhost:${PORT}/api/health`);
  };
  // Locally the API stays loopback-only. Hosted platforms (Render) route traffic
  // through their own proxy and require binding all interfaces.
  const host = process.env.RENDER ? '0.0.0.0' : '127.0.0.1';
  app.listen(PORT, host, onListening);
}

export default app;
