import mongoose, { Schema, Document } from 'mongoose';

export interface IPostLikeDocument extends Document {
  userId: mongoose.Types.ObjectId;
  targetId: mongoose.Types.ObjectId;
  targetType: 'post' | 'comment';
  createdAt: Date;
}

const PostLikeSchema = new Schema<IPostLikeDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['post', 'comment'],
      required: true,
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

// Unique index to prevent duplicate likes
PostLikeSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });

// Index for getting likes of a target
PostLikeSchema.index({ targetId: 1, targetType: 1, createdAt: -1 });

export const PostLikeModel = mongoose.model<IPostLikeDocument>('PostLike', PostLikeSchema);
