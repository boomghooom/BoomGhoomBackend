import { config } from '../../config/index.js';
import {
  friendshipRepository,
  notificationRepository,
  ratingRepository,
  reportRepository,
  blockRepository,
} from '../../infrastructure/database/repositories/index.js';
import { userRepository } from '../../infrastructure/database/repositories/UserRepository.js';
import { eventRepository } from '../../infrastructure/database/repositories/EventRepository.js';
import { redisClient } from '../../config/redis.js';
import {
  IFriendship,
  IFriendSummary,
  IFriendRequest,
  INotification,
  IRating,
  IReport,
  ISendFriendRequestDTO,
  ICreateRatingDTO,
  ICreateReportDTO,
} from '../../domain/entities/Social.js';
import { IUserSummary } from '../../domain/entities/User.js';
import { IPaginationOptions, IPaginatedResult } from '../../domain/repositories/IBaseRepository.js';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from '../../shared/errors/AppError.js';
import { CacheKeys } from '../../shared/constants/index.js';
import { logger } from '../../shared/utils/logger.js';

export class SocialService {
  // Friend Management
  async sendFriendRequest(data: ISendFriendRequestDTO): Promise<IFriendship> {
    console.log('data',data)
    
    // Normalize IDs to strings for comparison
    const fromUserIdStr = data.fromUserId?.toString() || String(data.fromUserId);
    const toUserIdStr = data.toUserId?.toString() || String(data.toUserId);
    
    if (fromUserIdStr === toUserIdStr) {
      throw new BadRequestError('Cannot send friend request to yourself');
    }

    // Check if either user has blocked the other (NEW)
    const isBlocked = await blockRepository.isBlocked(fromUserIdStr, toUserIdStr);
    if (isBlocked) {
      throw new ForbiddenError('Cannot send friend request', 'BLOCKED');
    }

    // Check if both users exist (using normalized string IDs)
    const [fromUser, toUser] = await Promise.all([
      userRepository.findById(fromUserIdStr),
      userRepository.findById(toUserIdStr),
    ]);

    if (!fromUser || !toUser) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Check if they were in the same event (optional validation - now optional)
    if (data.eventId) {
      const event = await eventRepository.findById(data.eventId);
      if (!event) {
        throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
      }

      // Use already normalized IDs for consistent comparison
      const bothInEvent =
        event.participants.some(
          (p) => {
            const participantUserIdStr = p.userId?.toString() || String(p.userId);
            return participantUserIdStr === fromUserIdStr && p.status === 'approved';
          }
        ) &&
        event.participants.some(
          (p) => {
            const participantUserIdStr = p.userId?.toString() || String(p.userId);
            return participantUserIdStr === toUserIdStr && p.status === 'approved';
          }
        );

      console.log('bothInEvent', bothInEvent);
      console.log('fromUserIdStr', fromUserIdStr);
      console.log('toUserIdStr', toUserIdStr);
      console.log('participants', event.participants.map(p => ({
        userId: p.userId?.toString() || String(p.userId),
        status: p.status
      })));

      if (!bothInEvent) {
        throw new ForbiddenError('Both users must be participants of the event');
      }
    }

    // Check existing friendship (using normalized string IDs)
    const existing = await friendshipRepository.findFriendship(fromUserIdStr, toUserIdStr);
    if (existing) {
      if (existing.status === 'accepted') {
        throw new ConflictError('Already friends', 'ALREADY_FRIENDS');
      }
      if (existing.status === 'pending') {
        throw new ConflictError('Friend request already pending', 'REQUEST_PENDING');
      }
      if (existing.status === 'blocked') {
        throw new ForbiddenError('Cannot send request', 'BLOCKED');
      }
    }

    // Create friendship with normalized IDs
    const friendship = await friendshipRepository.create({
      ...data,
      fromUserId: fromUserIdStr,
      toUserId: toUserIdStr,
    });

    // Send notification
    await notificationRepository.create({
      userId: toUserIdStr,
      type: 'friend_request',
      title: 'New Friend Request',
      body: `${fromUser.fullName} wants to be your friend`,
      data: { userId: fromUserIdStr, friendshipId: friendship._id },
    });

    return friendship;
  }

