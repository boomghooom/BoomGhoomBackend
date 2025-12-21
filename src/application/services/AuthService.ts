import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../../config/index.js';
import { userRepository } from '../../infrastructure/database/repositories/UserRepository.js';
import { UserModel } from '../../infrastructure/database/models/User.model.js';
import { redisClient } from '../../config/redis.js';
import { IUser, ICreateUserDTO } from '../../domain/entities/User.js';
import {
  UnauthorizedError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../shared/errors/AppError.js';
import { CacheKeys } from '../../shared/constants/index.js';
import { logger, logWithContext } from '../../shared/utils/logger.js';

export interface ITokenPayload {
  userId: string;
  phoneNumber: string;
  type: 'access' | 'refresh';
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ILoginCredentials {
  phoneNumber: string;
  password: string;
}

export interface ISignupData {
  phoneNumber: string;
  fullName: string;
  password: string;
  email?: string;
  gender?: string;
  fcmToken?: string;
  referralCode?: string;
}

export interface IGoogleAuthData {
  idToken: string;
}

export interface IAppleAuthData {
  identityToken: string;
  authorizationCode: string;
  fullName?: {
    givenName?: string;
    familyName?: string;
  };
}

export class AuthService {
  private googleClient: OAuth2Client;

  constructor() {
    this.googleClient = new OAuth2Client(config.google.clientId);
  }

  async signup(data: ISignupData): Promise<{ user: IUser; tokens: IAuthTokens }> {
    // Check if active user already exists
    const existingUser = await userRepository.findByPhone(data.phoneNumber);
    if (existingUser) {
      throw new ConflictError('User with this phone number already exists', 'USER_EXISTS');
    }

    // Check if a soft-deleted user exists with this phone number
    // We need to check the model directly since findByPhone filters out deleted users
    const softDeletedUser = await UserModel.findOne({
      phoneNumber: data.phoneNumber,
      isDeleted: true,
    });

    // Validate referral code if provided
    let referredBy: string | undefined;
    if (data.referralCode) {
      const referrer = await userRepository.findByReferralCode(data.referralCode);
      if (referrer) {
        referredBy = referrer._id;
      }
    }

    let user: IUser;

    if (softDeletedUser) {
      // Restore and update the soft-deleted user
      const updateData: Record<string, unknown> = {
        fullName: data.fullName,
        password: data.password,
        email: data.email,
        authProvider: 'phone' as const,
        referredBy,
        isDeleted: false,
        deletedAt: undefined,
        ...(data.gender && { gender: data.gender }),
        ...(data.fcmToken && { fcmTokens: [data.fcmToken] }),
      };

      // Restore the user by updating it
      const restoredUser = await UserModel.findByIdAndUpdate(
        softDeletedUser._id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!restoredUser) {
        throw new ConflictError('Failed to restore account', 'RESTORE_FAILED');
      }

      // Get the restored user through repository to ensure proper type conversion
      const restored = await userRepository.findById(restoredUser._id.toString());
      if (!restored) {
        throw new ConflictError('Failed to restore account', 'RESTORE_FAILED');
      }
      user = restored;
      logWithContext.auth('User account restored', {
        userId: user._id,
        phoneNumber: data.phoneNumber,
      });
    } else {
      // Create new user
      const createData: ICreateUserDTO = {
        phoneNumber: data.phoneNumber,
        fullName: data.fullName,
        password: data.password,
        email: data.email,
        authProvider: 'phone',
        referredBy,
        ...(data.gender && { gender: data.gender }),
        ...(data.fcmToken && { fcmTokens: [data.fcmToken] }),
      };

      try {
        user = await userRepository.create(createData);
        logWithContext.auth('User signed up', { userId: user._id, phoneNumber: data.phoneNumber });
      } catch (error) {
        // Handle case where MongoDB unique constraint fails (race condition)
        // This can happen if a user was created between our check and create
        if (
          (error as { code?: number; name?: string }).code === 11000 ||
          (error as { code?: number; name?: string }).name === 'MongoServerError'
        ) {
          // Try to find and restore if it's a soft-deleted user
          const raceConditionUser = await UserModel.findOne({
            phoneNumber: data.phoneNumber,
          });
          if (raceConditionUser?.isDeleted) {
            const updateData: Record<string, unknown> = {
              fullName: data.fullName,
              password: data.password,
              email: data.email,
              authProvider: 'phone' as const,
              referredBy,
              isDeleted: false,
              deletedAt: undefined,
              ...(data.gender && { gender: data.gender }),
              ...(data.fcmToken && { fcmTokens: [data.fcmToken] }),
            };
            const restoredUser = await UserModel.findByIdAndUpdate(
              raceConditionUser._id,
              { $set: updateData },
              { new: true, runValidators: true }
            );
            if (restoredUser) {
              // Get the restored user through repository to ensure proper type conversion
              const restored = await userRepository.findById(restoredUser._id.toString());
              if (!restored) {
                throw new ConflictError('User with this phone number already exists', 'USER_EXISTS');
              }
              user = restored;
              logWithContext.auth('User account restored (race condition)', {
                userId: user._id,
                phoneNumber: data.phoneNumber,
              });
            } else {
              throw new ConflictError('User with this phone number already exists', 'USER_EXISTS');
            }
          } else {
            throw new ConflictError('User with this phone number already exists', 'USER_EXISTS');
          }
        } else {
          throw error;
        }
      }
    }

    const tokens = await this.generateTokens(user);

    return { user, tokens };
  }

  async login(credentials: ILoginCredentials): Promise<{ user: IUser; tokens: IAuthTokens }> {
    console.log('Login attempt for phone:', credentials.phoneNumber);
    const user = await userRepository.findByPhoneWithPassword(credentials.phoneNumber);
    console.log('User found:', user ? 'Yes' : 'No');
    if (!user) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (user.isBlocked) {
      throw new UnauthorizedError('Account is blocked', 'ACCOUNT_BLOCKED');
    }

    const isPasswordValid = await userRepository.comparePassword(user._id, credentials.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const tokens = await this.generateTokens(user);

    // Update last active
    await userRepository.setOnlineStatus(user._id, true);

    logWithContext.auth('User logged in', { userId: user._id });

    return { user, tokens };
  }

  async googleAuth(data: IGoogleAuthData): Promise<{ user: IUser; tokens: IAuthTokens; isNewUser: boolean }> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: data.idToken,
        audience: config.google.clientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedError('Invalid Google token', 'INVALID_TOKEN');
      }

      const { sub: googleId, email, name, picture } = payload;

      // Check if user exists with Google ID
      let user = await userRepository.findByGoogleId(googleId!);
      let isNewUser = false;

      if (!user) {
        // Check if user exists with same email
        if (email) {
          user = await userRepository.findByEmail(email);
          if (user) {
            // Link Google account to existing user
            await userRepository.updateById(user._id, { googleId } as never);
            user = await userRepository.findById(user._id);
          }
        }

        // Create new user if not found
        if (!user) {
          isNewUser = true;
          // Generate a temporary phone number (user will update later)
          const tempPhone = `google_${googleId}`;
          
          user = await userRepository.create({
            phoneNumber: tempPhone,
            fullName: name || 'User',
            email,
            authProvider: 'google',
            googleId,
          });

          // Update avatar if provided
          if (picture) {
            await userRepository.updateById(user._id, { avatarUrl: picture });
            user = await userRepository.findById(user._id);
          }
        }
      }

      if (!user) {
        throw new UnauthorizedError('Failed to authenticate with Google', 'GOOGLE_AUTH_FAILED');
      }

      if (user.isBlocked) {
        throw new UnauthorizedError('Account is blocked', 'ACCOUNT_BLOCKED');
      }

      const tokens = await this.generateTokens(user);
      await userRepository.setOnlineStatus(user._id, true);

      logWithContext.auth('User authenticated via Google', { userId: user._id, isNewUser });

      return { user, tokens, isNewUser };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      logger.error('Google auth error:', error);
      throw new UnauthorizedError('Google authentication failed', 'GOOGLE_AUTH_FAILED');
    }
  }

  async appleAuth(data: IAppleAuthData): Promise<{ user: IUser; tokens: IAuthTokens; isNewUser: boolean }> {
    try {
      // Decode and verify Apple identity token
      // In production, this should properly verify the token with Apple's public keys
      const decoded = jwt.decode(data.identityToken) as { sub: string; email?: string } | null;
      
      if (!decoded || !decoded.sub) {
        throw new UnauthorizedError('Invalid Apple token', 'INVALID_TOKEN');
      }

      const appleId = decoded.sub;
      const email = decoded.email;

      // Check if user exists with Apple ID
      let user = await userRepository.findByAppleId(appleId);
      let isNewUser = false;

      if (!user) {
        // Check if user exists with same email
        if (email) {
          user = await userRepository.findByEmail(email);
          if (user) {
            // Link Apple account to existing user
            await userRepository.updateById(user._id, { appleId } as never);
            user = await userRepository.findById(user._id);
          }
        }

        // Create new user if not found
        if (!user) {
          isNewUser = true;
          const tempPhone = `apple_${appleId}`;
          const fullName = data.fullName
            ? `${data.fullName.givenName || ''} ${data.fullName.familyName || ''}`.trim() || 'User'
            : 'User';

          user = await userRepository.create({
            phoneNumber: tempPhone,
            fullName,
            email,
            authProvider: 'apple',
            appleId,
          });
        }
      }

      if (!user) {
        throw new UnauthorizedError('Failed to authenticate with Apple', 'APPLE_AUTH_FAILED');
      }

      if (user.isBlocked) {
        throw new UnauthorizedError('Account is blocked', 'ACCOUNT_BLOCKED');
      }

      const tokens = await this.generateTokens(user);
      await userRepository.setOnlineStatus(user._id, true);

      logWithContext.auth('User authenticated via Apple', { userId: user._id, isNewUser });

      return { user, tokens, isNewUser };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      logger.error('Apple auth error:', error);
      throw new UnauthorizedError('Apple authentication failed', 'APPLE_AUTH_FAILED');
    }
  }

  async refreshTokens(refreshToken: string): Promise<IAuthTokens> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as ITokenPayload;
      
      if (payload.type !== 'refresh') {
        throw new UnauthorizedError('Invalid token type', 'INVALID_TOKEN');
      }

      // Check if token is blacklisted
      const isBlacklisted = await redisClient.exists(CacheKeys.REFRESH_TOKEN(refreshToken));
      if (isBlacklisted) {
        throw new UnauthorizedError('Token has been revoked', 'TOKEN_REVOKED');
      }

      // Get user
      const user = await userRepository.findById(payload.userId);
      if (!user) {
        throw new UnauthorizedError('User not found', 'USER_NOT_FOUND');
      }

      if (user.isBlocked) {
        throw new UnauthorizedError('Account is blocked', 'ACCOUNT_BLOCKED');
      }

      // Blacklist old refresh token
      await this.blacklistToken(refreshToken);

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      return tokens;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid refresh token', 'INVALID_TOKEN');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token expired', 'TOKEN_EXPIRED');
      }
      throw error;
    }
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    // Blacklist refresh token if provided
    if (refreshToken) {
      await this.blacklistToken(refreshToken);
    }

    // Set user offline
    await userRepository.setOnlineStatus(userId, false);

    // Clear user session cache
    await redisClient.del(CacheKeys.USER_SESSION(userId));

    logWithContext.auth('User logged out', { userId });
  }

  async validateAccessToken(token: string): Promise<ITokenPayload> {
    try {
      const payload = jwt.verify(token, config.jwt.accessSecret) as ITokenPayload;
      
      if (payload.type !== 'access') {
        throw new UnauthorizedError('Invalid token type', 'INVALID_TOKEN');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid access token', 'INVALID_TOKEN');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Access token expired', 'TOKEN_EXPIRED');
      }
      throw error;
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    if (!user.password) {
      throw new BadRequestError(
        'Cannot change password for social auth accounts',
        'SOCIAL_AUTH_ACCOUNT'
      );
    }

    const isPasswordValid = await userRepository.comparePassword(userId, currentPassword);
    if (!isPasswordValid) {
      throw new BadRequestError('Current password is incorrect', 'INVALID_PASSWORD');
    }

    // Update password (will be hashed by pre-save hook)
    await userRepository.updateById(userId, { password: newPassword } as never);

    logWithContext.auth('Password changed', { userId });
  }

  async updatePhoneNumber(userId: string, newPhoneNumber: string): Promise<IUser> {
    // Check if phone number is already in use
    const existingUser = await userRepository.findByPhone(newPhoneNumber);
    if (existingUser && existingUser._id !== userId) {
      throw new ConflictError('Phone number already in use', 'PHONE_EXISTS');
    }

    const user = await userRepository.updateById(userId, { phoneNumber: newPhoneNumber } as never);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    return user;
  }

  private async generateTokens(user: IUser): Promise<IAuthTokens> {
    const accessPayload: ITokenPayload = {
      userId: user._id,
      phoneNumber: user.phoneNumber,
      type: 'access',
    };

    const refreshPayload: ITokenPayload = {
      userId: user._id,
      phoneNumber: user.phoneNumber,
      type: 'refresh',
    };

    const accessToken = jwt.sign(accessPayload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiry,
    });

    const refreshToken = jwt.sign(refreshPayload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiry,
    });

    // Calculate expiration time in seconds
    const decoded = jwt.decode(accessToken) as { exp: number };
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private async blacklistToken(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as { exp: number } | null;
      if (decoded?.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redisClient.set(CacheKeys.REFRESH_TOKEN(token), '1', ttl);
        }
      }
    } catch (error) {
      logger.error('Error blacklisting token:', error);
    }
  }
}

export const authService = new AuthService();

