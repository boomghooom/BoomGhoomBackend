import { Request, Response, NextFunction } from 'express';
import { socialService } from '../../application/services/SocialService.js';
import { sendSuccess, sendPaginated, sendCreated, sendNoContent } from '../../shared/utils/response.js';
import { PaginationInput, IdParamInput } from '../validators/user.validator.js';

export class SocialController {
  // Friends
  async sendFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { toUserId, eventId, message } = req.body as {
        toUserId: string;
        eventId?: string;
        message?: string;
      };
      const friendship = await socialService.sendFriendRequest({
        fromUserId: req.userId!,
        toUserId,
        eventId,
        message,
      });
      sendCreated(res, friendship, 'Friend request sent');
    } catch (error) {
      next(error);
    }
  }

  async acceptFriendRequest(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const friendship = await socialService.acceptFriendRequest(req.params.id, req.userId!);
      sendSuccess(res, friendship, { message: 'Friend request accepted' });
    } catch (error) {
      next(error);
    }
  }

  async rejectFriendRequest(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const friendship = await socialService.rejectFriendRequest(req.params.id, req.userId!);
      sendSuccess(res, friendship, { message: 'Friend request rejected' });
    } catch (error) {
      next(error);
    }
  }

  async blockUser(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const friendship = await socialService.blockUser(req.params.id, req.userId!);
      sendSuccess(res, friendship, { message: 'User blocked' });
    } catch (error) {
      next(error);
    }
  }

  async removeFriend(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await socialService.removeFriend(req.params.id, req.userId!);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async getFriends(
    req: Request<unknown, unknown, unknown, PaginationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit } = req.query;
      const result = await socialService.getFriends(req.userId!, { page, limit });
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPendingRequests(
    req: Request<unknown, unknown, unknown, PaginationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit } = req.query;
      const result = await socialService.getPendingRequests(req.userId!, { page, limit });
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      });
    } catch (error) {
      next(error);
    }
  }

  // Notifications
  async getNotifications(
    req: Request<unknown, unknown, unknown, PaginationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit } = req.query;
      const result = await socialService.getNotifications(req.userId!, { page, limit });
      const unreadCount = await socialService.getUnreadNotificationCount(req.userId!);
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await socialService.getUnreadNotificationCount(req.userId!);
      sendSuccess(res, { count });
    } catch (error) {
      next(error);
    }
  }

  async markNotificationRead(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await socialService.markNotificationAsRead(req.params.id, req.userId!);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async markAllNotificationsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await socialService.markAllNotificationsAsRead(req.userId!);
      sendSuccess(res, { markedCount: count });
    } catch (error) {
      next(error);
    }
  }

  // Ratings
  async rateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { toUserId, eventId, rating, review, isAnonymous } = req.body as {
        toUserId: string;
        eventId: string;
        rating: number;
        review?: string;
        isAnonymous?: boolean;
      };
      const result = await socialService.rateUser({
        fromUserId: req.userId!,
        toUserId,
        eventId,
        rating,
        review,
        isAnonymous,
      });
      sendCreated(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getUserRatings(
    req: Request<IdParamInput, unknown, unknown, PaginationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit } = req.query;
      const result = await socialService.getUserRatings(req.params.id, { page, limit });
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      });
    } catch (error) {
      next(error);
    }
  }

  // Reports
  async createReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { targetType, targetId, reason, description } = req.body as {
        targetType: 'event' | 'user' | 'message';
        targetId: string;
        reason: string;
        description?: string;
      };
      const report = await socialService.createReport({
        reporterId: req.userId!,
        targetType,
        targetId,
        reason,
        description,
      });
      sendCreated(res, report, 'Report submitted');
    } catch (error) {
      next(error);
    }
  }
}

export const socialController = new SocialController();

