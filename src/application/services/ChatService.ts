import {
  chatRepository,
  messageRepository,
} from '../../infrastructure/database/repositories/ChatRepository.js';
import { friendshipRepository } from '../../infrastructure/database/repositories/SocialRepository.js';
import { eventRepository } from '../../infrastructure/database/repositories/EventRepository.js';
import { userRepository } from '../../infrastructure/database/repositories/UserRepository.js';
import {
  IChat,
  IMessage,
  IChatSummary,
  ISendMessageDTO,
} from '../../domain/entities/Chat.js';
import { IPaginationOptions, IPaginatedResult } from '../../domain/repositories/IBaseRepository.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../../shared/errors/AppError.js';
import { logger } from '../../shared/utils/logger.js';

export class ChatService {
  async getOrCreateDirectChat(userId1: string, userId2: string): Promise<IChat> {
    // Verify they are friends
    const areFriends = await friendshipRepository.areFriends(userId1, userId2);
    if (!areFriends) {
      throw new ForbiddenError('Only friends can chat', 'NOT_FRIENDS');
    }

    // Try to find existing chat
    let chat = await chatRepository.findDirectChat(userId1, userId2);
    
    if (!chat) {
      chat = await chatRepository.createDirectChat({ userId1, userId2 });
    }

    return chat;
  }

  async getEventChat(eventId: string, userId: string): Promise<IChat> {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    // Verify user is participant or admin
    const isParticipant = event.participants.some(
      (p) => p.userId.toString() === userId.toString() && p.status === 'approved'
    );
    const isAdmin = event.admin.userId.toString() === userId.toString();

    if (!isParticipant && !isAdmin) {
      throw new ForbiddenError('Not a participant', 'NOT_PARTICIPANT');
    }

    let chat = await chatRepository.findEventChat(eventId);
    
    if (!chat) {
      // Create event chat with all participants
      const participantIds = [
        event.admin.userId.toString(),
        ...event.participants
          .filter((p) => p.status === 'approved')
          .map((p) => p.userId.toString()),
      ];

      chat = await chatRepository.createGroupChat({
        eventId,
        name: event.title,
        imageUrl: event.coverImageUrl,
        participantIds,
      });
    }

    return chat;
  }

  async getUserChats(userId: string): Promise<IChatSummary[]> {
    const chats = await chatRepository.findUserChats(userId);
    
    // Calculate unread counts
    const unreadCounts = await messageRepository.getUnreadCountForUser(userId);
    
    return chats.map((chat) => ({
      ...chat,
      unreadCount: unreadCounts.get(chat._id) || 0,
    }));
  }

  async getUserChatsPaginated(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IChatSummary>> {
    const result = await chatRepository.findUserChatsPaginated(userId, options);
    const unreadCounts = await messageRepository.getUnreadCountForUser(userId);

    return {
      ...result,
      data: result.data.map((chat) => ({
        ...chat,
        unreadCount: unreadCounts.get(chat._id) || 0,
      })),
    };
  }

  async getChatById(chatId: string, userId: string): Promise<IChat> {
    const chat = await chatRepository.findById(chatId);
    if (!chat) {
      throw new NotFoundError('Chat not found', 'CHAT_NOT_FOUND');
    }

    // Verify user is participant
    const isParticipant = await chatRepository.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenError('Not a participant', 'NOT_PARTICIPANT');
    }

    return chat;
  }

