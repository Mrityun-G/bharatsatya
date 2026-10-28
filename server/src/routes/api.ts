import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { uploadMiddleware, handleSingleUpload } from '../middleware/upload.js';
import { login, loginWithGoogle, getCurrentUser, getDemoAccounts } from '../controllers/authController.js';
import { getDashboardOverview } from '../controllers/dashboardController.js';
import {
  listApplications,
  getApplicationById,
  createApplication,
  updateApplicationStatus,
  triggerValidation,
  generateValidationReport,
} from '../controllers/applicationController.js';
import {
  uploadDocument,
  downloadDocument,
  updateExtractedField,
  createExtractedField,
} from '../controllers/documentController.js';
import {
  listRules,
  createRule,
  updateRule,
  toggleRuleStatus,
} from '../controllers/ruleController.js';
import {
  requestClarification,
  addReviewObservation,
} from '../controllers/reviewController.js';
import { listAuditEvents } from '../controllers/auditController.js';
import { requestVerification, listVerifications, confirmVerificationManually } from '../controllers/verificationController.js';
import { listAnomalies } from '../controllers/anomalyController.js';
import { getInfrastructureAssessment } from '../controllers/infrastructureController.js';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../controllers/notificationController.js';
import { getHealth } from '../controllers/healthController.js';

const router = Router();

// Health check
router.get('/health', getHealth);

// Authentication
router.post('/auth/login', login);
router.post('/auth/google', loginWithGoogle);
router.get('/auth/me', authenticateToken, getCurrentUser);
router.get('/auth/demo-accounts', getDemoAccounts);

// Dashboard
router.get('/dashboard/overview', authenticateToken, getDashboardOverview);

// Applications
router.get('/applications', authenticateToken, listApplications);
router.get('/applications/:id', authenticateToken, getApplicationById);
router.post('/applications', authenticateToken, createApplication);
router.patch('/applications/:id/status', authenticateToken, requireRole('REVIEWER', 'ADMIN'), updateApplicationStatus);
router.post('/applications/:id/validate', authenticateToken, triggerValidation);
router.get('/applications/:id/report', authenticateToken, generateValidationReport);

// Documents
router.post('/documents/upload', authenticateToken, handleSingleUpload, uploadDocument);
router.get('/documents/:id/download', authenticateToken, downloadDocument);
router.patch('/documents/fields/:fieldId', authenticateToken, updateExtractedField);
router.post('/documents/:documentId/fields', authenticateToken, createExtractedField);

// Rules (Admin managed)
router.get('/rules', authenticateToken, listRules);
router.post('/rules', authenticateToken, requireRole('ADMIN'), createRule);
router.put('/rules/:id', authenticateToken, requireRole('ADMIN'), updateRule);
router.patch('/rules/:id/toggle', authenticateToken, requireRole('ADMIN'), toggleRuleStatus);

// Reviewer Actions
router.post('/reviews/clarification', authenticateToken, requireRole('REVIEWER', 'ADMIN'), requestClarification);
router.post('/reviews/note', authenticateToken, requireRole('REVIEWER', 'ADMIN'), addReviewObservation);
router.post('/verifications', authenticateToken, requireRole('REVIEWER', 'ADMIN'), requestVerification);
router.get('/verifications', authenticateToken, requireRole('REVIEWER', 'ADMIN'), listVerifications);
router.patch('/verifications/:id/manual', authenticateToken, requireRole('REVIEWER', 'ADMIN'), confirmVerificationManually);

// Anomaly indicators (preliminary, for human verification) and infrastructure compliance
router.get('/anomalies', authenticateToken, listAnomalies);
router.get('/infrastructure/:applicationId', authenticateToken, getInfrastructureAssessment);

// Alerts for the signed-in user
router.get('/notifications', authenticateToken, listNotifications);
router.post('/notifications/read-all', authenticateToken, markAllNotificationsRead);
router.patch('/notifications/:id/read', authenticateToken, markNotificationRead);

// Audit Trail (Restricted to Reviewers & Admins)
router.get('/audit', authenticateToken, requireRole('REVIEWER', 'ADMIN'), listAuditEvents);

export default router;
