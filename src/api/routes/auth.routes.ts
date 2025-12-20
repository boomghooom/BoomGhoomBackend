import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';
import {
  signupSchema,
  loginSchema,
  googleAuthSchema,
  appleAuthSchema,
  refreshTokenSchema,
  changePasswordSchema,
  updatePhoneSchema,
} from '../validators/auth.validator.js';

const router = Router();

// Public routes
router.post(
  '/signup',
  authLimiter,
  validate(signupSchema),
  authController.signup.bind(authController)
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  authController.login.bind(authController)
);

router.post(
  '/google',
  authLimiter,
  validate(googleAuthSchema),
  authController.googleAuth.bind(authController)
);

router.post(
  '/apple',
  authLimiter,
  validate(appleAuthSchema),
  authController.appleAuth.bind(authController)
);

router.post(
  '/refresh',
  validate(refreshTokenSchema),
  authController.refreshToken.bind(authController)
);

// Protected routes
router.post(
  '/logout',
  authenticate,
  authController.logout.bind(authController)
);

router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword.bind(authController)
);

router.patch(
  '/phone',
  authenticate,
  validate(updatePhoneSchema),
  authController.updatePhone.bind(authController)
);

export default router;

