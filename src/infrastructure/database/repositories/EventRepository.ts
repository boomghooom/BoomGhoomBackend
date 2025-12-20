import { ClientSession, FilterQuery, Types } from 'mongoose';
import { BaseRepository } from './BaseRepository.js';
import { EventModel, IEventDocument } from '../models/Event.model.js';
import {
  IEvent,
  IEventSummary,
  ICreateEventDTO,
  IUpdateEventDTO,
  IEventFilters,
  IEventParticipant,
} from '../../../domain/entities/Event.js';
import { IPaginationOptions, IPaginatedResult } from '../../../domain/repositories/IBaseRepository.js';
import { EventStatus, ParticipationStatus } from '../../../shared/constants/index.js';

export interface IEventRepository {
  create(data: ICreateEventDTO): Promise<IEvent>;
  findById(id: string): Promise<IEvent | null>;
  findByIdWithPopulate(id: string): Promise<IEvent | null>;
  findByDeepLink(deepLinkId: string): Promise<IEvent | null>;
  findByAdmin(adminId: string, options: IPaginationOptions): Promise<IPaginatedResult<IEventSummary>>;
  findNearby(
    coordinates: [number, number],
    maxDistance: number,
    filters?: IEventFilters,
    options?: IPaginationOptions
  ): Promise<IPaginatedResult<IEventSummary>>;
  findByCity(
    city: string,
    filters?: IEventFilters,
    options?: IPaginationOptions
  ): Promise<IPaginatedResult<IEventSummary>>;
  findByParticipant(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IEventSummary>>;
  findUpcoming(city: string, limit?: number): Promise<IEventSummary[]>;
  findFeatured(city: string, limit?: number): Promise<IEventSummary[]>;
  updateById(id: string, data: IUpdateEventDTO): Promise<IEvent | null>;
  updateStatus(id: string, status: EventStatus, data?: Partial<IEvent>): Promise<IEvent | null>;
  addParticipant(
    eventId: string,
    participant: IEventParticipant,
    session?: ClientSession
  ): Promise<IEvent | null>;
  updateParticipantStatus(
    eventId: string,
    userId: string,
    status: ParticipationStatus,
    data?: Partial<IEventParticipant>
  ): Promise<IEvent | null>;
  removeParticipant(eventId: string, userId: string): Promise<IEvent | null>;
  isUserParticipant(eventId: string, userId: string): Promise<boolean>;
  getParticipant(eventId: string, userId: string): Promise<IEventParticipant | null>;
  incrementViewCount(eventId: string): Promise<void>;
  incrementShareCount(eventId: string): Promise<void>;
  updateDuesStats(
    eventId: string,
    duesGenerated: number,
    duesCleared: number,
    session?: ClientSession
  ): Promise<IEvent | null>;
  getAdminPreviousParticipants(adminId: string): Promise<string[]>;
}

export class EventRepository
  extends BaseRepository<IEvent, IEventDocument, ICreateEventDTO, IUpdateEventDTO>
  implements IEventRepository
{
  constructor() {
    super(EventModel);
  }

  async findByIdWithPopulate(id: string): Promise<IEvent | null> {
    const event = await this.model
      .findById(id)
      .populate('admin.userId', 'fullName displayName avatarUrl gender kyc.status stats.averageRating isOnline')
      .populate('participants.userId', 'fullName displayName avatarUrl gender kyc.status stats.averageRating isOnline');
    return event ? (event.toObject() as IEvent) : null;
  }

  async findByDeepLink(deepLinkId: string): Promise<IEvent | null> {
    const event = await EventModel.findByDeepLink(deepLinkId);
    return event ? (event.toObject() as IEvent) : null;
  }

  async findByAdmin(
    adminId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IEventSummary>> {
    const query: FilterQuery<IEventDocument> = { 'admin.userId': adminId };
    const result = await this.findPaginated(query, options);
    return {
      ...result,
      data: result.data.map(this.toSummary),
    };
  }

  async findNearby(
    coordinates: [number, number],
    maxDistance: number,
    filters?: IEventFilters,
    options: IPaginationOptions = { page: 1, limit: 20 }
  ): Promise<IPaginatedResult<IEventSummary>> {
    const query = this.buildFilterQuery(filters);
    query['location.coordinates'] = {
      $near: {
        $geometry: { type: 'Point', coordinates },
        $maxDistance: maxDistance,
      },
    };
    query.status = { $in: ['upcoming', 'ongoing'] };
    query.isPublished = true;

    // For geo queries, we need to handle pagination differently
    const skip = (options.page - 1) * options.limit;
    
    const [events, total] = await Promise.all([
      this.model.find(query).skip(skip).limit(options.limit),
      this.model.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / options.limit);

    return {
      data: events.map((event) => this.toSummary(event.toObject())),
      total,
      page: options.page,
      limit: options.limit,
      totalPages,
      hasNextPage: options.page < totalPages,
      hasPrevPage: options.page > 1,
    };
  }

  async findByCity(
    city: string,
    filters?: IEventFilters,
    options: IPaginationOptions = { page: 1, limit: 20 }
  ): Promise<IPaginatedResult<IEventSummary>> {
    const query = this.buildFilterQuery(filters);
    query['location.city'] = { $regex: new RegExp(city, 'i') };
    query.status = { $in: ['upcoming', 'ongoing'] };
    query.isPublished = true;

    const result = await this.findPaginated(query, {
      ...options,
      sort: filters?.sortBy
        ? { [filters.sortBy]: filters.sortOrder === 'asc' ? 1 : -1 }
        : { startTime: 1 },
    });

    return {
      ...result,
      data: result.data.map(this.toSummary),
    };
  }

  async findByParticipant(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IEventSummary>> {
    const query: FilterQuery<IEventDocument> = {
      'participants.userId': new Types.ObjectId(userId),
      'participants.status': 'approved',
    };

    const result = await this.findPaginated(query, options);
    return {
      ...result,
      data: result.data.map(this.toSummary),
    };
  }

  async findUpcoming(city: string, limit = 10): Promise<IEventSummary[]> {
    const events = await this.model
      .find({
        'location.city': { $regex: new RegExp(city, 'i') },
        status: 'upcoming',
        isPublished: true,
        startTime: { $gt: new Date() },
      })
      .sort({ startTime: 1 })
      .limit(limit);

    return events.map((event) => this.toSummary(event.toObject()));
  }

  async findFeatured(city: string, limit = 10): Promise<IEventSummary[]> {
    const events = await this.model
      .find({
        'location.city': { $regex: new RegExp(city, 'i') },
        status: { $in: ['upcoming', 'ongoing'] },
        isPublished: true,
        type: 'sponsored',
      })
      .sort({ viewCount: -1, startTime: 1 })
      .limit(limit);

    return events.map((event) => this.toSummary(event.toObject()));
  }

  async updateStatus(
    id: string,
    status: EventStatus,
    data?: Partial<IEvent>
  ): Promise<IEvent | null> {
    const updateData: Record<string, unknown> = { status };
    
    if (status === 'completed') updateData.completedAt = new Date();
    if (status === 'cancelled' && data?.cancellationReason) {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = data.cancellationReason;
    }

    const event = await this.model.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    return event ? (event.toObject() as IEvent) : null;
  }

  async addParticipant(
    eventId: string,
    participant: IEventParticipant,
    session?: ClientSession
  ): Promise<IEvent | null> {
    const event = await this.model.findByIdAndUpdate(
      eventId,
      { $push: { participants: participant } },
      { new: true, runValidators: true, session }
    );
    return event ? (event.toObject() as IEvent) : null;
  }

  async updateParticipantStatus(
    eventId: string,
    userId: string,
    status: ParticipationStatus,
    data?: Partial<IEventParticipant>
  ): Promise<IEvent | null> {
    const updateFields: Record<string, unknown> = {
      'participants.$.status': status,
    };

    if (status === 'approved') updateFields['participants.$.approvedAt'] = new Date();
    if (status === 'rejected') {
      updateFields['participants.$.rejectedAt'] = new Date();
      if (data?.rejectionReason) {
        updateFields['participants.$.rejectionReason'] = data.rejectionReason;
      }
    }
    if (status === 'leave_requested') {
      updateFields['participants.$.leaveRequestedAt'] = new Date();
    }
    if (status === 'left') {
      updateFields['participants.$.leaveApprovedAt'] = new Date();
    }
    if (data?.duesCleared !== undefined) {
      updateFields['participants.$.duesCleared'] = data.duesCleared;
      if (data.duesCleared) {
        updateFields['participants.$.duesClearedAt'] = new Date();
      }
    }

    const event = await this.model.findOneAndUpdate(
      { _id: eventId, 'participants.userId': userId },
      { $set: updateFields },
      { new: true, runValidators: true }
    );
    return event ? (event.toObject() as IEvent) : null;
  }

  async removeParticipant(eventId: string, userId: string): Promise<IEvent | null> {
    const event = await this.model.findByIdAndUpdate(
      eventId,
      { $pull: { participants: { userId } } },
      { new: true }
    );
    return event ? (event.toObject() as IEvent) : null;
  }

  async isUserParticipant(eventId: string, userId: string): Promise<boolean> {
    const event = await this.model.findOne({
      _id: eventId,
      'participants.userId': userId,
      'participants.status': { $in: ['pending_approval', 'approved'] },
    });
    return event !== null;
  }

  async getParticipant(eventId: string, userId: string): Promise<IEventParticipant | null> {
    const event = await this.model.findOne(
      { _id: eventId, 'participants.userId': userId },
      { 'participants.$': 1 }
    );
    return event?.participants?.[0] || null;
  }

  async incrementViewCount(eventId: string): Promise<void> {
    await this.model.findByIdAndUpdate(eventId, { $inc: { viewCount: 1 } });
  }

  async incrementShareCount(eventId: string): Promise<void> {
    await this.model.findByIdAndUpdate(eventId, { $inc: { shareCount: 1 } });
  }

  async updateDuesStats(
    eventId: string,
    duesGenerated: number,
    duesCleared: number,
    session?: ClientSession
  ): Promise<IEvent | null> {
    const event = await this.model.findByIdAndUpdate(
      eventId,
      {
        $inc: {
          totalDuesGenerated: duesGenerated,
          totalDuesCleared: duesCleared,
        },
      },
      { new: true, session }
    );
    return event ? (event.toObject() as IEvent) : null;
  }

  async getAdminPreviousParticipants(adminId: string): Promise<string[]> {
    const events = await this.model.find(
      { 'admin.userId': adminId, status: 'completed' },
      { 'participants.userId': 1 }
    );

    const participantSet = new Set<string>();
    events.forEach((event) => {
      event.participants.forEach((p) => {
        if (p.status === 'approved') {
          participantSet.add(p.userId.toString());
        }
      });
    });

    return Array.from(participantSet);
  }

  private buildFilterQuery(filters?: IEventFilters): FilterQuery<IEventDocument> {
    const query: FilterQuery<IEventDocument> = {};

    if (!filters) return query;

    if (filters.category) query.category = filters.category;
    if (filters.type) query.type = filters.type;
    if (filters.status) query.status = filters.status;
    if (filters.genderAllowed) {
      query['eligibility.genderAllowed'] = filters.genderAllowed;
    }
    if (filters.priceRange) {
      if (filters.priceRange.min === 0 && filters.priceRange.max === 0) {
        query['pricing.isFree'] = true;
      } else {
        query['pricing.price'] = {
          $gte: filters.priceRange.min,
          $lte: filters.priceRange.max,
        };
      }
    }
    if (filters.dateRange) {
      query.startTime = {
        $gte: filters.dateRange.from,
        $lte: filters.dateRange.to,
      };
    }

    return query;
  }

  private toSummary(event: IEvent): IEventSummary {
    return {
      _id: event._id,
      type: event.type,
      status: event.status,
      category: event.category,
      title: event.title,
      location: {
        venueName: event.location.venueName,
        city: event.location.city,
        coordinates: event.location.coordinates,
      },
      startTime: event.startTime,
      coverImageUrl: event.coverImageUrl,
      pricing: {
        isFree: event.pricing.isFree,
        price: event.pricing.price,
      },
      participantCount: event.participantCount,
      memberLimit: event.eligibility.memberLimit,
      admin: event.admin.user,
    };
  }
}

export const eventRepository = new EventRepository();

