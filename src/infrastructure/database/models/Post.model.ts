import mongoose, { Schema, Document } from 'mongoose';

export interface IPostDocument extends Document {
  authorId: mongoose.Types.ObjectId;
  content: string;
  mediaUrls: string[];
  mediaTypes: ('image' | 'video')[];
  eventId?: mongoose.Types.ObjectId;
  mentions: mongoose.Types.ObjectId[];
  hashtags: string[];
  privacy: 'public' | 'friends_only' | 'private';
  likeCount: number;
  commentCount: number;
  shareCount: number;
  originalPostId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const PostSchema = new Schema<IPostDocument>(
  {
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    mediaUrls: {
      type: [String],
      default: [],
    },
    mediaTypes: {
      type: [String],
      enum: ['image', 'video'],
      default: [],
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      index: true,
    },
    mentions: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
      index: true,
    },
    hashtags: {
      type: [String],
      default: [],
      index: true,
    },
    privacy: {
      type: String,
      enum: ['public', 'friends_only', 'private'],
      default: 'public',
    },
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    commentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    originalPostId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    deletedAt: {
      type: Date,
      default: null,
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

// Indexes for efficient queries
PostSchema.index({ authorId: 1, createdAt: -1 });
PostSchema.index({ hashtags: 1, createdAt: -1 });
PostSchema.index({ eventId: 1, createdAt: -1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({ mentions: 1, createdAt: -1 });
PostSchema.index({ privacy: 1, createdAt: -1 });

export const PostModel = mongoose.model<IPostDocument>('Post', PostSchema);