  async acceptFriendRequest(friendshipId: string, userId: string): Promise<IFriendship> {
    const friendship = await friendshipRepository.findById(friendshipId);
    if (!friendship) {
      throw new NotFoundError('Friend request not found', 'NOT_FOUND');
    }

    // Verify user is the recipient
    const isRecipient =
      (friendship.user1Id.toString() === userId.toString() ||
        friendship.user2Id.toString() === userId.toString()) &&
      friendship.requestedBy.toString() !== userId.toString();

    if (!isRecipient) {
      throw new ForbiddenError('Not authorized', 'NOT_AUTHORIZED');
    }

    if (friendship.status !== 'pending') {
      throw new BadRequestError('Request already processed', 'ALREADY_PROCESSED');
    }

    const updated = await friendshipRepository.updateStatus(friendshipId, 'accepted');
    if (!updated) {
      throw new NotFoundError('Friend request not found', 'NOT_FOUND');
    }

    // Update friend counts for both users
    await Promise.all([
      this.updateFriendCount(friendship.user1Id.toString()),
      this.updateFriendCount(friendship.user2Id.toString()),
    ]);

    // Send notification to requester
    const accepter = await userRepository.findById(userId);
    await notificationRepository.create({
      userId: friendship.requestedBy.toString(),
      type: 'friend_accepted',
      title: 'Friend Request Accepted! 🎉',
      body: `${accepter?.fullName || 'Someone'} accepted your friend request`,
      data: { userId, friendshipId },
    });

    return updated;
  }

  async rejectFriendRequest(friendshipId: string, userId: string): Promise<IFriendship> {
    const friendship = await friendshipRepository.findById(friendshipId);
    if (!friendship) {
      throw new NotFoundError('Friend request not found', 'NOT_FOUND');
    }

    const isRecipient =
      (friendship.user1Id.toString() === userId ||
        friendship.user2Id.toString() === userId) &&
      friendship.requestedBy.toString() !== userId;

    if (!isRecipient) {
      throw new ForbiddenError('Not authorized', 'NOT_AUTHORIZED');
    }

    if (friendship.status !== 'pending') {
      throw new BadRequestError('Request already processed', 'ALREADY_PROCESSED');
    }

    const updated = await friendshipRepository.updateStatus(friendshipId, 'rejected');
    if (!updated) {
      throw new NotFoundError('Friend request not found', 'NOT_FOUND');
    }

    return updated;
  }

  async blockUser(friendshipId: string, userId: string): Promise<IFriendship> {
    const friendship = await friendshipRepository.findById(friendshipId);
    if (!friendship) {
      throw new NotFoundError('Friendship not found', 'NOT_FOUND');
    }

    const isParticipant =
      friendship.user1Id.toString() === userId ||
      friendship.user2Id.toString() === userId;

    if (!isParticipant) {
      throw new ForbiddenError('Not authorized', 'NOT_AUTHORIZED');
    }

    const updated = await friendshipRepository.updateStatus(friendshipId, 'blocked', userId);
    if (!updated) {
      throw new NotFoundError('Friendship not found', 'NOT_FOUND');
    }

    // Update friend counts
    if (friendship.status === 'accepted') {
      await Promise.all([
        this.updateFriendCount(friendship.user1Id.toString()),
        this.updateFriendCount(friendship.user2Id.toString()),
      ]);
    }

    return updated;
  }

  async removeFriend(friendshipId: string, userId: string): Promise<void> {
    const friendship = await friendshipRepository.findById(friendshipId);
    if (!friendship) {
      throw new NotFoundError('Friendship not found', 'NOT_FOUND');
    }

    const isParticipant =
      friendship.user1Id.toString() === userId ||
      friendship.user2Id.toString() === userId;

    if (!isParticipant) {
      throw new ForbiddenError('Not authorized', 'NOT_AUTHORIZED');
    }

    await friendshipRepository.deleteById(friendshipId);

    // Update friend counts
    if (friendship.status === 'accepted') {
      await Promise.all([
        this.updateFriendCount(friendship.user1Id.toString()),
        this.updateFriendCount(friendship.user2Id.toString()),
      ]);
    }
  }

