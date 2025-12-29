import { Router } from 'express';
import { passController, verifyPassSchema } from '../controllers/pass.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Verify pass (for admin/staff/sponsor)
router.post(
  '/verify',
  validate(verifyPassSchema),
  passController.verify.bind(passController)
);

// Get pass by code
router.get(
  '/code/:passCode',
  validate(z.object({ passCode: z.string().min(1) }), 'params'),
  passController.getByCode.bind(passController)
);

// Get user's passes
router.get(
  '/my',
  passController.getMyPasses.bind(passController)
);

// Get event passes (for admin/sponsor)
router.get(
  '/event/:eventId',
  validate(z.object({ eventId: z.string().min(1) }), 'params'),
  passController.getEventPasses.bind(passController)
);

export default router;

