import { Router } from 'express';
import {
    uploadTaskPhoto,
    uploadPortfolioPhoto,
    uploadAvatar,
    uploadKycDocument,
    uploadDiploma,
    deletePortfolioPhoto,
} from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth';
import upload from '../config/multer';

const router = Router();

// POST /api/upload/task-photo — upload a task photo
router.post('/task-photo', authenticate, upload.single('photo'), uploadTaskPhoto);

// POST /api/upload/portfolio — upload a portfolio photo
router.post('/portfolio', authenticate, upload.single('photo'), uploadPortfolioPhoto);

// POST /api/upload/avatar — upload/update profile photo
router.post('/avatar', authenticate, upload.single('photo'), uploadAvatar);

// POST /api/upload/kyc — upload a KYC document (cin_front, cin_back, or selfie)
router.post('/kyc', authenticate, upload.single('photo'), uploadKycDocument);

// POST /api/upload/diploma — upload a diploma document
router.post('/diploma', authenticate, upload.single('photo'), uploadDiploma);

// DELETE /api/upload/portfolio/:id — delete a portfolio photo
router.delete('/portfolio/:id', authenticate, deletePortfolioPhoto);

export default router;
