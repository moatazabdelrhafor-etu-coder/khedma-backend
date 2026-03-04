import { Router } from 'express';
import {
    getDashboardStats,
    getPendingKyc,
    approveKyc,
    rejectKyc,
    approveDiploma,
    getCommissions,
    getTaskerCommissions,
    markCommissionPaid,
    getReports,
    resolveReport,
    banUser,
    unbanUser,
} from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();

// All admin routes require authentication + admin check
router.use(authenticate, requireAdmin);

// Dashboard
router.get('/stats', getDashboardStats);

// KYC management
router.get('/kyc/pending', getPendingKyc);
router.patch('/kyc/:id/approve', approveKyc);
router.patch('/kyc/:id/reject', rejectKyc);

// Diploma management
router.patch('/diploma/:id/approve', approveDiploma);

// Commission management
router.get('/commissions', getCommissions);
router.get('/commissions/taskers', getTaskerCommissions);
router.patch('/commissions/:id/paid', markCommissionPaid);

// Report management
router.get('/reports', getReports);
router.patch('/reports/:id/resolve', resolveReport);

// User management
router.patch('/users/:id/ban', banUser);
router.patch('/users/:id/unban', unbanUser);

export default router;
