import { userRepository } from '../../infrastructure/database/repositories/UserRepository.js';
import { notificationRepository } from '../../infrastructure/database/repositories/SocialRepository.js';
import { redisClient } from '../../config/redis.js';
import { IUser } from '../../domain/entities/User.js';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from '../../shared/errors/AppError.js';
import { CacheKeys, KYCStatus } from '../../shared/constants/index.js';
import { logWithContext, logger } from '../../shared/utils/logger.js';

export interface IInitiateKYCDTO {
  userId: string;
}

export interface ISubmitSelfieDTO {
  userId: string;
  selfieUrl: string;
}

export interface ISubmitDocumentDTO {
  userId: string;
  documentUrl: string;
  documentType: 'aadhaar' | 'pan' | 'driving_license' | 'passport';
}

export interface IKYCVerificationResult {
  status: KYCStatus;
  verifiedAt?: Date;
  rejectionReason?: string;
}

export class KYCService {
  async initiateKYC(data: IInitiateKYCDTO): Promise<IUser> {
    const user = await userRepository.findById(data.userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    if (user.kyc.status === 'approved') {
      throw new ConflictError('KYC already approved', 'KYC_ALREADY_APPROVED');
    }

    if (user.kyc.status === 'pending') {
      throw new ConflictError('KYC verification already in progress', 'KYC_PENDING');
    }

    // Reset KYC status to allow re-submission after rejection
    const updatedUser = await userRepository.updateKYCStatus(data.userId, 'not_started');
    if (!updatedUser) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    logWithContext.kyc('KYC initiated', { userId: data.userId });

    return updatedUser;
  }

  async submitSelfie(data: ISubmitSelfieDTO): Promise<IUser> {
    const user = await userRepository.findById(data.userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    if (user.kyc.status === 'approved') {
      throw new ConflictError('KYC already approved', 'KYC_ALREADY_APPROVED');
    }

    if (!data.selfieUrl) {
      throw new BadRequestError('Selfie URL is required', 'SELFIE_REQUIRED');
    }

    // Update KYC with selfie and set status to pending
    const updatedUser = await userRepository.updateKYCStatus(data.userId, 'pending', {
      selfieUrl: data.selfieUrl,
      submittedAt: new Date(),
    });

    if (!updatedUser) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Invalidate cache
    await redisClient.del(CacheKeys.USER(data.userId));
    await redisClient.del(CacheKeys.KYC_STATUS(data.userId));

    logWithContext.kyc('Selfie submitted', { userId: data.userId });

    return updatedUser;
  }

  async submitDocument(data: ISubmitDocumentDTO): Promise<IUser> {
    const user = await userRepository.findById(data.userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    if (user.kyc.status === 'approved') {
      throw new ConflictError('KYC already approved', 'KYC_ALREADY_APPROVED');
    }

    if (!user.kyc.selfieUrl) {
      throw new BadRequestError('Please submit selfie first', 'SELFIE_NOT_SUBMITTED');
    }

    const updatedUser = await userRepository.updateKYCStatus(data.userId, user.kyc.status, {
      documentUrl: data.documentUrl,
      documentType: data.documentType,
    });

    if (!updatedUser) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Invalidate cache
    await redisClient.del(CacheKeys.USER(data.userId));

    logWithContext.kyc('Document submitted', {
      userId: data.userId,
      documentType: data.documentType,
    });

    return updatedUser;
  }

  async getKYCStatus(userId: string): Promise<IUser['kyc']> {
    // Try cache first
    const cached = await redisClient.get<IUser['kyc']>(CacheKeys.KYC_STATUS(userId));
    if (cached) {
      return cached;
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Cache KYC status
    await redisClient.set(CacheKeys.KYC_STATUS(userId), user.kyc, CacheTTL.MEDIUM);

    return user.kyc;
  }

  // Admin methods
  async approveKYC(userId: string, adminId: string): Promise<IUser> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    if (user.kyc.status !== 'pending') {
      throw new BadRequestError('KYC is not pending verification', 'KYC_NOT_PENDING');
    }

    const updatedUser = await userRepository.updateKYCStatus(userId, 'approved', {
      verifiedAt: new Date(),
    });

    if (!updatedUser) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Invalidate cache
    await redisClient.del(CacheKeys.USER(userId));
    await redisClient.del(CacheKeys.KYC_STATUS(userId));

    // Send notification
    await notificationRepository.create({
      userId,
      type: 'kyc_approved',
      title: 'KYC Approved! 🎉',
      body: 'Your identity has been verified. You can now create group activities!',
    });

    logWithContext.kyc('KYC approved', { userId, adminId });

    return updatedUser;
  }

  async rejectKYC(userId: string, adminId: string, reason: string): Promise<IUser> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    if (user.kyc.status !== 'pending') {
      throw new BadRequestError('KYC is not pending verification', 'KYC_NOT_PENDING');
    }

    const updatedUser = await userRepository.updateKYCStatus(userId, 'rejected', {
      rejectionReason: reason,
    });

    if (!updatedUser) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Invalidate cache
    await redisClient.del(CacheKeys.USER(userId));
    await redisClient.del(CacheKeys.KYC_STATUS(userId));

    // Send notification
    await notificationRepository.create({
      userId,
      type: 'kyc_rejected',
      title: 'KYC Verification Failed',
      body: `Your verification was rejected: ${reason}. Please try again.`,
    });

    logWithContext.kyc('KYC rejected', { userId, adminId, reason });

    return updatedUser;
  }

  async getPendingKYCs(page: number = 1, limit: number = 20): Promise<{
    users: IUser[];
    total: number;
  }> {
    const skip = (page - 1) * limit;
    
    const result = await userRepository.findPaginated(
      { 'kyc.status': 'pending', isDeleted: false },
      { page, limit, sort: { 'kyc.submittedAt': 1 } }
    );

    return {
      users: result.data,
      total: result.total,
    };
  }

  async isKYCVerified(userId: string): Promise<boolean> {
    const kyc = await this.getKYCStatus(userId);
    return kyc.status === 'approved';
  }
}

// Import CacheTTL
import { CacheTTL } from '../../shared/constants/index.js';

export const kycService = new KYCService();

