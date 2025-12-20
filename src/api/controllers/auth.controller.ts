import { Request, Response, NextFunction } from 'express';
import { authService } from '../../application/services/AuthService.js';
import { sendSuccess, sendCreated } from '../../shared/utils/response.js';
import {
  SignupInput,
  LoginInput,
  GoogleAuthInput,
  AppleAuthInput,
  RefreshTokenInput,
  ChangePasswordInput,
  UpdatePhoneInput,
} from '../validators/auth.validator.js';

export class AuthController {
  async signup(
    req: Request<unknown, unknown, SignupInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await authService.signup(req.body);
      sendCreated(res, result, 'Account created successfully');
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

