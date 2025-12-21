import { Request, Response, NextFunction } from 'express';
import { authService } from '../../application/services/AuthService.js';
import { otpService } from '../../application/services/OTPService.js';
import { userRepository } from '../../infrastructure/database/repositories/UserRepository.js';
import { sendSuccess, sendCreated } from '../../shared/utils/response.js';
import { ConflictError, BadRequestError } from '../../shared/errors/AppError.js';
import {
  SendSignupOTPInput,
  VerifySignupOTPInput,
  ResendOTPInput,
  LoginInput,
  GoogleAuthInput,
  AppleAuthInput,
  RefreshTokenInput,
  ChangePasswordInput,
  UpdatePhoneInput,
} from '../validators/auth.validator.js';

export class AuthController {
  /**
   * Step 1: Send OTP for signup
   * Validates user data, checks if phone exists, and sends OTP
   */
  async sendSignupOTP(
    req: Request<unknown, unknown, SendSignupOTPInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { phoneNumber } = req.body;

      // Check if user already exists
      const existingUser = await userRepository.findByPhone(phoneNumber);
      if (existingUser) {
        throw new ConflictError('User with this phone number already exists', 'USER_EXISTS');
      }

      // Send OTP and store pending signup data
      const result = await otpService.sendSignupOTP(req.body);
      sendSuccess(res, result, { message: 'OTP sent to your phone number' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Step 2: Verify OTP and complete signup
   * Creates user account after successful OTP verification
   */
  async verifySignupOTP(
    req: Request<unknown, unknown, VerifySignupOTPInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { phoneNumber, otp } = req.body;

      // Verify OTP
      await otpService.verifyOTP(phoneNumber, otp);

      // Get pending signup data
      const signupData = await otpService.getPendingSignupData(phoneNumber);
      if (!signupData) {
        throw new BadRequestError(
          'Signup session expired. Please start the signup process again.',
          'SIGNUP_SESSION_EXPIRED'
        );
      }

      // Create user account
      const result = await authService.signup(signupData);

      // Clear OTP attempts after successful signup
      await otpService.clearOTPAttempts(phoneNumber);

      sendCreated(res, result, 'Account created successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend OTP
   */
  async resendOTP(
    req: Request<unknown, unknown, ResendOTPInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await otpService.resendOTP(req.body.phoneNumber);
      sendSuccess(res, result, { message: 'OTP resent successfully' });
    } catch (error) {
      next(error);
    }
  }

  async login(
    req: Request<unknown, unknown, LoginInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.login(req.body);
      sendSuccess(res, result, { message: 'Login successful' });
    } catch (error) {
      next(error);
    }
  }

  async googleAuth(
    req: Request<unknown, unknown, GoogleAuthInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.googleAuth(req.body);
      const message = result.isNewUser ? 'Account created successfully' : 'Login successful';
      sendSuccess(res, result, { message });
    } catch (error) {
      next(error);
    }
  }

  async appleAuth(
    req: Request<unknown, unknown, AppleAuthInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.appleAuth(req.body);
      const message = result.isNewUser ? 'Account created successfully' : 'Login successful';
      sendSuccess(res, result, { message });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(
    req: Request<unknown, unknown, RefreshTokenInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tokens = await authService.refreshTokens(req.body.refreshToken);
      sendSuccess(res, tokens, { message: 'Tokens refreshed' });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.body.refreshToken as string | undefined;
      await authService.logout(req.userId!, refreshToken);
      sendSuccess(res, null, { message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(
    req: Request<unknown, unknown, ChangePasswordInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await authService.changePassword(
        req.userId!,
        req.body.currentPassword,
        req.body.newPassword
      );
      sendSuccess(res, null, { message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }

  async updatePhone(
    req: Request<unknown, unknown, UpdatePhoneInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await authService.updatePhoneNumber(req.userId!, req.body.newPhoneNumber);
      sendSuccess(res, user, { message: 'Phone number updated' });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
