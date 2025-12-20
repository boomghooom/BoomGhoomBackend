import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { redisClient } from '../config/redis.js';
import { userRepository } from '../infrastructure/database/repositories/UserRepository.js';
import { chatService } from '../application/services/ChatService.js';
import { CacheKeys } from '../shared/constants/index.js';
import { logger } from '../shared/utils/logger.js';
import { ITokenPayload } from '../application/services/AuthService.js';

interface AuthenticatedSocket extends Socket {
  userId: string;
  userName: string;
}

interface ChatMessage {
  chatId: string;
  type: 'text' | 'image' | 'event_share';
  content: string;
  imageUrl?: string;
  eventId?: string;
  replyToMessageId?: string;
}

interface TypingEvent {
  chatId: string;
  isTyping: boolean;
}

export const initializeSocket = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: config.cors.origins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = jwt.verify(token, config.jwt.accessSecret) as ITokenPayload;
      const user = await userRepository.findById(payload.userId);

      if (!user) {
        return next(new Error('User not found'));
      }

      if (user.isBlocked) {
        return next(new Error('Account is blocked'));
      }

      (socket as AuthenticatedSocket).userId = user._id;
      (socket as AuthenticatedSocket).userName = user.fullName;

      next();
    } catch (error) {
      logger.error('Socket authentication failed:', error);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;

    logger.info('Socket connected', { userId, socketId: socket.id });

    // Mark user online
    await userRepository.setOnlineStatus(userId, true);
    await redisClient.sadd(CacheKeys.ONLINE_USERS, userId);

    // Join user's personal room for notifications
    socket.join(`user:${userId}`);

    // Join all active chat rooms
    try {
      const chats = await chatService.getUserChats(userId);
      chats.forEach((chat) => {
        socket.join(`chat:${chat._id}`);
      });
    } catch (error) {
      logger.error('Error joining chat rooms:', error);
    }

    // Handle joining a specific chat room
    socket.on('chat:join', async (chatId: string) => {
      try {
        // Verify user can access this chat
        await chatService.getChatById(chatId, userId);
        socket.join(`chat:${chatId}`);
        logger.info('User joined chat', { userId, chatId });
      } catch (error) {
        socket.emit('error', { message: 'Cannot join chat' });
      }
    });

    // Handle leaving a chat room
    socket.on('chat:leave', (chatId: string) => {
      socket.leave(`chat:${chatId}`);
      logger.info('User left chat', { userId, chatId });
    });

    // Handle sending messages
    socket.on('chat:message', async (data: ChatMessage) => {
      try {
        const message = await chatService.sendMessage({
          chatId: data.chatId,
          senderId: userId,
          type: data.type,
          content: data.content,
          imageUrl: data.imageUrl,
          eventId: data.eventId,
          replyToMessageId: data.replyToMessageId,
        });

        // Broadcast to all users in the chat room
        io.to(`chat:${data.chatId}`).emit('chat:message', {
          chatId: data.chatId,
          message,
        });

        logger.info('Message sent via socket', { userId, chatId: data.chatId });
      } catch (error) {
        logger.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('chat:typing', (data: TypingEvent) => {
      socket.to(`chat:${data.chatId}`).emit('chat:typing', {
        chatId: data.chatId,
        userId,
        userName: authSocket.userName,
        isTyping: data.isTyping,
      });
    });

    // Handle marking messages as read
    socket.on('chat:read', async (chatId: string) => {
      try {
        await chatService.markMessagesAsRead(chatId, userId);
        socket.to(`chat:${chatId}`).emit('chat:read', {
          chatId,
          userId,
        });
      } catch (error) {
        logger.error('Error marking messages as read:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async (reason) => {
      logger.info('Socket disconnected', { userId, socketId: socket.id, reason });

      // Mark user offline after a delay (to handle reconnects)
      setTimeout(async () => {
        const userSockets = await io.in(`user:${userId}`).fetchSockets();
        if (userSockets.length === 0) {
          await userRepository.setOnlineStatus(userId, false);
          await redisClient.srem(CacheKeys.ONLINE_USERS, userId);
        }
      }, 5000);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error', { userId, error });
    });
  });

  return io;
};

// Utility function to emit events to specific users
export const emitToUser = (io: Server, userId: string, event: string, data: unknown): void => {
  io.to(`user:${userId}`).emit(event, data);
};

// Utility function to emit events to a chat room
export const emitToChat = (io: Server, chatId: string, event: string, data: unknown): void => {
  io.to(`chat:${chatId}`).emit(event, data);
};

// Utility function to get online status
export const getOnlineUsers = async (): Promise<string[]> => {
  return redisClient.smembers(CacheKeys.ONLINE_USERS);
};

export const isUserOnline = async (userId: string): Promise<boolean> => {
  return redisClient.sismember(CacheKeys.ONLINE_USERS, userId);
};

