import { Types } from 'mongoose';
import { BaseRepository } from './BaseRepository.js';
import {
  FriendshipModel,
  IFriendshipDocument,
  NotificationModel,
  INotificationDocument,
  ReportModel,
  IReportDocument,
  RatingModel,
  IRatingDocument,
  InviteModel,
  IInviteDocument,
} from '../models/Social.model.js';
import {
  IFriendship,
  INotification,
  IReport,
  IRating,
  IInvite,
  ISendFriendRequestDTO,
  ICreateNotificationDTO,
  ICreateReportDTO,
  ICreateRatingDTO,
} from '../../../domain/entities/Social.js';
import { IPaginationOptions, IPaginatedResult } from '../../../domain/repositories/IBaseRepository.js';
import { FriendRequestStatus } from '../../../shared/constants/index.js';

// Friendship Repository
export class FriendshipRepository extends BaseRepository<
  IFriendship,
  IFriendshipDocument,
  ISendFriendRequestDTO,
  Partial<IFriendship>
> {
  constructor() {
    super(FriendshipModel);
  }

  async create(data: ISendFriendRequestDTO): Promise<IFriendship> {
    const friendship = new this.model({
      user1Id: data.fromUserId,
      user2Id: data.toUserId,
      requestedBy: data.fromUserId,
      eventId: data.eventId,
      status: 'pending',
    });
    const saved = await friendship.save();
    return saved.toObject() as IFriendship;
  }

  async findFriendship(userId1: string, userId2: string): Promise<IFriendship | null> {
    const friendship = await FriendshipModel.findFriendship(userId1, userId2);
    return friendship ? (friendship.toObject() as IFriendship) : null;
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    return FriendshipModel.areFriends(userId1, userId2);
  }

  async getUserFriends(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IFriendship>> {
    const id = new Types.ObjectId(userId);
    return this.findPaginated(
      {
        $or: [{ user1Id: id }, { user2Id: id }],
        status: 'accepted',
      },
      options
    );
  }

  async getPendingRequests(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IFriendship>> {
    const id = new Types.ObjectId(userId);
    return this.findPaginated(
      {
        $or: [{ user1Id: id }, { user2Id: id }],
        requestedBy: { $ne: id },
        status: 'pending',
      },
      options
    );
  }

  async getSentRequests(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IFriendship>> {
    return this.findPaginated(
      {
        requestedBy: new Types.ObjectId(userId),
        status: 'pending',
      },
      options
    );
  }

  async updateStatus(
    id: string,
    status: FriendRequestStatus,
    blockedBy?: string
  ): Promise<IFriendship | null> {
    const updateData: Record<string, unknown> = { status };
    
    if (status === 'accepted') updateData.acceptedAt = new Date();
    if (status === 'rejected') updateData.rejectedAt = new Date();
    if (status === 'blocked') {
      updateData.blockedAt = new Date();
      if (blockedBy) updateData.blockedBy = new Types.ObjectId(blockedBy);
    }

    const friendship = await this.model.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    return friendship ? (friendship.toObject() as IFriendship) : null;
  }

  async getMutualFriends(userId1: string, userId2: string): Promise<string[]> {
    const id1 = new Types.ObjectId(userId1);
    const id2 = new Types.ObjectId(userId2);

    const [friends1, friends2] = await Promise.all([
      this.model.find({
        $or: [{ user1Id: id1 }, { user2Id: id1 }],
        status: 'accepted',
      }),
      this.model.find({
        $or: [{ user1Id: id2 }, { user2Id: id2 }],
        status: 'accepted',
      }),
    ]);

    const getFriendId = (friendship: IFriendship, userId: string): string => {
      return friendship.user1Id.toString() === userId
        ? friendship.user2Id.toString()
        : friendship.user1Id.toString();
    };

    const friendIds1 = new Set(friends1.map((f) => getFriendId(f.toObject(), userId1)));
    const friendIds2 = new Set(friends2.map((f) => getFriendId(f.toObject(), userId2)));

    return Array.from(friendIds1).filter((id) => friendIds2.has(id));
  }

  async getFriendsCount(userId: string): Promise<number> {
    const id = new Types.ObjectId(userId);
    return this.count({
      $or: [{ user1Id: id }, { user2Id: id }],
      status: 'accepted',
    });
  }
}

// Notification Repository
export class NotificationRepository extends BaseRepository<
  INotification,
  INotificationDocument,
  ICreateNotificationDTO,
  Partial<INotification>
> {
  constructor() {
    super(NotificationModel);
  }

  async findByUser(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<INotification>> {
    return this.findPaginated({ userId: new Types.ObjectId(userId) }, options);
  }

  async findUnreadByUser(userId: string): Promise<INotification[]> {
    return this.findMany({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.count({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  async markAsRead(id: string): Promise<INotification | null> {
    const notification = await this.model.findByIdAndUpdate(
      id,
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );
    return notification ? (notification.toObject() as INotification) : null;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.model.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    return result.modifiedCount;
  }

  async markAsPushed(id: string): Promise<void> {
    await this.model.findByIdAndUpdate(id, {
      $set: { isPushed: true, pushedAt: new Date() },
    });
  }

  async findUnpushed(limit = 100): Promise<INotification[]> {
    const notifications = await this.model
      .find({ isPushed: false })
      .sort({ createdAt: 1 })
      .limit(limit);
    return notifications.map((n) => n.toObject() as INotification);
  }

  async createMany(notifications: ICreateNotificationDTO[]): Promise<INotification[]> {
    const created = await this.model.insertMany(notifications);
    return created.map((n) => n.toObject() as INotification);
  }
}

// Report Repository
export class ReportRepository extends BaseRepository<
  IReport,
  IReportDocument,
  ICreateReportDTO,
  Partial<IReport>
> {
  constructor() {
    super(ReportModel);
  }

  async findByTarget(
    targetType: string,
    targetId: string
  ): Promise<IReport[]> {
    return this.findMany({
      targetType,
      targetId: new Types.ObjectId(targetId),
    });
  }

  async findPending(options: IPaginationOptions): Promise<IPaginatedResult<IReport>> {
    return this.findPaginated({ status: 'pending' }, options);
  }

  async updateStatus(
    id: string,
    status: IReport['status'],
    reviewedBy: string,
    reviewNotes?: string,
    resolution?: string
  ): Promise<IReport | null> {
    const report = await this.model.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          reviewedBy: new Types.ObjectId(reviewedBy),
          reviewNotes,
          resolution,
        },
      },
      { new: true }
    );
    return report ? (report.toObject() as IReport) : null;
  }

  async getReportCount(targetType: string, targetId: string): Promise<number> {
    return this.count({
      targetType,
      targetId: new Types.ObjectId(targetId),
    });
  }
}

// Rating Repository
export class RatingRepository extends BaseRepository<
  IRating,
  IRatingDocument,
  ICreateRatingDTO,
  Partial<IRating>
> {
  constructor() {
    super(RatingModel);
  }

  async findByUser(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IRating>> {
    return this.findPaginated({ toUserId: new Types.ObjectId(userId) }, options);
  }

  async findByEvent(eventId: string): Promise<IRating[]> {
    return this.findMany({ eventId: new Types.ObjectId(eventId) });
  }

  async findExisting(
    fromUserId: string,
    toUserId: string,
    eventId: string
  ): Promise<IRating | null> {
    return this.findOne({
      fromUserId: new Types.ObjectId(fromUserId),
      toUserId: new Types.ObjectId(toUserId),
      eventId: new Types.ObjectId(eventId),
    });
  }

  async getAverageRating(userId: string): Promise<{ average: number; count: number }> {
    const result = await this.model.aggregate([
      { $match: { toUserId: new Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          average: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);
    return result.length > 0
      ? { average: result[0].average, count: result[0].count }
      : { average: 0, count: 0 };
  }
}

// Invite Repository
export class InviteRepository extends BaseRepository<
  IInvite,
  IInviteDocument,
  Partial<IInvite>,
  Partial<IInvite>
> {
  constructor() {
    super(InviteModel);
  }

  async findByRecipient(
    recipientId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IInvite>> {
    return this.findPaginated(
      {
        recipientId: new Types.ObjectId(recipientId),
        status: 'pending',
        expiresAt: { $gt: new Date() },
      },
      options
    );
  }

  async findBySender(
    senderId: string,
    eventId: string
  ): Promise<IInvite[]> {
    return this.findMany({
      senderId: new Types.ObjectId(senderId),
      eventId: new Types.ObjectId(eventId),
    });
  }

  async findExisting(
    senderId: string,
    recipientId: string,
    eventId: string
  ): Promise<IInvite | null> {
    return this.findOne({
      senderId: new Types.ObjectId(senderId),
      recipientId: new Types.ObjectId(recipientId),
      eventId: new Types.ObjectId(eventId),
    });
  }

  async updateStatus(
    id: string,
    status: IInvite['status']
  ): Promise<IInvite | null> {
    const invite = await this.model.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          respondedAt: new Date(),
        },
      },
      { new: true }
    );
    return invite ? (invite.toObject() as IInvite) : null;
  }

  async createBulk(invites: Partial<IInvite>[]): Promise<IInvite[]> {
    const created = await this.model.insertMany(invites);
    return created.map((i) => i.toObject() as IInvite);
  }
}

// Export singleton instances
export const friendshipRepository = new FriendshipRepository();
export const notificationRepository = new NotificationRepository();
export const reportRepository = new ReportRepository();
export const ratingRepository = new RatingRepository();
export const inviteRepository = new InviteRepository();

