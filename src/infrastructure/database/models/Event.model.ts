import mongoose, { Schema, Document, Model } from 'mongoose';
import { nanoid } from 'nanoid';
import { IEvent, IEventParticipant } from '../../../domain/entities/Event.js';
import {
  EventCategories,
  EventTypes,
  EventStatuses,
  Genders,
  ParticipationStatuses,
} from '../../../shared/constants/index.js';

export interface IEventDocument extends Omit<IEvent, '_id'>, Document {
  isUserEligible(user: {
    gender?: string;
    dateOfBirth?: Date;
    location?: { coordinates: [number, number] };
  }): { eligible: boolean; reason?: string };
  getApprovedParticipants(): IEventParticipant[];
  getPendingApprovals(): IEventParticipant[];
  hasSpots(): boolean;
}

export interface IEventModel extends Model<IEventDocument> {
  findNearby(
    coordinates: [number, number],
    maxDistance: number,
    query?: Record<string, unknown>
  ): Promise<IEventDocument[]>;
  findByCity(city: string, query?: Record<string, unknown>): Promise<IEventDocument[]>;
  findByDeepLink(deepLinkId: string): Promise<IEventDocument | null>;
}

const EventLocationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      /**
       * GeoJSON coordinates array: [longitude, latitude]
       * 
       * IMPORTANT: Format is [longitude, latitude] NOT [latitude, longitude]
       * This follows the GeoJSON and MongoDB 2dsphere standard.
       * 
       * @example [72.8777, 19.076] = Mumbai (longitude: 72.8777, latitude: 19.076)
       * @example coordinates[0] = longitude, coordinates[1] = latitude
       */
      type: [Number],
      required: true,
      index: '2dsphere',
    },
    address: {
      type: String,
      required: true,
    },
    venueName: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
      index: true,
    },
    state: String,
    landmark: String,
  },
  { _id: false }
);

