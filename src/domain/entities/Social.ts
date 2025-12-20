import { FriendRequestStatus, NotificationType } from '../../shared/constants/index.js';
import { IUserSummary } from './User.js';

export interface IFriendship {
  _id: string;
  user1Id: string;
  user2Id: string;
  status: FriendRequestStatus;
  requestedBy: string;
  eventId?: string; // Event where they connected
  acceptedAt?: Date;
  rejectedAt?: Date;
  blockedAt?: Date;
  blockedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFriendRequest {
  _id: string;
  fromUser: IUserSummary;
  toUser: IUserSummary;
  status: FriendRequestStatus;
  eventId?: string;
  eventTitle?: string;
  message?: string;
  createdAt: Date;
}

export interface IFriendSummary {
  _id: string;
  friendshipId: string;
  user: IUserSummary;
  mutualFriendsCount: number;
  mutualEventsCount: number;
  connectedViaEvent?: {
    eventId: string;
    eventTitle: string;
  };
  friendsSince: Date;
}

export interface INotification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  imageUrl?: string;
  data?: {
    eventId?: string;
    userId?: string;
    friendshipId?: string;
    chatId?: string;
    transactionId?: string;
  };
  actionUrl?: string;
  isRead: boolean;
  readAt?: Date;
  isPushed: boolean;
  pushedAt?: Date;
  createdAt: Date;
}

export interface IReport {
  _id: string;
  reporterId: string;
  targetType: 'event' | 'user' | 'message';
  targetId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  reviewNotes?: string;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRating {
  _id: string;
  fromUserId: string;
  toUserId: string;
  eventId: string;
  rating: number; // 1-5
  review?: string;
  isAnonymous: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInvite {
  _id: string;
  senderId: string;
  recipientId: string;
  eventId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  message?: string;
  expiresAt: Date;
  respondedAt?: Date;
  createdAt: Date;
}

// DTOs
export interface ISendFriendRequestDTO {
  fromUserId: string;
  toUserId: string;
  eventId?: string;
  message?: string;
}

export interface ICreateNotificationDTO {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
}

export interface ICreateReportDTO {
  reporterId: string;
  targetType: 'event' | 'user' | 'message';
  targetId: string;
  reason: string;
  description?: string;
}

export interface ICreateRatingDTO {
  fromUserId: string;
  toUserId: string;
  eventId: string;
  rating: number;
  review?: string;
  isAnonymous?: boolean;
}

export interface IBulkInviteDTO {
  senderId: string;
  eventId: string;
  recipientIds: string[];
  message?: string;
}

