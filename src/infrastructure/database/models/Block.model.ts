import mongoose, { Schema, Document } from 'mongoose';

export interface IBlockDocument extends Document {
  blockerId: mongoose.Types.ObjectId;
  blockedUserId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const BlockSchema = new Schema<IBlockDocument>(
  {
    blockerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blockedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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

// Unique index to prevent duplicate blocks
BlockSchema.index({ blockerId: 1, blockedUserId: 1 }, { unique: true });

// Index for checking if user is blocked
BlockSchema.index({ blockedUserId: 1 });

export const BlockModel = mongoose.model<IBlockDocument>('Block', BlockSchema);
