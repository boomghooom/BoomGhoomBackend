import { Types } from 'mongoose';
import { BaseRepository } from './BaseRepository.js';
import {
  ChatModel,
  IChatDocument,
  MessageModel,
  IMessageDocument,
} from '../models/Chat.model.js';
import {
  IChat,
  IMessage,
  IChatSummary,
  ICreateDirectChatDTO,
  ICreateGroupChatDTO,
  ISendMessageDTO,
  IMessageQuery,
} from '../../../domain/entities/Chat.js';
import { userRepository } from './UserRepository.js';
import { IPaginationOptions, IPaginatedResult } from '../../../domain/repositories/IBaseRepository.js';

// Chat Repository
export class ChatRepository extends BaseRepository<
  IChat,
  IChatDocument,
  Partial<IChat>,
  Partial<IChat>
> {
  constructor() {
    super(ChatModel);
  }

  async createDirectChat(data: ICreateDirectChatDTO): Promise<IChat> {
    const existingChat = await ChatModel.findDirectChat(data.userId1, data.userId2);
    if (existingChat) {
      return existingChat.toObject() as IChat;
    }

    const chat = new this.model({
      type: 'direct',
      participants: [
        { userId: data.userId1, joinedAt: new Date() },
        { userId: data.userId2, joinedAt: new Date() },
      ],
    });
    const saved = await chat.save();
    return saved.toObject() as IChat;
  }

  async createGroupChat(data: ICreateGroupChatDTO): Promise<IChat> {
    const chat = new this.model({
      type: 'event_group',
      eventId: data.eventId,
      name: data.name,
      imageUrl: data.imageUrl,
      participants: data.participantIds.map((userId) => ({
        userId,
        joinedAt: new Date(),
      })),
    });
    const saved = await chat.save();
    return saved.toObject() as IChat;
  }

  async findDirectChat(userId1: string, userId2: string): Promise<IChat | null> {
    const chat = await ChatModel.findDirectChat(userId1, userId2);
    return chat ? (chat.toObject() as IChat) : null;
  }

  async findEventChat(eventId: string): Promise<IChat | null> {
    const chat = await ChatModel.findEventChat(eventId);
    return chat ? (chat.toObject() as IChat) : null;
  }

  async findUserChats(userId: string): Promise<IChatSummary[]> {
    const chats = await ChatModel.findUserChats(userId)
      .populate('participants.userId', 'fullName displayName avatarUrl gender kyc.status stats.averageRating isOnline')
      .lean();
    return Promise.all(chats.map((chat: any) => this.toChatSummary(chat, userId)));
  }

  async findUserChatsPaginated(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IChatSummary>> {
    const result = await this.findPaginated(
      {
        'participants.userId': new Types.ObjectId(userId),
        isActive: true,
      },
      options,
      {
        populate: {
          path: 'participants.userId',
          select: 'fullName displayName avatarUrl gender kyc.status stats.averageRating isOnline',
        },
      }
    );

    return {
      ...result,
      data: await Promise.all(result.data.map((chat) => this.toChatSummary(chat, userId))),
    };
  }

  async addParticipant(chatId: string, userId: string, session?: ClientSession): Promise<IChat | null> {
    const chat = await this.model.findById(chatId);
    if (!chat) return null;

    chat.addParticipant(userId);
    if (session) {
      await chat.save({ session });
    } else {
      await chat.save();
    }
    return chat.toObject() as IChat;
  }

  async removeParticipant(chatId: string, userId: string): Promise<IChat | null> {
    const chat = await this.model.findById(chatId);
    if (!chat) return null;

    chat.removeParticipant(userId);
    await chat.save();
    return chat.toObject() as IChat;
  }

  async updateLastMessage(chatId: string, message: IMessage): Promise<IChat | null> {
    const chat = await this.model.findById(chatId);
    if (!chat) return null;

    chat.updateLastMessage(message);
    await chat.save();
    return chat.toObject() as IChat;
  }

  async updateLastReadAt(chatId: string, userId: string): Promise<void> {
    await this.model.findOneAndUpdate(
      { _id: chatId, 'participants.userId': userId },
      { $set: { 'participants.$.lastReadAt': new Date() } }
    );
  }

  async muteChat(
    chatId: string,
    userId: string,
    mutedUntil?: Date
  ): Promise<void> {
    await this.model.findOneAndUpdate(
      { _id: chatId, 'participants.userId': userId },
      {
        $set: {
          'participants.$.isMuted': true,
          'participants.$.mutedUntil': mutedUntil,
        },
      }
    );
  }

  async unmuteChat(chatId: string, userId: string): Promise<void> {
    await this.model.findOneAndUpdate(
      { _id: chatId, 'participants.userId': userId },
      {
        $set: {
          'participants.$.isMuted': false,
          'participants.$.mutedUntil': null,
        },
      }
    );
  }

  async isParticipant(chatId: string, userId: string): Promise<boolean> {
    const chat = await this.model.findOne({
      _id: chatId,
      'participants.userId': new Types.ObjectId(userId),
      isActive: true,
    });
    return chat !== null;
  }

  async getUnreadCount(chatId: string, userId: string): Promise<number> {
    const chat = await this.model.findOne({
      _id: chatId,
      'participants.userId': new Types.ObjectId(userId),
    });

    if (!chat) return 0;

    const participant = chat.participants.find(
      (p) => p.userId.toString() === userId
    );
    if (!participant?.lastReadAt) return chat.messageCount;

    // Count messages after lastReadAt
    return MessageModel.countDocuments({
      chatId: new Types.ObjectId(chatId),
      createdAt: { $gt: participant.lastReadAt },
      senderId: { $ne: new Types.ObjectId(userId) },
    });
  }

  private async toChatSummary(chat: IChat, currentUserId: string): Promise<IChatSummary> {
    // Helper to get userId string from participant (handles both ObjectId and populated user)
    const getUserIdString = (participant: any): string => {
      if (!participant?.userId) return '';
      
      // If userId is populated (it's a user document object)
      if (typeof participant.userId === 'object' && participant.userId !== null) {
        // Check if it has _id property (populated user document)
        if (participant.userId._id) {
          return participant.userId._id.toString();
        }
        // If it's an ObjectId, convert to string
        if (participant.userId.toString && typeof participant.userId.toString === 'function') {
          return participant.userId.toString();
        }
      }
      
      // If it's already a string
      if (typeof participant.userId === 'string') {
        return participant.userId;
      }
      
      return '';
    };

    // Normalize currentUserId to ensure consistent comparison
    const normalizedCurrentUserId = currentUserId.toString();

    const otherParticipant = chat.type === 'direct'
      ? chat.participants.find((p) => {
          const participantUserId = getUserIdString(p);
          return participantUserId && participantUserId !== normalizedCurrentUserId;
        })
      : undefined;

    const currentParticipant = chat.participants.find(
      (p) => {
        const participantUserId = getUserIdString(p);
        return participantUserId === normalizedCurrentUserId;
      }
    );
    
    // Debug logs
    console.log('currentUserId:', normalizedCurrentUserId);
    console.log('participants:', chat.participants.map(p => ({
      userId: p.userId,
      userIdString: getUserIdString(p),
      isCurrentUser: getUserIdString(p) === normalizedCurrentUserId
    })));
    console.log('currentParticipant:', currentParticipant ? getUserIdString(currentParticipant) : 'undefined');
    console.log('otherParticipant:', otherParticipant ? getUserIdString(otherParticipant) : 'undefined');
    // Handle populated user data or fetch if missing
    let otherUser = otherParticipant?.user;
    if (!otherUser && otherParticipant) {
      // Check if userId is populated (Mongoose replaces ObjectId with populated document)
      const otherParticipantUserId = getUserIdString(otherParticipant);
      
      // Safety check: ensure we're not using the current user's data
      if (otherParticipantUserId === normalizedCurrentUserId) {
        console.error('ERROR: otherParticipant userId matches currentUserId!', {
          otherParticipantUserId,
          normalizedCurrentUserId,
          participants: chat.participants.map(p => ({
            userId: getUserIdString(p),
            isCurrent: getUserIdString(p) === normalizedCurrentUserId
          }))
        });
        // Skip and use fallback
        otherUser = undefined;
      } else {
        const populatedUser = typeof otherParticipant.userId === 'object' && 
                              otherParticipant.userId && 
                              'fullName' in otherParticipant.userId
          ? otherParticipant.userId as any
          : null;

        if (populatedUser) {
          // Double-check the populated user is not the current user
          const populatedUserId = populatedUser._id?.toString() || otherParticipantUserId;
          if (populatedUserId === normalizedCurrentUserId) {
            console.error('ERROR: Populated user matches current user!', {
              populatedUserId,
              normalizedCurrentUserId
            });
            otherUser = undefined;
          } else {
            // Use populated user data
            otherUser = {
              _id: populatedUserId,
              fullName: populatedUser.fullName,
              displayName: populatedUser.displayName,
              avatarUrl: populatedUser.avatarUrl,
              gender: populatedUser.gender,
              isOnline: populatedUser.isOnline,
              kycVerified: populatedUser.kyc?.status === 'approved',
              averageRating: populatedUser.stats?.averageRating || 0,
            };
          }
        } else {
          // Fetch user if not populated
          const user = await userRepository.findById(otherParticipantUserId);
          if (user) {
            // Final safety check
            if (user._id === normalizedCurrentUserId) {
              console.error('ERROR: Fetched user matches current user!', {
                userId: user._id,
                normalizedCurrentUserId
              });
              otherUser = undefined;
            } else {
              otherUser = {
                _id: user._id,
                fullName: user.fullName,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                gender: user.gender,
                isOnline: user.isOnline,
                kycVerified: user.kyc.status === 'approved',
                averageRating: user.stats.averageRating,
              };
            }
          }
        }
      }
    }
    
    // Final validation: if otherUser is still the current user, don't use it
    if (otherUser && otherUser._id === normalizedCurrentUserId) {
      console.error('ERROR: otherUser._id matches currentUserId, setting to undefined');
      otherUser = undefined;
    }

    return {
      _id: chat._id,
      type: chat.type,
      name: chat.name || otherUser?.fullName || 'Unknown',
      imageUrl: chat.imageUrl || otherUser?.avatarUrl,
      otherParticipant: otherUser,
      lastMessage: chat.lastMessage
        ? {
            content: chat.lastMessage.content,
            type: chat.lastMessage.type,
            senderName: chat.lastMessage.senderName,
            createdAt: chat.lastMessage.createdAt,
          }
        : undefined,
      unreadCount: 0, // Will be calculated separately
      isMuted: currentParticipant?.isMuted || false,
      updatedAt: chat.updatedAt,
    };
  }
}

// Message Repository
export class MessageRepository extends BaseRepository<
  IMessage,
  IMessageDocument,
  ISendMessageDTO,
  Partial<IMessage>
> {
  constructor() {
    super(MessageModel);
  }

  async create(data: ISendMessageDTO): Promise<IMessage> {
    const message = new this.model({
      chatId: data.chatId,
      senderId: data.senderId,
      senderName: data.senderName, // Will be populated by service
      senderAvatar: data.senderAvatar, // Will be populated by service
      type: data.type,
      content: data.content,
      imageUrl: data.imageUrl,
      eventId: data.eventId,
      replyTo: data.replyToMessageId
        ? { messageId: data.replyToMessageId }
        : undefined,
    });
    const saved = await message.save();
    return saved.toObject() as IMessage;
  }

  async findByChat(
    chatId: string,
    options: IMessageQuery
  ): Promise<IMessage[]> {
    const messages = await MessageModel.findByChatId(chatId, {
      before: options.beforeDate,
      limit: options.limit,
    });
    return messages.map((m) => m.toObject() as IMessage);
  }

  async findByChatPaginated(
    chatId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IMessage>> {
    return this.findPaginated(
      {
        chatId: new Types.ObjectId(chatId),
        isDeleted: false,
      },
      { ...options, sort: { createdAt: -1 } }
    );
  }

  async markAsRead(messageId: string, userId: string): Promise<void> {
    await this.model.findByIdAndUpdate(messageId, {
      $addToSet: {
        readBy: { userId: new Types.ObjectId(userId), readAt: new Date() },
      },
    });
  }

  async markManyAsRead(chatId: string, userId: string): Promise<void> {
    await this.model.updateMany(
      {
        chatId: new Types.ObjectId(chatId),
        senderId: { $ne: new Types.ObjectId(userId) },
        'readBy.userId': { $ne: new Types.ObjectId(userId) },
      },
      {
        $addToSet: {
          readBy: { userId: new Types.ObjectId(userId), readAt: new Date() },
        },
      }
    );
  }

  async softDelete(messageId: string): Promise<IMessage | null> {
    const message = await this.model.findByIdAndUpdate(
      messageId,
      {
        $set: { isDeleted: true, deletedAt: new Date() },
      },
      { new: true }
    );
    return message ? (message.toObject() as IMessage) : null;
  }

  async getUnreadCountForUser(userId: string): Promise<Map<string, number>> {
    const result = await this.model.aggregate([
      {
        $match: {
          senderId: { $ne: new Types.ObjectId(userId) },
          'readBy.userId': { $ne: new Types.ObjectId(userId) },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$chatId',
          count: { $sum: 1 },
        },
      },
    ]);

    const map = new Map<string, number>();
    result.forEach((r: { _id: Types.ObjectId; count: number }) => {
      map.set(r._id.toString(), r.count);
    });
    return map;
  }
}

// Export singleton instances
export const chatRepository = new ChatRepository();
export const messageRepository = new MessageRepository();

