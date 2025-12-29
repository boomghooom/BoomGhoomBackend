import mongoose from 'mongoose';
import { config } from '../../config/index.js';
import { eventRepository } from '../../infrastructure/database/repositories/EventRepository.js';
import { userRepository } from '../../infrastructure/database/repositories/UserRepository.js';
import {
  dueRepository,
  commissionRepository,
} from '../../infrastructure/database/repositories/FinanceRepository.js';
import { notificationRepository, inviteRepository } from '../../infrastructure/database/repositories/SocialRepository.js';
import { chatRepository } from '../../infrastructure/database/repositories/ChatRepository.js';
import { redisClient } from '../../config/redis.js';
import {
  IEvent,
  IEventSummary,
  ICreateEventDTO,
  ICreateEventWithPublishDTO,
  IUpdateEventDTO,
  IEventFilters,
  IEventParticipant,
} from '../../domain/entities/Event.js';
import { IUserSummary } from '../../domain/entities/User.js';
import { IPaginationOptions, IPaginatedResult } from '../../domain/repositories/IBaseRepository.js';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
  KYCRequiredError,
  DuesPendingError,
  EventFullError,
  EventNotEligibleError,
  LeaveWindowExpiredError,
} from '../../shared/errors/AppError.js';
import {
  CacheKeys,
  CacheTTL,
  EventStatus,
  ParticipationStatus,
  DistanceUnits,
} from '../../shared/constants/index.js';
import { logWithContext, logger } from '../../shared/utils/logger.js';

export class EventService {
  async createEvent(data: ICreateEventDTO): Promise<IEvent> {
    // Check if user can create events (KYC verified)
    const admin = await userRepository.findById(data.adminId);
    if (!admin) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    if (data.type === 'user_created' && admin.kyc.status !== 'approved') {
      throw new KYCRequiredError('KYC verification required to create events');
    }
    console.log("data", data);

    // Create event - transform adminId to admin object for the model
    const { adminId, ...eventData } = data;
    console.log("adminId", adminId);
    console.log("eventData", eventData);
    const createData = {
      ...eventData,
      admin: { userId: adminId },
      status: 'draft' as const,
      participantCount: 0,
      waitlistCount: 0,
    };
    console.log("createData being sent to repository:", JSON.stringify(createData, null, 2));
    const event = await eventRepository.create(createData as unknown as ICreateEventDTO);

    // Update user stats
    await userRepository.updateStats(data.adminId, {
      eventsCreated: (admin.stats.eventsCreated || 0) + 1,
    });

    // Create event group chat
    await chatRepository.createGroupChat({
      eventId: event._id,
      name: event.title,
      imageUrl: event.coverImageUrl,
      participantIds: [data.adminId],
    });

    logWithContext.event('Event created', { eventId: event._id, adminId: data.adminId });

    return event;
  }

  // event create with publish
  async createEventWithPublish(data: ICreateEventWithPublishDTO): Promise<IEvent> {
       // Check if user can create events (KYC verified)
    const admin = await userRepository.findById(data.adminId);
    if (!admin) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    if (data.type === 'user_created' && admin.kyc.status !== 'approved') {
      throw new KYCRequiredError('KYC verification required to create events');
    }
    console.log("data", data);

    // Create event - transform adminId to admin object for the model
    const { adminId, ...eventData } = data;
    console.log("adminId", adminId);
    console.log("eventData", eventData);
    const createData = {
      ...eventData,
      admin: { userId: adminId },
      status: 'upcoming' as const,
      isPublished: true,
      publishedAt: new Date(),
      participantCount: 0,
      waitlistCount: 0,
    };
    console.log("createData being sent to repository:", JSON.stringify(createData, null, 2));
    const event = await eventRepository.create(createData as unknown as ICreateEventDTO);

    // Update user stats
    await userRepository.updateStats(data.adminId, {
      eventsCreated: (admin.stats.eventsCreated || 0) + 1,
    });

    // Create event group chat
    await chatRepository.createGroupChat({
      eventId: event._id,
      name: event.title,
      imageUrl: event.coverImageUrl,
      participantIds: [data.adminId],
    });

    logWithContext.event('Event created', { eventId: event._id, adminId: data.adminId });

    return event;
  }