  async sendMessage(data: ISendMessageDTO): Promise<IMessage> {
    const chat = await chatRepository.findById(data.chatId);
    if (!chat) {
      throw new NotFoundError('Chat not found', 'CHAT_NOT_FOUND');
    }

    // Verify sender is participant
    const isParticipant = await chatRepository.isParticipant(data.chatId, data.senderId);
    if (!isParticipant) {
      throw new ForbiddenError('Not a participant', 'NOT_PARTICIPANT');
    }

    // For direct chats, verify they are still friends
    if (chat.type === 'direct') {
      const otherParticipant = chat.participants.find(
        (p) => p.userId.toString() !== data.senderId.toString()
      );
      if (otherParticipant) {
        const areFriends = await friendshipRepository.areFriends(
          data.senderId,
          otherParticipant.userId.toString()
        );
        if (!areFriends) {
          throw new ForbiddenError('Only friends can chat', 'NOT_FRIENDS');
        }
      }
    }

    // Get sender info
    const sender = await userRepository.findById(data.senderId);
    if (!sender) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }
    // console.log('sender', sender.fullName);
    // Create message
    const message = await messageRepository.create({
      ...data,
      senderName: sender.fullName,
      senderAvatar: sender.avatarUrl,
    } as ISendMessageDTO);
    // console.log('message',message)
    // Update message with sender info
    const fullMessage: IMessage = {
      ...message,
      senderName: sender.fullName,
      senderAvatar: sender.avatarUrl,
    };
    // console.log('fullMessage',fullMessage)
    // Update chat last message
    await chatRepository.updateLastMessage(data.chatId, fullMessage);

    logger.info('Message sent', { chatId: data.chatId, senderId: data.senderId });

    return fullMessage;
  }

  async getMessages(
    chatId: string,
    userId: string,
    options: { beforeDate?: Date; limit?: number } = {}
  ): Promise<IMessage[]> {
    // Verify user is participant
    const isParticipant = await chatRepository.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenError('Not a participant', 'NOT_PARTICIPANT');
    }

    const messages = await messageRepository.findByChat(chatId, options);

    // Mark messages as read
    await messageRepository.markManyAsRead(chatId, userId);
    await chatRepository.updateLastReadAt(chatId, userId);

    return messages;
  }

  async getMessagesPaginated(
    chatId: string,
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IMessage>> {
    // Verify user is participant
    const isParticipant = await chatRepository.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenError('Not a participant', 'NOT_PARTICIPANT');
    }

    const result = await messageRepository.findByChatPaginated(chatId, options);

    // Mark messages as read
    await messageRepository.markManyAsRead(chatId, userId);
    await chatRepository.updateLastReadAt(chatId, userId);

    return result;
  }

  async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    const isParticipant = await chatRepository.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenError('Not a participant', 'NOT_PARTICIPANT');
    }

    await messageRepository.markManyAsRead(chatId, userId);
    await chatRepository.updateLastReadAt(chatId, userId);
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await messageRepository.findById(messageId);
    if (!message) {
      throw new NotFoundError('Message not found', 'MESSAGE_NOT_FOUND');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenError('Not authorized', 'NOT_AUTHORIZED');
    }

    await messageRepository.softDelete(messageId);
  }

  async muteChat(chatId: string, userId: string, duration?: number): Promise<void> {
    const isParticipant = await chatRepository.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenError('Not a participant', 'NOT_PARTICIPANT');
    }

    const mutedUntil = duration
      ? new Date(Date.now() + duration * 1000)
      : undefined;

    await chatRepository.muteChat(chatId, userId, mutedUntil);
  }

  async unmuteChat(chatId: string, userId: string): Promise<void> {
    const isParticipant = await chatRepository.isParticipant(chatId, userId);
    if (!isParticipant) {
      throw new ForbiddenError('Not a participant', 'NOT_PARTICIPANT');
    }

    await chatRepository.unmuteChat(chatId, userId);
  }

  async getUnreadCount(chatId: string, userId: string): Promise<number> {
    return chatRepository.getUnreadCount(chatId, userId);
  }

  async canChat(userId1: string, userId2: string): Promise<boolean> {
    return friendshipRepository.areFriends(userId1, userId2);
  }

  async canChatInEvent(eventId: string, userId: string): Promise<{
    canChat: boolean;
    isAdmin: boolean;
  }> {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      return { canChat: false, isAdmin: false };
    }

    const isAdmin = event.admin.userId.toString() === userId;
    const isParticipant = event.participants.some(
      (p) => p.userId.toString() === userId && p.status === 'approved'
    );

    return {
      canChat: isAdmin || isParticipant,
      isAdmin,
    };
  }
}

export const chatService = new ChatService();

