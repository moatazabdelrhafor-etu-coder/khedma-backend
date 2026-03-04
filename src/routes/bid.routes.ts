import { Router } from 'express';
import {
    createBid,
    getMyBids,
    getBidsForTask,
    acceptBid,
    rejectBid,
    withdrawBid,
} from '../controllers/bid.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { createBidSchema } from '../validators/bid.validator';

const router = Router();

// POST /api/bids — submit a bid on a task
router.post('/', authenticate, validate(createBidSchema), createBid);

// GET /api/bids/my — get my bids (as tasker)
router.get('/my', authenticate, getMyBids);

// GET /api/bids/task/:taskId — get bids for a specific task
router.get('/task/:taskId', authenticate, getBidsForTask);

// PATCH /api/bids/:id/accept — accept a bid (as client)
router.patch('/:id/accept', authenticate, acceptBid);

// PATCH /api/bids/:id/reject — reject a bid (as client)
router.patch('/:id/reject', authenticate, rejectBid);

// PATCH /api/bids/:id/withdraw — withdraw a bid (as tasker)
router.patch('/:id/withdraw', authenticate, withdrawBid);

export default router;