  async publishEvent(eventId: string, userId: string): Promise<IEvent> {
    // Check if user can create events (KYC verified)
    const admin = await userRepository.findById(userId);
    if (!admin) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    if (admin.kyc.status !== 'approved') {
      throw new KYCRequiredError('KYC verification required to create events');
    }
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    if (event.admin.userId.toString() !== userId.toString()) {
      throw new ForbiddenError('Not authorized to publish this event', 'NOT_AUTHORIZED');
    }

    if (event.status !== 'draft') {
      throw new BadRequestError('Only draft events can be published', 'INVALID_STATUS');
    }

    const updatedEvent = await eventRepository.updateStatus(eventId, 'upcoming', {
      isPublished: true,
      publishedAt: new Date(),
    } as Partial<IEvent>);

    if (!updatedEvent) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    // Invalidate caches
    await this.invalidateEventCaches(eventId, event.location.city);

    logWithContext.event('Event published', { eventId });

    return updatedEvent;
  }

  async getEventById(eventId: string): Promise<IEvent> {
    // Try cache first
    const cached = await redisClient.get<IEvent>(CacheKeys.EVENT(eventId));
    if (cached) {
      return cached;
    }

    const event = await eventRepository.findByIdWithPopulate(eventId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    // Cache event
    await redisClient.set(CacheKeys.EVENT(eventId), event, CacheTTL.MEDIUM);

    // Increment view count (async, don't await)
    eventRepository.incrementViewCount(eventId).catch((err) => {
      logger.error('Error incrementing view count:', err);
    });

    return event;
  }

  async getEventByDeepLink(deepLinkId: string): Promise<IEvent> {
    const event = await eventRepository.findByDeepLink(deepLinkId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }
    return event;
  }

  async getNearbyEvents(
    coordinates: [number, number],
    filters?: IEventFilters,
    options: IPaginationOptions = { page: 1, limit: 20 }
  ): Promise<IPaginatedResult<IEventSummary>> {
    return eventRepository.findNearby(
      coordinates,
      filters?.sortBy === 'distance'
        ? DistanceUnits.MAX_SEARCH_RADIUS
        : DistanceUnits.DEFAULT_SEARCH_RADIUS,
      filters,
      options
    );
  }

  async getEventsByCity(
    city: string,
    filters?: IEventFilters,
    options: IPaginationOptions = { page: 1, limit: 20 }
  ): Promise<IPaginatedResult<IEventSummary>> {
    return eventRepository.findByCity(city, filters, options);
  }

  async getUpcomingEvents(city: string, limit = 10): Promise<IEventSummary[]> {
    return eventRepository.findUpcoming(city, limit);
  }

  async getFeaturedEvents(city: string, limit = 10): Promise<IEventSummary[]> {
    return eventRepository.findFeatured(city, limit);
  }

  async getUserEvents(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IEventSummary>> {
    return eventRepository.findByParticipant(userId, options);
  }

  async getAdminEvents(
    adminId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IEventSummary>> {
    return eventRepository.findByAdmin(adminId, options);
  }

  async updateEvent(
    eventId: string,
    userId: string,
    data: IUpdateEventDTO
  ): Promise<IEvent> {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    if (event.admin.userId.toString() !== userId) {
      throw new ForbiddenError('Not authorized to update this event', 'NOT_AUTHORIZED');
    }

    if (event.status === 'completed' || event.status === 'cancelled') {
      throw new BadRequestError('Cannot update completed or cancelled events', 'INVALID_STATUS');
    }

    const updatedEvent = await eventRepository.updateById(eventId, data);
    if (!updatedEvent) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    // Invalidate caches
    await this.invalidateEventCaches(eventId, event.location.city);

    // Notify participants about update
    if (event.status === 'upcoming' && event.participants.length > 0) {
      const notifications = event.participants
        .filter((p) => p.status === 'approved')
        .map((p) => ({
          userId: p.userId.toString(),
          type: 'event_update' as const,
          title: 'Event Updated',
          body: `${event.title} has been updated. Check the details!`,
          data: { eventId },
        }));

      if (notifications.length > 0) {
        await notificationRepository.createMany(notifications);
      }
    }

    return updatedEvent;
  }

  async cancelEvent(
    eventId: string,
    userId: string,
    reason: string
  ): Promise<IEvent> {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    if (event.admin.userId.toString() !== userId.toString()) {
      throw new ForbiddenError('Not authorized to cancel this event', 'NOT_AUTHORIZED');
    }

    if (event.status === 'completed' || event.status === 'cancelled') {
      throw new BadRequestError('Event already completed or cancelled', 'INVALID_STATUS');
    }

    const updatedEvent = await eventRepository.updateStatus(eventId, 'cancelled', {
      cancellationReason: reason,
    } as Partial<IEvent>);

    if (!updatedEvent) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    // Invalidate caches
    await this.invalidateEventCaches(eventId, event.location.city);

    // Notify all participants
    const notifications = event.participants
      .filter((p) => p.status === 'approved' || p.status === 'pending_approval')
      .map((p) => ({
        userId: p.userId.toString(),
        type: 'event_cancelled' as const,
        title: 'Event Cancelled',
        body: `${event.title} has been cancelled: ${reason}`,
        data: { eventId },
      }));

    if (notifications.length > 0) {
      await notificationRepository.createMany(notifications);
    }

    logWithContext.event('Event cancelled', { eventId, reason });

    return updatedEvent;
  }

  async requestToJoin(eventId: string, userId: string): Promise<IEvent> {
    const [event, user] = await Promise.all([
      eventRepository.findById(eventId),
      userRepository.findById(userId),
    ]);

    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Check if event is open for joining
    if (event.status !== 'upcoming') {
      throw new BadRequestError('Event is not open for joining', 'EVENT_NOT_OPEN');
    }

    // Check if user is already a participant
    const isParticipant = await eventRepository.isUserParticipant(eventId, userId);
    if (isParticipant) {
      throw new ConflictError('Already joined or pending approval', 'ALREADY_JOINED');
    }

    // Check if user is the admin
    if (event.admin.userId.toString() === userId) {
      throw new BadRequestError('Admin cannot join their own event', 'ADMIN_CANNOT_JOIN');
    }

    // Check eligibility
    const eligibility = this.checkUserEligibility(event, {
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      location: user.location,
    });

    if (!eligibility.eligible) {
      throw new EventNotEligibleError(eligibility.reason);
    }

    // Check if event is full
    if (event.participantCount >= event.eligibility.memberLimit) {
      throw new EventFullError();
    }

    // For paid events, check if user has pending dues from previous events
    if (!event.pricing?.isFree && user.finance.dues > 0) {
      throw new DuesPendingError();
    }

    // Create participant entry
    const participant: IEventParticipant = {
      userId,
      user: {
        _id: user._id,
        fullName: user.fullName,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        gender: user.gender,
        isOnline: user.isOnline,
        kycVerified: user.kyc.status === 'approved',
        averageRating: user.stats.averageRating,
      },
      status: event.eligibility.requiresApproval ? 'pending_approval' : 'approved',
      joinedAt: new Date(),
      hasPendingDues: false,
      duesCleared: false,
    };

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Add participant
      const updatedEvent = await eventRepository.addParticipant(eventId, participant, session);
      if (!updatedEvent) {
        throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
      }

      // If auto-approved for user-created event, add dues
      if (!event.eligibility.requiresApproval && event.type === 'user_created') {
        // Add due for this user
        await dueRepository.create({
          userId,
          eventId,
          eventTitle: event.title,
          amount: config.business.dueAmount,
          status: 'pending',
        });

        // Update user finance
        await userRepository.updateFinance(
          userId,
          { dues: user.finance.dues + config.business.dueAmount },
          session
        );

        // Update event dues stats
        await eventRepository.updateDuesStats(
          eventId,
          config.business.dueAmount,
          0,
          session
        );

        // Update user stats
        await userRepository.updateStats(userId, {
          eventsJoined: (user.stats.eventsJoined || 0) + 1,
        });
      }

      await session.commitTransaction();

      // Invalidate caches
      await this.invalidateEventCaches(eventId, event.location.city);
      await redisClient.del(CacheKeys.USER(userId));

      // Send notification to admin
      if (event.eligibility.requiresApproval) {
        await notificationRepository.create({
          userId: event.admin.userId.toString(),
          type: 'event_join_request',
          title: 'New Join Request',
          body: `${user.fullName} wants to join ${event.title}`,
          data: { eventId, userId },
        });
      }

      logWithContext.event('User requested to join', { eventId, userId });

      return updatedEvent;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async approveJoinRequest(
    eventId: string,
    adminId: string,
    userId: string
  ): Promise<IEvent> {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }
    if (event.admin.userId.toString() !== adminId.toString()) {
      throw new ForbiddenError('Not authorized', 'NOT_AUTHORIZED');
    }

    const participant = await eventRepository.getParticipant(eventId, userId);
    if (!participant) {
      throw new NotFoundError('Join request not found', 'REQUEST_NOT_FOUND');
    }

    if (participant.status !== 'pending_approval') {
      throw new BadRequestError('Request already processed', 'ALREADY_PROCESSED');
    }

    // Check if event is full
    if (event.participantCount >= event.eligibility.memberLimit) {
      throw new EventFullError();
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update participant status
      const updatedEvent = await eventRepository.updateParticipantStatus(
        eventId,
        userId,
        'approved'
      );

      if (!updatedEvent) {
        throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
      }

      // Add dues for user-created events
      if (event.type === 'user_created') {
        const user = await userRepository.findById(userId);
        if (user) {
          await dueRepository.create({
            userId,
            eventId,
            eventTitle: event.title,
            amount: config.business.dueAmount,
            status: 'pending',
          });

          await userRepository.updateFinance(
            userId,
            { dues: user.finance.dues + config.business.dueAmount },
            session
          );

          await eventRepository.updateDuesStats(
            eventId,
            config.business.dueAmount,
            0,
            session
          );

          await userRepository.updateStats(userId, {
            eventsJoined: (user.stats.eventsJoined || 0) + 1,
          });
        }
      }

      // Add user to event chat
      const chat = await chatRepository.findEventChat(eventId);
      if (chat) {
        await chatRepository.addParticipant(chat._id, userId);
      }

      await session.commitTransaction();

      // Invalidate caches
      await this.invalidateEventCaches(eventId, event.location.city);
      await redisClient.del(CacheKeys.USER(userId));

      // Notify user
      await notificationRepository.create({
        userId,
        type: 'event_join_approved',
        title: 'Request Approved! 🎉',
        body: `You've been approved to join ${event.title}`,
        data: { eventId },
      });

      logWithContext.event('Join request approved', { eventId, userId, adminId });

      return updatedEvent;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async rejectJoinRequest(
    eventId: string,
    adminId: string,
    userId: string,
    reason?: string
  ): Promise<IEvent> {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    if (event.admin.userId.toString() !== adminId.toString()) {
      throw new ForbiddenError('Not authorized', 'NOT_AUTHORIZED');
    }

    const participant = await eventRepository.getParticipant(eventId, userId);
    if (!participant) {
      throw new NotFoundError('Join request not found', 'REQUEST_NOT_FOUND');
    }

    // 'pending_approval',
    // 'approved',
    // 'rejected',
    // 'leave_requested',
    // 'left',
    // 'removed',
    if (participant.status !== 'rejected') {
      throw new BadRequestError('Request already processed', 'ALREADY_PROCESSED');
    }

    const updatedEvent = await eventRepository.updateParticipantStatus(
      eventId,
      userId,
      'rejected',
      { rejectionReason: reason }
    );

    if (!updatedEvent) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    // Notify user
    await notificationRepository.create({
      userId,
      type: 'event_join_rejected',
      title: 'Request Not Approved',
      body: reason
        ? `Your request to join ${event.title} was not approved: ${reason}`
        : `Your request to join ${event.title} was not approved`,
      data: { eventId },
    });

    logWithContext.event('Join request rejected', { eventId, userId, adminId, reason });

    return updatedEvent;
  }

  async requestToLeave(eventId: string, userId: string): Promise<IEvent> {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    const participant = await eventRepository.getParticipant(eventId, userId);
    if (!participant) {
      throw new NotFoundError('Not a participant', 'NOT_PARTICIPANT');
    }

    if (participant.status !== 'approved') {
      throw new BadRequestError('Invalid participant status', 'INVALID_STATUS');
    }

    // Check if within leave window
    const joinedAt = new Date(participant.joinedAt);
    const windowEnd = new Date(joinedAt.getTime() + config.business.leaveRequestWindowMinutes * 60 * 1000);

    if (new Date() > windowEnd) {
      throw new LeaveWindowExpiredError(
        `Leave window expired ${Math.floor((Date.now() - windowEnd.getTime()) / 60000)} minutes ago`
      );
    }

    const updatedEvent = await eventRepository.updateParticipantStatus(
      eventId,
      userId,
      'leave_requested'
    );

    if (!updatedEvent) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    // Notify admin
    const user = await userRepository.findById(userId);
    await notificationRepository.create({
      userId: event.admin.userId.toString(),
      type: 'event_update',
      title: 'Leave Request',
      body: `${user?.fullName || 'A participant'} has requested to leave ${event.title}`,
      data: { eventId, userId },
    });

    logWithContext.event('Leave request submitted', { eventId, userId });

    return updatedEvent;
  }

  async approveLeaveRequest(
    eventId: string,
    adminId: string,
    userId: string
  ): Promise<IEvent> {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    if (event.admin.userId.toString() !== adminId) {
      throw new ForbiddenError('Not authorized', 'NOT_AUTHORIZED');
    }

    const participant = await eventRepository.getParticipant(eventId, userId);
    if (!participant) {
      throw new NotFoundError('Participant not found', 'NOT_FOUND');
    }

    if (participant.status !== 'leave_requested') {
      throw new BadRequestError('No leave request pending', 'NO_REQUEST');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update participant status
      const updatedEvent = await eventRepository.updateParticipantStatus(
        eventId,
        userId,
        'left'
      );

      if (!updatedEvent) {
        throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
      }

      // Clear dues if any
      const due = await dueRepository.findByUserAndEvent(userId, eventId);
      if (due && due.status === 'pending') {
        await dueRepository.clearDue(due._id, 'commission', undefined, session);
        
        const user = await userRepository.findById(userId);
        if (user) {
          await userRepository.updateFinance(
            userId,
            { dues: Math.max(0, user.finance.dues - due.amount) },
            session
          );
        }

        // Update event dues stats
        await eventRepository.updateDuesStats(eventId, 0, -due.amount, session);
      }

      // Remove from chat
      const chat = await chatRepository.findEventChat(eventId);
      if (chat) {
        await chatRepository.removeParticipant(chat._id, userId);
      }

      // Update user stats
      const user = await userRepository.findById(userId);
      if (user) {
        await userRepository.updateStats(userId, {
          eventsJoined: Math.max(0, (user.stats.eventsJoined || 1) - 1),
        });
      }

      await session.commitTransaction();

      // Invalidate caches
      await this.invalidateEventCaches(eventId, event.location.city);
      await redisClient.del(CacheKeys.USER(userId));

      // Notify user
      await notificationRepository.create({
        userId,
        type: 'event_update',
        title: 'Leave Approved',
        body: `Your request to leave ${event.title} has been approved`,
        data: { eventId },
      });

      logWithContext.event('Leave request approved', { eventId, userId, adminId });

      return updatedEvent;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async completeEvent(eventId: string, adminId: string): Promise<IEvent> {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    if (event.admin.userId.toString() !== adminId) {
      throw new ForbiddenError('Not authorized', 'NOT_AUTHORIZED');
    }

    if (event.status !== 'ongoing' && event.status !== 'upcoming') {
      throw new BadRequestError('Event cannot be completed', 'INVALID_STATUS');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update event status
      const updatedEvent = await eventRepository.updateStatus(eventId, 'completed');
      if (!updatedEvent) {
        throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
      }

      // Create commission record for user-created events
      if (event.type === 'user_created') {
        const approvedParticipants = event.participants.filter(
          (p) => p.status === 'approved'
        );
        const participantsWithClearedDues = approvedParticipants.filter(
          (p) => p.duesCleared
        ).length;

        const adminShare = Math.floor(
          (event.totalDuesCleared * config.business.adminCommissionPercentage) / 100
        );
        const platformShare = event.totalDuesCleared - adminShare;

        await commissionRepository.create({
          adminId: event.admin.userId.toString(),
          eventId,
          eventTitle: event.title,
          status: participantsWithClearedDues === approvedParticipants.length ? 'available' : 'pending',
          totalDuesGenerated: event.totalDuesGenerated,
          adminShare,
          platformShare,
          participantsCount: approvedParticipants.length,
          participantsDueCleared: participantsWithClearedDues,
          duePerParticipant: config.business.dueAmount,
        });

        // If all dues cleared, make commission available
        if (participantsWithClearedDues === approvedParticipants.length) {
          const admin = await userRepository.findById(event.admin.userId.toString());
          if (admin) {
            await userRepository.updateFinance(
              event.admin.userId.toString(),
              {
                availableCommission: admin.finance.availableCommission + adminShare,
                totalEarned: admin.finance.totalEarned + adminShare,
              },
              session
            );
          }
        } else {
          // Update pending commission
          const admin = await userRepository.findById(event.admin.userId.toString());
          if (admin) {
            await userRepository.updateFinance(
              event.admin.userId.toString(),
              {
                pendingCommission: admin.finance.pendingCommission + adminShare,
              },
              session
            );
          }
        }
      }

      // Update stats for admin
      const admin = await userRepository.findById(event.admin.userId.toString());
      if (admin) {
        await userRepository.updateStats(event.admin.userId.toString(), {
          eventsCompleted: (admin.stats.eventsCompleted || 0) + 1,
        });
      }

      // Update stats for participants
      for (const participant of event.participants.filter((p) => p.status === 'approved')) {
        await userRepository.updateStats(participant.userId.toString(), {
          eventsCompleted:
            ((await userRepository.findById(participant.userId.toString()))?.stats.eventsCompleted || 0) + 1,
        });
      }

      await session.commitTransaction();

      // Invalidate caches
      await this.invalidateEventCaches(eventId, event.location.city);
      await redisClient.del(CacheKeys.USER(event.admin.userId.toString()));

      // Notify participants
      const notifications = event.participants
        .filter((p) => p.status === 'approved')
        .map((p) => ({
          userId: p.userId.toString(),
          type: 'event_completed' as const,
          title: 'Event Completed! 🎉',
          body: `${event.title} has been completed. Rate your experience!`,
          data: { eventId },
        }));

      if (notifications.length > 0) {
        await notificationRepository.createMany(notifications);
      }

      logWithContext.event('Event completed', { eventId, adminId });

      return updatedEvent;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async getAdminPreviousParticipants(adminId: string): Promise<IUserSummary[]> {
    const participantIds = await eventRepository.getAdminPreviousParticipants(adminId);
    
    const participants: IUserSummary[] = [];
    for (const id of participantIds) {
      const user = await userRepository.findById(id);
      if (user) {
        participants.push({
          _id: user._id,
          fullName: user.fullName,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          gender: user.gender,
          isOnline: user.isOnline,
          kycVerified: user.kyc.status === 'approved',
          averageRating: user.stats.averageRating,
        });
      }
    }

    return participants;
  }

  async bulkInvite(
    eventId: string,
    adminId: string,
    recipientIds: string[],
    message?: string
  ): Promise<number> {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    if (event.admin.userId.toString() !== adminId) {
      throw new ForbiddenError('Not authorized', 'NOT_AUTHORIZED');
    }

    const invites = recipientIds.map((recipientId) => ({
      senderId: adminId,
      recipientId,
      eventId,
      status: 'pending' as const,
      message,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }));

    const createdInvites = await inviteRepository.createBulk(invites);

    // Send notifications
    const notifications = recipientIds.map((recipientId) => ({
      userId: recipientId,
      type: 'friend_event_created' as const,
      title: 'Event Invitation',
      body: `You've been invited to ${event.title}`,
      data: { eventId },
    }));

    await notificationRepository.createMany(notifications);

    logWithContext.event('Bulk invites sent', {
      eventId,
      adminId,
      count: createdInvites.length,
    });

    return createdInvites.length;
  }

  async recordShare(eventId: string): Promise<void> {
    await eventRepository.incrementShareCount(eventId);
  }

  private async invalidateEventCaches(eventId: string, city: string): Promise<void> {
    await redisClient.del(CacheKeys.EVENT(eventId));
    await redisClient.delPattern(`${CacheKeys.EVENTS_BY_CITY(city, 0).slice(0, -1)}*`);
  }

  /**
   * Check if a user is eligible to join an event based on gender, age, and distance criteria
   */
  private checkUserEligibility(
    event: IEvent,
    user: {
      gender?: string;
      dateOfBirth?: Date;
      location?: { coordinates: [number, number] };
    }
  ): { eligible: boolean; reason?: string } {
    // Check gender
    if (user.gender && !(event.eligibility.genderAllowed as string[]).includes(user.gender)) {
      return { eligible: false, reason: 'Gender not eligible for this event' };
    }

    // Check age
    if (user.dateOfBirth) {
      const age = Math.floor(
        (Date.now() - new Date(user.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      if (age < event.eligibility.minAge) {
        return { eligible: false, reason: 'You are below the minimum age requirement' };
      }
      if (age > event.eligibility.maxAge) {
        return { eligible: false, reason: 'You are above the maximum age requirement' };
      }
    }

    // Check distance if maxDistance is set
    if (event.eligibility.maxDistance && user.location?.coordinates) {
      const eventCoords = event.location.coordinates;
      const userCoords = user.location.coordinates;

      // Haversine formula for distance calculation
      const R = 6371; // Earth's radius in km
      const dLat = ((userCoords[1] - eventCoords[1]) * Math.PI) / 180;
      const dLon = ((userCoords[0] - eventCoords[0]) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((eventCoords[1] * Math.PI) / 180) *
          Math.cos((userCoords[1] * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      if (distance > event.eligibility.maxDistance) {
        return {
          eligible: false,
          reason: `You are ${distance.toFixed(1)}km away. Maximum allowed distance is ${event.eligibility.maxDistance}km`,
        };
      }
    }

    // Check if event is full
    if (event.participantCount >= event.eligibility.memberLimit) {
      return { eligible: false, reason: 'Event is full' };
    }

    return { eligible: true };
  }
}

export const eventService = new EventService();

