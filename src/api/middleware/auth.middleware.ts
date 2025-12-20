import { Request, Response, NextFunction } from 'express';
import { authService, ITokenPayload } from '../../application/services/AuthService.js';
import { userRepository } from '../../infrastructure/database/repositories/UserRepository.js';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/AppError.js';
import { IUser } from '../../domain/entities/User.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
      tokenPayload?: ITokenPayload;
    }
  }
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided', 'NO_TOKEN');
    }

    const token = authHeader.split(' ')[1];
    const payload = await authService.validateAccessToken(token);

    // Get user from database
    const user = await userRepository.findById(payload.userId);
    if (!user) {
      throw new UnauthorizedError('User not found', 'USER_NOT_FOUND');
    }

    if (user.isBlocked) {
      throw new ForbiddenError('Account is blocked', 'ACCOUNT_BLOCKED');
    }

    if (user.isDeleted) {
      throw new UnauthorizedError('Account has been deleted', 'ACCOUNT_DELETED');
    }

    req.user = user;
    req.userId = user._id;
    req.tokenPayload = payload;

    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = await authService.validateAccessToken(token);
      const user = await userRepository.findById(payload.userId);

      if (user && !user.isBlocked && !user.isDeleted) {
        req.user = user;
        req.userId = user._id;
        req.tokenPayload = payload;
      }
    }

    next();
  } catch {
    // Token invalid, continue without user
    next();
  }
};

export const requireKYC = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required', 'NOT_AUTHENTICATED');
    }

    if (req.user.kyc.status !== 'approved') {
      throw new ForbiddenError(
        'KYC verification required',
        'KYC_REQUIRED'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireNoDues = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required', 'NOT_AUTHENTICATED');
    }

    if (req.user.finance.dues > 0) {
      throw new ForbiddenError(
        `Please clear your pending dues of ₹${(req.user.finance.dues / 100).toFixed(2)}`,
        'DUES_PENDING'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

