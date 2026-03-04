import { Router } from 'express';
import {
    getMyNotifications,
    markAsRead,
    markAllAsRead,
} from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// POST /api/notifications/read-all — mark all as read
router.post('/read-all', authenticate, markAllAsRead);

// GET /api/notifications — get my notifications
router.get('/', authenticate, getMyNotifications);

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', authenticate, markAsRead);

export default router;
