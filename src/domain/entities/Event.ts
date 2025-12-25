import {
  EventCategory,
  EventType,
  EventStatus,
  Gender,
  ParticipationStatus,
} from '../../shared/constants/index.js';
import { IUserSummary } from './User.js';

export interface IEventLocation {
  type: 'Point';
  /**
   * GeoJSON coordinates array: [longitude, latitude]
   * 
   * IMPORTANT: Format is [longitude, latitude] NOT [latitude, longitude]
   * This follows the GeoJSON and MongoDB 2dsphere standard.
   * 
   * @example [72.8777, 19.076] represents Mumbai (longitude: 72.8777, latitude: 19.076)
   * @example coordinates[0] = longitude, coordinates[1] = latitude
   */
  coordinates: [number, number];
  address: string;
  venueName: string;
  city: string;
  state?: string;
  landmark?: string;
}

export interface IEventEligibility {
  genderAllowed: Gender[];
  minAge: number;
  maxAge: number;
  maxDistance?: number; // in kilometers
  memberLimit: number;
  requiresApproval: boolean;
}

export interface IEventPricing {
  isFree: boolean;
  price?: number; // Amount in paise
  currency: string;
  includesGST: boolean;
}

export interface IEventCoupon {
  code: string;
  discountPercentage: number;
  maxDiscount?: number; // Amount in paise
  validUntil: Date;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
}

export interface IEventGenderRatio {
  male: number;
  female: number;
  other: number;
}

export interface IEventParticipant {
  userId: string;
  user: IUserSummary;
  status: ParticipationStatus;
  joinedAt: Date;
  leaveRequestedAt?: Date;
  leaveApprovedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  hasPendingDues: boolean;
  duesCleared: boolean;
  duesClearedAt?: Date;
}

export interface IEvent {
  _id: string;
  type: EventType;
  status: EventStatus;
  category: EventCategory;
  title: string;
  description: string;
  location: IEventLocation;
  startTime: Date;
  endTime: Date;
  imageUrls: string[];
  coverImageUrl?: string;
  admin: {
    userId: string;
    user: IUserSummary;
  };
  eligibility: IEventEligibility;
  pricing: IEventPricing;
  coupons: IEventCoupon[];
  rules: string[];
  participants: IEventParticipant[];
  participantCount: number;
  waitlistCount: number;
  genderRatio: IEventGenderRatio;
  averageAge: number;
  totalDuesGenerated: number; // Amount in paise
  totalDuesCleared: number; // Amount in paise
  isPublished: boolean;
  publishedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  deepLinkId: string;
  reportCount: number;
  viewCount: number;
  shareCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEventSummary {
  _id: string;
  type: EventType;
  status: EventStatus;
  category: EventCategory;
  title: string;
  location: {
    venueName: string;
    city: string;
    /**
     * GeoJSON coordinates: [longitude, latitude]
     * Format: coordinates[0] = longitude, coordinates[1] = latitude
     */
    coordinates: [number, number];
  };
  startTime: Date;
  coverImageUrl?: string;
  pricing: {
    isFree: boolean;
    price?: number;
  };
  participantCount: number;
  memberLimit: number;
  admin: IUserSummary;
  distance?: number; // Distance from user in km
}

export interface ICreateEventDTO {
  type: EventType;
  category: EventCategory;
  title: string;
  description: string;
  location: IEventLocation;
  startTime: Date;
  endTime: Date;
  imageUrls?: string[];
  coverImageUrl?: string;
  adminId: string;
  eligibility: IEventEligibility;
  pricing: IEventPricing;
  rules?: string[];
}

export interface IUpdateEventDTO {
  title?: string;
  description?: string;
  location?: IEventLocation;
  startTime?: Date;
  endTime?: Date;
  imageUrls?: string[];
  coverImageUrl?: string;
  eligibility?: Partial<IEventEligibility>;
  pricing?: IEventPricing;
  rules?: string[];
}

export interface IEventQuery {
  type?: EventType;
  status?: EventStatus;
  category?: EventCategory;
  city?: string;
  adminId?: string;
  participantId?: string;
  startTimeFrom?: Date;
  startTimeTo?: Date;
  isFree?: boolean;
  nearLocation?: {
    longitude: number;
    latitude: number;
    maxDistance: number; // in meters
  };
}

export interface IEventFilters {
  category?: EventCategory;
  type?: EventType;
  status?: EventStatus;
  priceRange?: {
    min: number;
    max: number;
  };
  dateRange?: {
    from: Date;
    to: Date;
  };
  genderAllowed?: Gender;
  sortBy?: 'startTime' | 'distance' | 'createdAt' | 'participantCount';
  sortOrder?: 'asc' | 'desc';
}

