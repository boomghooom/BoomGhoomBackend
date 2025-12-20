import { userRepository } from '../../infrastructure/database/repositories/UserRepository.js';
import { redisClient } from '../../config/redis.js';
import { IUser, IUpdateUserDTO, IUserSummary, IUserLocation } from '../../domain/entities/User.js';
import { IPaginationOptions, IPaginatedResult } from '../../domain/repositories/IBaseRepository.js';
import { NotFoundError, BadRequestError } from '../../shared/errors/AppError.js';
import { CacheKeys, CacheTTL } from '../../shared/constants/index.js';
import { logger } from '../../shared/utils/logger.js';

export class UserService {
  async getUserById(userId: string): Promise<IUser> {
    // Try cache first
    const cached = await redisClient.get<IUser>(CacheKeys.USER(userId));
    if (cached) {
      return cached;
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Cache user
    await redisClient.set(CacheKeys.USER(userId), user, CacheTTL.MEDIUM);

    return user;
  }

  async getUserSummary(userId: string): Promise<IUserSummary> {
    const user = await this.getUserById(userId);
    return {
      _id: user._id,
      fullName: user.fullName,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      isOnline: user.isOnline,
      kycVerified: user.kyc?.status === 'approved',
      averageRating: user.stats?.averageRating || 0,
    };
  }

  async updateProfile(userId: string, data: IUpdateUserDTO): Promise<IUser> {
    const user = await userRepository.updateById(userId, data);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Invalidate cache
    await redisClient.del(CacheKeys.USER(userId));

    return user;
  }

  async updateLocation(userId: string, location: IUserLocation): Promise<IUser> {
    const user = await userRepository.updateById(userId, { location });
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Invalidate cache
    await redisClient.del(CacheKeys.USER(userId));

    return user;
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<IUser> {
    const user = await userRepository.updateById(userId, { avatarUrl });
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Invalidate cache
    await redisClient.del(CacheKeys.USER(userId));

    return user;
  }

  async addFcmToken(userId: string, token: string): Promise<void> {
    await userRepository.addFcmToken(userId, token);
  }

  async removeFcmToken(userId: string, token: string): Promise<void> {
    await userRepository.removeFcmToken(userId, token);
  }

  async setOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await userRepository.setOnlineStatus(userId, isOnline);

    if (isOnline) {
      await redisClient.sadd(CacheKeys.ONLINE_USERS, userId);
    } else {
      await redisClient.srem(CacheKeys.ONLINE_USERS, userId);
    }

    // Invalidate cache
    await redisClient.del(CacheKeys.USER(userId));
  }

  async searchUsers(
    searchTerm: string,
    currentUserId: string
  ): Promise<IUserSummary[]> {
    if (!searchTerm || searchTerm.length < 2) {
      throw new BadRequestError('Search term must be at least 2 characters');
    }

    return userRepository.searchUsers(searchTerm, currentUserId);
  }

  async getNearbyUsers(
    userId: string,
    coordinates: [number, number],
    maxDistance: number = 10000 // 10km default
  ): Promise<IUserSummary[]> {
    return userRepository.findNearby(coordinates, maxDistance, [userId]);
  }

  async getUsersByCity(
    city: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IUserSummary>> {
    return userRepository.findByCity(city, options);
  }

  async getFinanceSummary(userId: string): Promise<IUser['finance']> {
    const user = await this.getUserById(userId);
    return user.finance;
  }

  async getStats(userId: string): Promise<IUser['stats']> {
    const user = await this.getUserById(userId);
    return user.stats;
  }

  async incrementStat(
    userId: string,
    stat: keyof IUser['stats'],
    amount: number = 1
  ): Promise<void> {
    const user = await this.getUserById(userId);
    const currentValue = user.stats[stat] || 0;
    
    await userRepository.updateStats(userId, {
      [stat]: currentValue + amount,
    });

    // Invalidate cache
    await redisClient.del(CacheKeys.USER(userId));
  }

  async updateRating(userId: string, newRating: number): Promise<void> {
    const user = await this.getUserById(userId);
    const currentAvg = user.stats.averageRating || 0;
    const totalRatings = user.stats.totalRatings || 0;

    // Calculate new average
    const newAvg = (currentAvg * totalRatings + newRating) / (totalRatings + 1);

    await userRepository.updateStats(userId, {
      averageRating: Math.round(newAvg * 100) / 100, // Round to 2 decimal places
      totalRatings: totalRatings + 1,
    });

    // Invalidate cache
    await redisClient.del(CacheKeys.USER(userId));
  }

  async softDeleteUser(userId: string): Promise<void> {
    const result = await userRepository.softDelete(userId);
    if (!result) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Invalidate cache
    await redisClient.del(CacheKeys.USER(userId));
    await redisClient.srem(CacheKeys.ONLINE_USERS, userId);

    logger.info('User soft deleted', { userId });
  }

  async getPublicProfile(userId: string): Promise<Partial<IUser>> {
    const user = await this.getUserById(userId);
    
    // Return only public information
    return {
      _id: user._id,
      fullName: user.fullName,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      bio: user.bio,
      location: user.location
        ? {
            type: user.location.type,
            coordinates: user.location.coordinates,
            city: user.location.city,
            state: user.location.state,
            country: user.location.country,
          }
        : undefined,
      kyc: {
        status: user.kyc.status,
      } as IUser['kyc'],
      stats: user.stats,
      isOnline: user.isOnline,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
    };
  }

  async checkCanCreateEvent(userId: string): Promise<{ canCreate: boolean; reason?: string }> {
    const user = await this.getUserById(userId);
    
    if (user.kyc.status !== 'approved') {
      return {
        canCreate: false,
        reason: 'KYC verification required to create events',
      };
    }

    return { canCreate: true };
  }

  async checkCanJoinEvent(userId: string): Promise<{ canJoin: boolean; reason?: string }> {
    const user = await this.getUserById(userId);
    
    if (user.finance.dues > 0) {
      return {
        canJoin: false,
        reason: `Please clear your pending dues of ₹${(user.finance.dues / 100).toFixed(2)} before joining`,
      };
    }

    return { canJoin: true };
  }
}

export const userService = new UserService();

