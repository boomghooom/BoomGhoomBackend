import { Request, Response, NextFunction } from 'express';
import { userService } from '../../application/services/UserService.js';
import { kycService } from '../../application/services/KYCService.js';
import { sendSuccess, sendPaginated } from '../../shared/utils/response.js';
import {
  UpdateProfileInput,
  UpdateLocationInput,
  UpdateBankDetailsInput,
  SearchUsersInput,
  PaginationInput,
  IdParamInput,
} from '../validators/user.validator.js';

export class UserController {
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getUserById(req.userId!);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  async getProfile(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const profile = await userService.getPublicProfile(req.params.id);
      sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(
    req: Request<unknown, unknown, UpdateProfileInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await userService.updateProfile(req.userId!, req.body);
      sendSuccess(res, user, { message: 'Profile updated' });
    } catch (error) {
      next(error);
    }
  }

  async updateLocation(
    req: Request<unknown, unknown, UpdateLocationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { latitude, longitude, city, state, country } = req.body;
      const user = await userService.updateLocation(req.userId!, {
        type: 'Point',
        coordinates: [longitude, latitude],
        city,
        state,
        country,
      });
      sendSuccess(res, user, { message: 'Location updated' });
    } catch (error) {
      next(error);
    }
  }

  async updateBankDetails(
    req: Request<unknown, unknown, UpdateBankDetailsInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await userService.updateProfile(req.userId!, {
        bankDetails: { ...req.body, isVerified: false },
      });
      sendSuccess(res, user, { message: 'Bank details updated' });
    } catch (error) {
      next(error);
    }
  }

  async updateAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { avatarUrl } = req.body as { avatarUrl: string };
      const user = await userService.updateAvatar(req.userId!, avatarUrl);
      sendSuccess(res, user, { message: 'Avatar updated' });
    } catch (error) {
      next(error);
    }
  }

  async addFcmToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body as { token: string };
      await userService.addFcmToken(req.userId!, token);
      sendSuccess(res, null, { message: 'FCM token added' });
    } catch (error) {
      next(error);
    }
  }

  async removeFcmToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body as { token: string };
      await userService.removeFcmToken(req.userId!, token);
      sendSuccess(res, null, { message: 'FCM token removed' });
    } catch (error) {
      next(error);
    }
  }

  async searchUsers(
    req: Request<unknown, unknown, unknown, SearchUsersInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const users = await userService.searchUsers(req.query.q, req.userId!);
      sendSuccess(res, users);
    } catch (error) {
      next(error);
    }
  }

  async getFinanceSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await userService.getFinanceSummary(req.userId!);
      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await userService.getStats(req.userId!);
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await userService.softDeleteUser(req.userId!);
      sendSuccess(res, null, { message: 'Account deleted' });
    } catch (error) {
      next(error);
    }
  }

  // KYC endpoints
  async initiateKYC(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await kycService.initiateKYC({ userId: req.userId! });
      sendSuccess(res, user.kyc, { message: 'KYC initiated' });
    } catch (error) {
      next(error);
    }
  }

  async submitSelfie(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { selfieUrl } = req.body as { selfieUrl: string };
      const user = await kycService.submitSelfie({ userId: req.userId!, selfieUrl });
      sendSuccess(res, user.kyc, { message: 'Selfie submitted' });
    } catch (error) {
      next(error);
    }
  }

  async submitDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documentUrl, documentType } = req.body as {
        documentUrl: string;
        documentType: 'aadhaar' | 'pan' | 'driving_license' | 'passport';
      };
      const user = await kycService.submitDocument({
        userId: req.userId!,
        documentUrl,
        documentType,
      });
      sendSuccess(res, user.kyc, { message: 'Document submitted' });
    } catch (error) {
      next(error);
    }
  }

  async getKYCStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const kyc = await kycService.getKYCStatus(req.userId!);
      sendSuccess(res, kyc);
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();

