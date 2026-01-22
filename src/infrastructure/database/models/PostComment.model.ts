import mongoose, { Schema, Document } from 'mongoose';

export interface IPostCommentDocument extends Document {
  postId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  content: string;
  parentCommentId?: mongoose.Types.ObjectId;
  mentions: mongoose.Types.ObjectId[];
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const PostCommentSchema = new Schema<IPostCommentDocument>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'PostComment',
      index: true,
    },
    mentions: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
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
PostCommentSchema.index({ postId: 1, createdAt: -1 });
PostCommentSchema.index({ parentCommentId: 1, createdAt: -1 });
PostCommentSchema.index({ authorId: 1, createdAt: -1 });

export const PostCommentModel = mongoose.model<IPostCommentDocument>(
  'PostComment',
  PostCommentSchema
);
