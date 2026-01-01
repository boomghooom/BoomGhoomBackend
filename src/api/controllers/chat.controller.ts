import { Request, Response, NextFunction } from 'express';
import { chatService } from '../../application/services/ChatService.js';
import { sendSuccess, sendPaginated, sendCreated, sendNoContent } from '../../shared/utils/response.js';
import { PaginationInput, IdParamInput } from '../validators/user.validator.js';

export class ChatController {
  async getChats(
    req: Request<unknown, unknown, unknown, PaginationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit } = req.query;
      const result = await chatService.getUserChatsPaginated(req.userId!, { page, limit });
      // console.log('result', result.data);
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

  async getOrCreateDirectChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.body as { userId: string };
      const chat = await chatService.getOrCreateDirectChat(req.userId!, userId);
      sendSuccess(res, chat);
    } catch (error) {
      next(error);
    }
  }

  async getEventChat(
    req: Request<{ eventId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const chat = await chatService.getEventChat(req.params.eventId, req.userId!);
      sendSuccess(res, chat);
    } catch (error) {
      next(error);
    }
  }

  async getChatById(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const chat = await chatService.getChatById(req.params.id, req.userId!);
      sendSuccess(res, chat);
    } catch (error) {
      next(error);
    }
  }

  async getMessages(
    req: Request<IdParamInput, unknown, unknown, PaginationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit } = req.query;
      const result = await chatService.getMessagesPaginated(req.params.id, req.userId!, {
        page,
        limit,
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

  async sendMessage(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { type, content, imageUrl, eventId, replyToMessageId } = req.body as {
        type: 'text' | 'image' | 'event_share';
        content: string;
        imageUrl?: string;
        eventId?: string;
        replyToMessageId?: string;
      };
      const message = await chatService.sendMessage({
        chatId: req.params.id,
        senderId: req.userId!,
        type,
        content,
        imageUrl,
        eventId,
        replyToMessageId,
      });
      sendCreated(res, message);
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await chatService.markMessagesAsRead(req.params.id, req.userId!);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async deleteMessage(
    req: Request<{ id: string; messageId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await chatService.deleteMessage(req.params.messageId, req.userId!);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async muteChat(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { duration } = req.body as { duration?: number };
      await chatService.muteChat(req.params.id, req.userId!, duration);
      sendSuccess(res, null, { message: 'Chat muted' });
    } catch (error) {
      next(error);
    }
  }

  async unmuteChat(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await chatService.unmuteChat(req.params.id, req.userId!);
      sendSuccess(res, null, { message: 'Chat unmuted' });
    } catch (error) {
      next(error);
    }
  }
}

export const chatController = new ChatController();