const EventEligibilitySchema = new Schema(
  {
    genderAllowed: {
      type: [String],
      enum: Genders,
      default: ['male', 'female', 'other', 'prefer_not_to_say'],
    },
    minAge: {
      type: Number,
      default: 18,
      min: 13,
      max: 100,
    },
    maxAge: {
      type: Number,
      default: 100,
      min: 13,
      max: 100,
    },
    maxDistance: {
      type: Number, // in kilometers
      min: 1,
    },
    memberLimit: {
      type: Number,
      required: true,
      min: 2,
      max: 1000,
    },
    requiresApproval: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const EventPricingSchema = new Schema(
  {
    isFree: {
      type: Boolean,
      default: true,
    },
    price: {
      type: Number, // Amount in paise
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    includesGST: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const EventCouponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    maxDiscount: Number, // Amount in paise
    validUntil: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: 100,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const EventGenderRatioSchema = new Schema(
  {
    male: {
      type: Number,
      default: 0,
    },
    female: {
      type: Number,
      default: 0,
    },
    other: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const EventParticipantSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ParticipationStatuses,
      default: 'pending_approval',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leaveRequestedAt: Date,
    leaveApprovedAt: Date,
    approvedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
    hasPendingDues: {
      type: Boolean,
      default: false,
    },
    duesCleared: {
      type: Boolean,
      default: false,
    },
    duesClearedAt: Date,
  },
  { _id: false }
);

const EventAdminSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { _id: false }
);

const EventSchema = new Schema<IEventDocument, IEventModel>(
  {
    type: {
      type: String,
      enum: EventTypes,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: EventStatuses,
      default: 'draft',
      index: true,
    },
    category: {
      type: String,
      enum: EventCategories,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    location: {
      type: EventLocationSchema,
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    imageUrls: {
      type: [String],
      default: [],
    },
    coverImageUrl: String,
    admin: {
      type: EventAdminSchema,
      required: true,
    },
    eligibility: {
      type: EventEligibilitySchema,
      required: true,
    },
    pricing: {
      type: EventPricingSchema,
      default: () => ({ isFree: true }),
    },
    coupons: {
      type: [EventCouponSchema],
      default: [],
    },
    rules: {
      type: [String],
      default: [],
    },
    participants: {
      type: [EventParticipantSchema],
      default: [],
    },
    participantCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    waitlistCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    genderRatio: {
      type: EventGenderRatioSchema,
      default: () => ({}),
    },
    averageAge: {
      type: Number,
      default: 0,
    },
    totalDuesGenerated: {
      type: Number, // Amount in paise
      default: 0,
      min: 0,
    },
    totalDuesCleared: {
      type: Number, // Amount in paise
      default: 0,
      min: 0,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    publishedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
    deepLinkId: {
      type: String,
      unique: true,
      index: true,
      default: () => nanoid(10),
    },
    reportCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { __v, ...rest } = ret as any;
        return rest;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Compound indexes for common queries
EventSchema.index({ 'location.coordinates': '2dsphere' });
EventSchema.index({ status: 1, 'location.city': 1, startTime: 1 });
EventSchema.index({ status: 1, category: 1, startTime: 1 });
EventSchema.index({ 'admin.userId': 1, status: 1 });
EventSchema.index({ 'participants.userId': 1 });
EventSchema.index({ type: 1, status: 1, startTime: 1 });
EventSchema.index({ startTime: 1, status: 1 });
EventSchema.index({ createdAt: -1 });

// Virtual for checking if event has available spots
EventSchema.virtual('hasAvailableSpots').get(function () {
  return this.participantCount < this.eligibility.memberLimit;
});

// Method to check user eligibility
EventSchema.methods.isUserEligible = function (user: {
  gender?: string;
  dateOfBirth?: Date;
  location?: { coordinates: [number, number] };
}): { eligible: boolean; reason?: string } {
  // Check gender
  if (user.gender && !this.eligibility.genderAllowed.includes(user.gender)) {
    return { eligible: false, reason: 'Gender not eligible for this event' };
  }

  // Check age
  if (user.dateOfBirth) {
    const age = Math.floor(
      (Date.now() - user.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );
    if (age < this.eligibility.minAge) {
      return { eligible: false, reason: 'You are below the minimum age requirement' };
    }
    if (age > this.eligibility.maxAge) {
      return { eligible: false, reason: 'You are above the maximum age requirement' };
    }
  }

  // Check distance if maxDistance is set
  if (this.eligibility.maxDistance && user.location?.coordinates) {
    const eventCoords = this.location.coordinates;
    const userCoords = user.location.coordinates;

    // Simple distance calculation (Haversine formula approximation)
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

    if (distance > this.eligibility.maxDistance) {
      return {
        eligible: false,
        reason: `You are ${distance.toFixed(1)}km away. Maximum allowed distance is ${this.eligibility.maxDistance}km`,
      };
    }
  }

  // Check if event is full
  if (this.participantCount >= this.eligibility.memberLimit) {
    return { eligible: false, reason: 'Event is full' };
  }

  return { eligible: true };
};

// Method to get approved participants
EventSchema.methods.getApprovedParticipants = function (): IEventParticipant[] {
  return this.participants.filter((p: IEventParticipant) => p.status === 'approved');
};

// Method to get pending approvals
EventSchema.methods.getPendingApprovals = function (): IEventParticipant[] {
  return this.participants.filter((p: IEventParticipant) => p.status === 'pending_approval');
};

// Method to check if spots are available
EventSchema.methods.hasSpots = function (): boolean {
  return this.participantCount < this.eligibility.memberLimit;
};

// Static method to find nearby events
EventSchema.statics.findNearby = function (
  coordinates: [number, number],
  maxDistance: number,
  query: Record<string, unknown> = {}
) {
  return this.find({
    ...query,
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates,
        },
        $maxDistance: maxDistance, // in meters
      },
    },
  });
};

// Static method to find events by city
EventSchema.statics.findByCity = function (
  city: string,
  query: Record<string, unknown> = {}
) {
  return this.find({
    ...query,
    'location.city': { $regex: new RegExp(city, 'i') },
  });
};

// Static method to find by deep link
EventSchema.statics.findByDeepLink = function (deepLinkId: string) {
  return this.findOne({ deepLinkId });
};

// Pre-save hook to update participant count
EventSchema.pre('save', function (next) {
  if (this.isModified('participants')) {
    const approvedCount = this.participants.filter((p) => p.status === 'approved').length;
    this.participantCount = approvedCount;

    const pendingCount = this.participants.filter((p) => p.status === 'pending_approval').length;
    this.waitlistCount = pendingCount;
  }
  next();
});

export const EventModel = mongoose.model<IEventDocument, IEventModel>('Event', EventSchema);

