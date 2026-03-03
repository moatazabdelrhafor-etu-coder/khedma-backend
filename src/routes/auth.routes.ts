import { Router } from 'express';
import { sendOtp, verifyOtp, register } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
    sendOtpSchema,
    verifyOtpSchema,
    registerSchema,
} from '../validators/auth.validator';

const router = Router();

// POST /api/auth/send-otp
router.post('/send-otp', validate(sendOtpSchema), sendOtp);

// POST /api/auth/verify-otp
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);

// POST /api/auth/register (requires valid session from verify-otp)
router.post('/register', authenticate, validate(registerSchema), register);

export default router;
