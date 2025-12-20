import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  IFriendship,
  INotification,
  IReport,
  IRating,
  IInvite,
} from '../../../domain/entities/Social.js';
import {
  FriendRequestStatuses,
  NotificationTypes,
  ReportReasons,
} from '../../../shared/constants/index.js';

// Friendship Document
export interface IFriendshipDocument extends Omit<IFriendship, '_id'>, Document {}

export interface IFriendshipModel extends Model<IFriendshipDocument> {
  findFriendship(userId1: string, userId2: string): Promise<IFriendshipDocument | null>;
  areFriends(userId1: string, userId2: string): Promise<boolean>;
  getUserFriends(userId: string): Promise<IFriendshipDocument[]>;
  getPendingRequests(userId: string): Promise<IFriendshipDocument[]>;
}

const FriendshipSchema = new Schema<IFriendshipDocument, IFriendshipModel>(
  {
    user1Id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    user2Id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: FriendRequestStatuses,
      default: 'pending',
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
    },
    acceptedAt: Date,
    rejectedAt: Date,
    blockedAt: Date,
    blockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
FriendshipSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });
FriendshipSchema.index({ user1Id: 1, status: 1 });
FriendshipSchema.index({ user2Id: 1, status: 1 });
FriendshipSchema.index({ requestedBy: 1, status: 1 });

// Ensure user1Id is always less than user2Id for consistency
FriendshipSchema.pre('save', function (next) {
  if (this.isNew) {
    const id1 = this.user1Id.toString();
    const id2 = this.user2Id.toString();
    if (id1 > id2) {
      const temp = this.user1Id;
      this.user1Id = this.user2Id;
      this.user2Id = temp;
    }
  }
  next();
});

// Static methods
FriendshipSchema.statics.findFriendship = function (userId1: string, userId2: string) {
  const id1 = new mongoose.Types.ObjectId(userId1);
  const id2 = new mongoose.Types.ObjectId(userId2);
  
  // Sort to match the pre-save normalization
  const [sortedId1, sortedId2] = id1.toString() < id2.toString() ? [id1, id2] : [id2, id1];
  
  return this.findOne({
    user1Id: sortedId1,
    user2Id: sortedId2,
  });
};

FriendshipSchema.statics.areFriends = async function (userId1: string, userId2: string) {
  const friendship = await this.findFriendship(userId1, userId2);
  return friendship?.status === 'accepted';
};

FriendshipSchema.statics.getUserFriends = function (userId: string) {
  const id = new mongoose.Types.ObjectId(userId);
  return this.find({
    $or: [{ user1Id: id }, { user2Id: id }],
    status: 'accepted',
  });
};

FriendshipSchema.statics.getPendingRequests = function (userId: string) {
  const id = new mongoose.Types.ObjectId(userId);
  return this.find({
    $or: [{ user1Id: id }, { user2Id: id }],
    requestedBy: { $ne: id },
    status: 'pending',
  });
};

export const FriendshipModel = mongoose.model<IFriendshipDocument, IFriendshipModel>(
  'Friendship',
  FriendshipSchema
);

// Notification Document
export interface INotificationDocument extends Omit<INotification, '_id'>, Document {}

const NotificationDataSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    friendshipId: { type: Schema.Types.ObjectId, ref: 'Friendship' },
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat' },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
  },
  { _id: false }
);

const NotificationSchema = new Schema<INotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NotificationTypes,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    body: {
      type: String,
      required: true,
      maxlength: 500,
    },
    imageUrl: String,
    data: NotificationDataSchema,
    actionUrl: String,
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: Date,
    isPushed: {
      type: Boolean,
      default: false,
    },
    pushedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // TTL: 30 days

export const NotificationModel = mongoose.model<INotificationDocument>(
  'Notification',
  NotificationSchema
);

// Report Document
export interface IReportDocument extends Omit<IReport, '_id'>, Document {}

const ReportSchema = new Schema<IReportDocument>(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['event', 'user', 'message'],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'targetType',
      index: true,
    },
    reason: {
      type: String,
      enum: ReportReasons,
      required: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewNotes: String,
    resolution: String,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
ReportSchema.index({ targetType: 1, targetId: 1 });
ReportSchema.index({ status: 1, createdAt: -1 });

export const ReportModel = mongoose.model<IReportDocument>('Report', ReportSchema);

// Rating Document
export interface IRatingDocument extends Omit<IRating, '_id'>, Document {}

const RatingSchema = new Schema<IRatingDocument>(
  {
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      maxlength: 500,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
RatingSchema.index({ fromUserId: 1, toUserId: 1, eventId: 1 }, { unique: true });
RatingSchema.index({ toUserId: 1, createdAt: -1 });

export const RatingModel = mongoose.model<IRatingDocument>('Rating', RatingSchema);

// Invite Document
export interface IInviteDocument extends Omit<IInvite, '_id'>, Document {}

const InviteSchema = new Schema<IInviteDocument>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired'],
      default: 'pending',
      index: true,
    },
    message: {
      type: String,
      maxlength: 200,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    respondedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
InviteSchema.index({ senderId: 1, recipientId: 1, eventId: 1 }, { unique: true });
InviteSchema.index({ recipientId: 1, status: 1 });
InviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

export const InviteModel = mongoose.model<IInviteDocument>('Invite', InviteSchema);

