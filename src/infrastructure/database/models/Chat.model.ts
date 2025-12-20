import mongoose, { Schema, Document, Model } from 'mongoose';
import { IChat, IMessage, IChatParticipant } from '../../../domain/entities/Chat.js';
import { MessageTypes } from '../../../shared/constants/index.js';

// Chat Document
export interface IChatDocument extends Omit<IChat, '_id'>, Document {
  addParticipant(userId: string): void;
  removeParticipant(userId: string): void;
  updateLastMessage(message: IMessage): void;
}

export interface IChatModel extends Model<IChatDocument> {
  findDirectChat(userId1: string, userId2: string): Promise<IChatDocument | null>;
  findEventChat(eventId: string): Promise<IChatDocument | null>;
  findUserChats(userId: string): Promise<IChatDocument[]>;
}

const ChatParticipantSchema = new Schema<IChatParticipant>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastReadAt: Date,
    isMuted: {
      type: Boolean,
      default: false,
    },
    mutedUntil: Date,
  },
  { _id: false }
);

const LastMessageSchema = new Schema(
  {
    _id: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    senderName: String,
    content: String,
    type: {
      type: String,
      enum: MessageTypes,
    },
    createdAt: Date,
  },
  { _id: false }
);

const ChatSchema = new Schema<IChatDocument, IChatModel>(
  {
    type: {
      type: String,
      enum: ['direct', 'event_group'],
      required: true,
      index: true,
    },
    name: String,
    imageUrl: String,
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      index: true,
    },
    participants: {
      type: [ChatParticipantSchema],
      required: true,
    },
    lastMessage: LastMessageSchema,
    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Indexes
ChatSchema.index({ 'participants.userId': 1 });
ChatSchema.index({ type: 1, isActive: 1 });
ChatSchema.index({ updatedAt: -1 });

// For finding direct chats between two users
ChatSchema.index({ type: 1, 'participants.userId': 1 });

// Methods
ChatSchema.methods.addParticipant = function (userId: string): void {
  const exists = this.participants.some(
    (p: IChatParticipant) => p.userId.toString() === userId
  );
  if (!exists) {
    this.participants.push({
      userId,
      joinedAt: new Date(),
      isMuted: false,
    });
  }
};

ChatSchema.methods.removeParticipant = function (userId: string): void {
  this.participants = this.participants.filter(
    (p: IChatParticipant) => p.userId.toString() !== userId
  );
};

ChatSchema.methods.updateLastMessage = function (message: IMessage): void {
  this.lastMessage = {
    _id: message._id,
    senderId: message.senderId,
    senderName: message.senderName,
    content: message.content,
    type: message.type,
    createdAt: message.createdAt,
  };
  this.messageCount += 1;
};

// Static methods
ChatSchema.statics.findDirectChat = function (userId1: string, userId2: string) {
  return this.findOne({
    type: 'direct',
    isActive: true,
    $and: [
      { 'participants.userId': new mongoose.Types.ObjectId(userId1) },
      { 'participants.userId': new mongoose.Types.ObjectId(userId2) },
    ],
    'participants.2': { $exists: false }, // Exactly 2 participants
  });
};

ChatSchema.statics.findEventChat = function (eventId: string) {
  return this.findOne({
    type: 'event_group',
    eventId: new mongoose.Types.ObjectId(eventId),
    isActive: true,
  });
};

ChatSchema.statics.findUserChats = function (userId: string) {
  return this.find({
    'participants.userId': new mongoose.Types.ObjectId(userId),
    isActive: true,
  })
    .sort({ updatedAt: -1 })
    .limit(50);
};

export const ChatModel = mongoose.model<IChatDocument, IChatModel>('Chat', ChatSchema);

// Message Document
export interface IMessageDocument extends Omit<IMessage, '_id'>, Document {}

export interface IMessageModel extends Model<IMessageDocument> {
  findByChatId(chatId: string, options?: { before?: Date; limit?: number }): Promise<IMessageDocument[]>;
}

const ReadBySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    readAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const ReplyToSchema = new Schema(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
    },
    content: String,
    senderName: String,
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessageDocument, IMessageModel>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderAvatar: String,
    type: {
      type: String,
      enum: MessageTypes,
      required: true,
      default: 'text',
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    imageUrl: String,
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
    },
    replyTo: ReplyToSchema,
    readBy: {
      type: [ReadBySchema],
      default: [],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
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
MessageSchema.index({ chatId: 1, createdAt: -1 });
MessageSchema.index({ chatId: 1, isDeleted: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });

// Static methods
MessageSchema.statics.findByChatId = function (
  chatId: string,
  options: { before?: Date; limit?: number } = {}
) {
  const query: Record<string, unknown> = {
    chatId: new mongoose.Types.ObjectId(chatId),
    isDeleted: false,
  };

  if (options.before) {
    query.createdAt = { $lt: options.before };
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

export const MessageModel = mongoose.model<IMessageDocument, IMessageModel>('Message', MessageSchema);

