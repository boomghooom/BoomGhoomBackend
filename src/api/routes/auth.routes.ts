import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.middleware.js';
import {
  sendSignupOTPSchema,
  verifySignupOTPSchema,
  resendOTPSchema,
  loginSchema,
  googleAuthSchema,
  appleAuthSchema,
  refreshTokenSchema,
  changePasswordSchema,
  updatePhoneSchema,
} from '../validators/auth.validator.js';

const router = Router();

// ============================================
// OTP-based Signup Flow (2 steps)
// ============================================

// Step 1: Send OTP for signup (validates data + sends OTP)
router.post(
  '/signup/send-otp',
  otpLimiter,
  validate(sendSignupOTPSchema),
  authController.sendSignupOTP.bind(authController)
);

// Step 2: Verify OTP and complete signup (creates account + returns tokens)
router.post(
  '/signup/verify-otp',
  authLimiter,
  validate(verifySignupOTPSchema),
  authController.verifySignupOTP.bind(authController)
);

// Resend OTP
router.post(
  '/otp/resend',
  otpLimiter,
  validate(resendOTPSchema),
  authController.resendOTP.bind(authController)
);

// ============================================
// Login routes
// ============================================

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  authController.login.bind(authController)
);

// ============================================
// Social Auth routes
// ============================================

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

// ============================================
// Token management
// ============================================

router.post(
  '/refresh',
  validate(refreshTokenSchema),
  authController.refreshToken.bind(authController)
);

// ============================================
// Protected routes (require authentication)
// ============================================

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
