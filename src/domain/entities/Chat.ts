import { MessageType } from '../../shared/constants/index.js';
import { IUserSummary } from './User.js';

export interface IChatParticipant {
  userId: string;
  user: IUserSummary;
  joinedAt: Date;
  lastReadAt?: Date;
  isMuted: boolean;
  mutedUntil?: Date;
}

export interface IChat {
  _id: string;
  type: 'direct' | 'event_group';
  name?: string; // For group chats
  imageUrl?: string; // For group chats
  eventId?: string; // For event group chats
  participants: IChatParticipant[];
  lastMessage?: {
    _id: string;
    senderId: string;
    senderName: string;
    content: string;
    type: MessageType;
    createdAt: Date;
  };
  messageCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage {
  _id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  type: MessageType;
  content: string;
  imageUrl?: string;
  eventId?: string; // For event share messages
  replyTo?: {
    messageId: string;
    content: string;
    senderName: string;
  };
  readBy: {
    userId: string;
    readAt: Date;
  }[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChatSummary {
  _id: string;
  type: 'direct' | 'event_group';
  name: string;
  imageUrl?: string;
  otherParticipant?: IUserSummary; // For direct chats
  lastMessage?: {
    content: string;
    type: MessageType;
    senderName: string;
    createdAt: Date;
  };
  unreadCount: number;
  isMuted: boolean;
  updatedAt: Date;
}

// DTOs
export interface ICreateDirectChatDTO {
  userId1: string;
  userId2: string;
}

export interface ICreateGroupChatDTO {
  eventId: string;
  name: string;
  imageUrl?: string;
  participantIds: string[];
}

export interface ISendMessageDTO {
  chatId: string;
  senderId: string;
  type: MessageType;
  content: string;
  imageUrl?: string;
  eventId?: string;
  replyToMessageId?: string;
}

export interface IMessageQuery {
  chatId: string;
  beforeDate?: Date;
  afterDate?: Date;
  limit?: number;
}

