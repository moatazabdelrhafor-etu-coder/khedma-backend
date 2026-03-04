import { Router } from 'express';
import {
    getMe,
    updateMe,
    getPublicProfile,
    updateTaskerProfile,
    submitKyc,
    submitDiploma,
} from '../controllers/user.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
    updateUserSchema,
    updateTaskerProfileSchema,
    submitKycSchema,
    submitDiplomaSchema,
} from '../validators/user.validator';

const router = Router();

// GET /api/users/me — get my full profile
router.get('/me', authenticate, getMe);

// PATCH /api/users/me — update my profile
router.patch('/me', authenticate, validate(updateUserSchema), updateMe);

// PATCH /api/users/tasker-profile — update tasker-specific profile
router.patch('/tasker-profile', authenticate, validate(updateTaskerProfileSchema), updateTaskerProfile);

// POST /api/users/kyc — submit KYC documents
router.post('/kyc', authenticate, validate(submitKycSchema), submitKyc);

// POST /api/users/diploma — submit diploma
router.post('/diploma', authenticate, validate(submitDiplomaSchema), submitDiploma);

// GET /api/users/:id — get public profile (must be last due to :id param)
router.get('/:id', authenticate, getPublicProfile);

export default router;
