import { Router } from 'express';
import {
    getMyTransactions,
    getMonthlySummary,
} from '../controllers/transaction.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/transactions — get my transactions
router.get('/', authenticate, getMyTransactions);

// GET /api/transactions/summary — get monthly earnings summary
router.get('/summary', authenticate, getMonthlySummary);

export default router;
