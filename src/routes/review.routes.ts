import { Router } from 'express';
import {
    createReview,
    getReviewsForUser,
    getReviewForTask,
} from '../controllers/review.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { createReviewSchema } from '../validators/review.validator';

const router = Router();

// POST /api/reviews — submit a review
router.post('/', authenticate, validate(createReviewSchema), createReview);

// GET /api/reviews/user/:userId — get reviews for a user
router.get('/user/:userId', authenticate, getReviewsForUser);

// GET /api/reviews/task/:taskId — get reviews for a task
router.get('/task/:taskId', authenticate, getReviewForTask);

export default router;
