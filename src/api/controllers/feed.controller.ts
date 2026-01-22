import { Request, Response, NextFunction } from 'express';
import { feedService } from '../../application/services/FeedService.js';
import { recommendationService } from '../../application/services/RecommendationService.js';
import { sendPaginated, sendSuccess } from '../../shared/utils/response.js';

export class FeedController {
  async getHomeFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await feedService.getHomeFeed(req.userId!, {
        page: Number(page),
        limit: Number(limit),
      });
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

  async getDiscoverFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await feedService.getDiscoverFeed(req.userId!, {
        page: Number(page),
        limit: Number(limit),
      });
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

  async getEventFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await feedService.getEventFeed(req.userId!, {
        page: Number(page),
        limit: Number(limit),
      });
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

  async getFriendSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 20 } = req.query;
      const suggestions = await recommendationService.getFriendSuggestions(
        req.userId!,
        Number(limit)
      );
      sendSuccess(res, suggestions);
    } catch (error) {
      next(error);
    }
  }
}

export const feedController = new FeedController();