  async getFriends(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IFriendSummary>> {
    const result = await friendshipRepository.getUserFriends(userId, options);

    const friends: IFriendSummary[] = await Promise.all(
      result.data.map(async (friendship) => {
        const friendId =
          friendship.user1Id.toString() === userId.toString()
            ? friendship.user2Id.toString()
            : friendship.user1Id.toString();

        const friend = await userRepository.findById(friendId);
        const mutualCount = await friendshipRepository.getMutualFriends(userId, friendId);
        const mutualEventsCount = await eventRepository.getMutualEventsCount(userId, friendId);

        return {
          _id: friendId,
          friendshipId: friendship._id,
          user: friend
            ? {
                _id: friend._id,
                fullName: friend.fullName,
                displayName: friend.displayName,
                avatarUrl: friend.avatarUrl,
                gender: friend.gender,
                isOnline: friend.isOnline,
                kycVerified: friend.kyc.status === 'approved',
                averageRating: friend.stats.averageRating,
              }
            : ({} as IUserSummary),
          mutualFriendsCount: mutualCount.length,
          mutualEventsCount,
          connectedViaEvent: friendship.eventId
            ? { eventId: friendship.eventId.toString(), eventTitle: '' }
            : undefined,
          friendsSince: friendship.acceptedAt || friendship.createdAt,
        };
      })
    );

    return {
      ...result,
      data: friends,
    };
  }

  async getPendingRequests(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IFriendRequest>> {
    const result = await friendshipRepository.getPendingRequests(userId, options);

    const requests: IFriendRequest[] = await Promise.all(
      result.data.map(async (friendship) => {
        const fromUser = await userRepository.findById(friendship.requestedBy.toString());
        const toUser = await userRepository.findById(
          friendship.user1Id.toString() === friendship.requestedBy.toString()
            ? friendship.user2Id.toString()
            : friendship.user1Id.toString()
        );
        console.log('fromUser',fromUser)
        console.log('toUser',toUser)
        return {
          _id: friendship._id,
          fromUser: fromUser
            ? {
                _id: fromUser._id,
                fullName: fromUser.fullName,
                displayName: fromUser.displayName,
                avatarUrl: fromUser.avatarUrl,
                gender: fromUser.gender,
                isOnline: fromUser.isOnline,
                kycVerified: fromUser.kyc.status === 'approved',
                averageRating: fromUser.stats.averageRating,
              }
            : ({} as IUserSummary),
          toUser: toUser
            ? {
                _id: toUser._id,
                fullName: toUser.fullName,
                displayName: toUser.displayName,
                avatarUrl: toUser.avatarUrl,
                gender: toUser.gender,
                isOnline: toUser.isOnline,
                kycVerified: toUser.kyc.status === 'approved',
                averageRating: toUser.stats.averageRating,
              }
            : ({} as IUserSummary),
          status: friendship.status,
          eventId: friendship.eventId?.toString(),
          createdAt: friendship.createdAt,
        };
      })
    );

    return {
      ...result,
      data: requests,
    };
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    return friendshipRepository.areFriends(userId1, userId2);
  }

  // Notifications
  async getNotifications(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<INotification>> {
    return notificationRepository.findByUser(userId, options);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    return notificationRepository.getUnreadCount(userId);
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await notificationRepository.findById(notificationId);
    if (!notification) {
      throw new NotFoundError('Notification not found', 'NOT_FOUND');
    }

    if (notification.userId !== userId.toString()) {
      throw new ForbiddenError('Not authorized', 'NOT_AUTHORIZED');
    }

    await notificationRepository.markAsRead(notificationId);
  }

  async markAllNotificationsAsRead(userId: string): Promise<number> {
    return notificationRepository.markAllAsRead(userId);
  }

  // Ratings
  async rateUser(data: ICreateRatingDTO): Promise<IRating> {
    // Verify both users were in the same completed event
    const event = await eventRepository.findById(data.eventId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    if (event.status !== 'completed') {
      throw new BadRequestError('Can only rate after event completion', 'EVENT_NOT_COMPLETED');
    }

    const fromUserInEvent = event.participants.some(
      (p) => p.userId.toString() === data.fromUserId && p.status === 'approved'
    );
    const toUserInEvent =
      event.participants.some(
        (p) => p.userId.toString() === data.toUserId && p.status === 'approved'
      ) || event.admin.userId.toString() === data.toUserId;

    if (!fromUserInEvent || !toUserInEvent) {
      throw new ForbiddenError('Both users must be participants', 'NOT_PARTICIPANTS');
    }

    // Check for existing rating
    const existing = await ratingRepository.findExisting(
      data.fromUserId,
      data.toUserId,
      data.eventId
    );

    if (existing) {
      throw new ConflictError('Already rated this user for this event', 'ALREADY_RATED');
    }

    const rating = await ratingRepository.create(data);

    // Update user average rating
    const { average, count } = await ratingRepository.getAverageRating(data.toUserId);
    await userRepository.updateStats(data.toUserId, {
      averageRating: Math.round(average * 100) / 100,
      totalRatings: count,
    });

    // Invalidate cache
    await redisClient.del(CacheKeys.USER(data.toUserId));

    return rating;
  }

  async getUserRatings(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IRating>> {
    return ratingRepository.findByUser(userId, options);
  }

  // Reports
  async createReport(data: ICreateReportDTO): Promise<IReport> {
    // Validate target exists
    if (data.targetType === 'event') {
      const event = await eventRepository.findById(data.targetId);
      if (!event) throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    } else if (data.targetType === 'user') {
      const user = await userRepository.findById(data.targetId);
      if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const report = await reportRepository.create(data);

    // Update report count on event if applicable
    if (data.targetType === 'event') {
      await eventRepository.updateById(data.targetId, {
        reportCount:
          ((await eventRepository.findById(data.targetId))?.reportCount || 0) + 1,
      } as never);
    }

    logger.info('Report created', { reportId: report._id, targetType: data.targetType });

    return report;
  }

  private async updateFriendCount(userId: string): Promise<void> {
    const count = await friendshipRepository.getFriendsCount(userId);
    await userRepository.updateStats(userId, { friendsCount: count });
    await redisClient.del(CacheKeys.USER(userId));
  }

  // Get Blocked Users List
  async getBlockedUsers(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IFriendSummary>> {
    const result = await friendshipRepository.getBlockedUsers(userId, options);

    // Transform to FriendSummary format with blocked user details
    const blockedUsers: IFriendSummary[] = [];
    for (const friendship of result.data) {
      // Determine which user is blocked
      const blockedUserId =
        friendship.user1Id.toString() === userId
          ? friendship.user2Id.toString()
          : friendship.user1Id.toString();

      const blockedUser = await userRepository.findById(blockedUserId);
      if (blockedUser) {
        blockedUsers.push({
          _id: blockedUserId,
          friendshipId: friendship._id,
          user: {
            _id: blockedUser._id,
            fullName: blockedUser.fullName,
            displayName: blockedUser.displayName,
            avatarUrl: blockedUser.avatarUrl,
            gender: blockedUser.gender,
            isOnline: blockedUser.isOnline,
            kycVerified: blockedUser.kyc.status === 'approved',
            averageRating: blockedUser.stats.averageRating,
          },
          mutualFriendsCount: 0,
          mutualEventsCount: 0,
          friendsSince: friendship.blockedAt || friendship.createdAt,
        });
      }
    }

    return {
      data: blockedUsers,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    };
  }

  async isUserBlocked(userId: string, targetUserId: string): Promise<boolean> {
    return friendshipRepository.isUserBlocked(userId, targetUserId);
  }

  // NEW: Direct user blocking methods (using BlockRepository)
  async blockUserByUserId(blockerId: string, blockedUserId: string): Promise<void> {
    // Validate users exist
    const [blocker, blockedUser] = await Promise.all([
      userRepository.findById(blockerId),
      userRepository.findById(blockedUserId),
    ]);

    if (!blocker || !blockedUser) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    if (blockerId === blockedUserId) {
      throw new BadRequestError('Cannot block yourself', 'CANNOT_BLOCK_SELF');
    }

    // Create block relationship
    await blockRepository.blockUser(blockerId, blockedUserId);

    // Remove existing friendship if any
    const friendship = await friendshipRepository.findFriendship(blockerId, blockedUserId);
    if (friendship) {
      if (friendship.status === 'accepted') {
        // Update friend counts
        await Promise.all([
          this.updateFriendCount(blockerId),
          this.updateFriendCount(blockedUserId),
        ]);
      }
      // Delete the friendship
      await friendshipRepository.deleteById(friendship._id);
    }

    // Invalidate caches
    await Promise.all([
      redisClient.del(CacheKeys.USER(blockerId)),
      redisClient.del(CacheKeys.USER(blockedUserId)),
    ]);

    logger.info('User blocked', { blockerId, blockedUserId });
  }

  async unblockUser(blockerId: string, blockedUserId: string): Promise<void> {
    const unblocked = await blockRepository.unblockUser(blockerId, blockedUserId);
    
    if (!unblocked) {
      throw new NotFoundError('Block relationship not found', 'NOT_BLOCKED');
    }

    // Invalidate caches
    await Promise.all([
      redisClient.del(CacheKeys.USER(blockerId)),
      redisClient.del(CacheKeys.USER(blockedUserId)),
    ]);

    logger.info('User unblocked', { blockerId, blockedUserId });
  }

  async isUserBlockedBidirectional(userId1: string, userId2: string): Promise<boolean> {
    return blockRepository.isBlocked(userId1, userId2);
  }

  async getBlockedUsersList(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IFriendSummary>> {
    const result = await blockRepository.getBlockedUsers(userId, options);

    // Transform to FriendSummary format
    const blockedUsers: IFriendSummary[] = [];
    for (const block of result.data) {
      const blockedUser = await userRepository.findById(block.blockedUserId);
      if (blockedUser) {
        blockedUsers.push({
          _id: block.blockedUserId,
          friendshipId: block._id, // Using block ID for unblock operation
          user: {
            _id: blockedUser._id,
            fullName: blockedUser.fullName,
            displayName: blockedUser.displayName,
            avatarUrl: blockedUser.avatarUrl,
            gender: blockedUser.gender,
            isOnline: blockedUser.isOnline,
            kycVerified: blockedUser.kyc.status === 'approved',
            averageRating: blockedUser.stats.averageRating,
          },
          mutualFriendsCount: 0,
          mutualEventsCount: 0,
          friendsSince: block.createdAt,
        });
      }
    }

    return {
      data: blockedUsers,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    };
  }
}

export const socialService = new SocialService();

