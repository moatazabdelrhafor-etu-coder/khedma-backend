import { Router } from 'express';
import {
    createTask,
    getMyTasks,
    getOpenTasks,
    getTaskById,
    cancelTask,
} from '../controllers/task.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { createTaskSchema } from '../validators/task.validator';

const router = Router();

// POST /api/tasks — create a new task
router.post('/', authenticate, validate(createTaskSchema), createTask);

// GET /api/tasks/my — get my tasks (as client)
router.get('/my', authenticate, getMyTasks);

// GET /api/tasks/open — browse open tasks (for taskers)
router.get('/open', authenticate, getOpenTasks);

// GET /api/tasks/:id — get task details
router.get('/:id', authenticate, getTaskById);

// PATCH /api/tasks/:id/cancel — cancel a task
router.patch('/:id/cancel', authenticate, cancelTask);

export default router;
