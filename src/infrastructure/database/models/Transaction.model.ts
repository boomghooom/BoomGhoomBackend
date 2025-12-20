import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  ITransaction,
  IWithdrawal,
  ICommission,
  IDue,
  IPaymentOrder,
} from '../../../domain/entities/Finance.js';
import {
  TransactionTypes,
  TransactionStatuses,
  PaymentMethods,
  CommissionStatuses,
} from '../../../shared/constants/index.js';

// Transaction Document
export interface ITransactionDocument extends Omit<ITransaction, '_id'>, Document {}

export interface ITransactionModel extends Model<ITransactionDocument> {
  findByUser(userId: string, limit?: number): Promise<ITransactionDocument[]>;
  getTotalByType(userId: string, type: string): Promise<number>;
}

const TransactionSchema = new Schema<ITransactionDocument, ITransactionModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: TransactionTypes,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: TransactionStatuses,
      default: 'pending',
      index: true,
    },
    amount: {
      type: Number, // Amount in paise
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    description: {
      type: String,
      required: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      index: true,
    },
    eventTitle: String,
    paymentMethod: {
      type: String,
      enum: PaymentMethods,
    },
    gatewayFee: {
      type: Number, // Amount in paise
      default: 0,
    },
    gst: {
      type: Number, // Amount in paise
      default: 0,
    },
    netAmount: {
      type: Number, // Amount in paise
    },
    referenceId: {
      type: String,
      index: true,
    },
    gatewayOrderId: {
      type: String,
      index: true,
    },
    gatewayPaymentId: {
      type: String,
      index: true,
    },
    gatewaySignature: String,
    bankTransactionId: String,
    metadata: {
      type: Schema.Types.Mixed,
    },
    failureReason: String,
    completedAt: Date,
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
TransactionSchema.index({ userId: 1, type: 1, createdAt: -1 });
TransactionSchema.index({ userId: 1, status: 1 });
TransactionSchema.index({ createdAt: -1 });

// Static methods
TransactionSchema.statics.findByUser = function (userId: string, limit = 50) {
  return this.find({ userId }).sort({ createdAt: -1 }).limit(limit);
};

TransactionSchema.statics.getTotalByType = async function (userId: string, type: string) {
  const result = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), type, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result.length > 0 ? result[0].total : 0;
};

export const TransactionModel = mongoose.model<ITransactionDocument, ITransactionModel>(
  'Transaction',
  TransactionSchema
);

// Withdrawal Document
export interface IWithdrawalDocument extends Omit<IWithdrawal, '_id'>, Document {}

const WithdrawalSchema = new Schema<IWithdrawalDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number, // Amount in paise
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    bankDetails: {
      accountHolderName: { type: String, required: true },
      accountNumber: { type: String, required: true },
      ifscCode: { type: String, required: true },
      bankName: { type: String, required: true },
    },
    gatewayFee: {
      type: Number, // Amount in paise
      default: 0,
    },
    gst: {
      type: Number, // Amount in paise
      default: 0,
    },
    netAmount: {
      type: Number, // Amount in paise
      required: true,
    },
    transactionId: String,
    utrNumber: String,
    failureReason: String,
    processedAt: Date,
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

WithdrawalSchema.index({ userId: 1, status: 1 });
WithdrawalSchema.index({ createdAt: -1 });

export const WithdrawalModel = mongoose.model<IWithdrawalDocument>('Withdrawal', WithdrawalSchema);

// Commission Document
export interface ICommissionDocument extends Omit<ICommission, '_id'>, Document {}

const CommissionSchema = new Schema<ICommissionDocument>(
  {
    adminId: {
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
    eventTitle: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: CommissionStatuses,
      default: 'pending',
      index: true,
    },
    totalDuesGenerated: {
      type: Number, // Amount in paise
      default: 0,
      min: 0,
    },
    adminShare: {
      type: Number, // Amount in paise (80%)
      default: 0,
      min: 0,
    },
    platformShare: {
      type: Number, // Amount in paise (20%)
      default: 0,
      min: 0,
    },
    participantsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    participantsDueCleared: {
      type: Number,
      default: 0,
      min: 0,
    },
    duePerParticipant: {
      type: Number, // Amount in paise
      default: 0,
    },
    availableAt: Date,
    withdrawnAt: Date,
    withdrawalId: {
      type: Schema.Types.ObjectId,
      ref: 'Withdrawal',
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

CommissionSchema.index({ adminId: 1, status: 1 });
CommissionSchema.index({ eventId: 1 });

export const CommissionModel = mongoose.model<ICommissionDocument>('Commission', CommissionSchema);

// Due Document
export interface IDueDocument extends Omit<IDue, '_id'>, Document {}

const DueSchema = new Schema<IDueDocument>(
  {
    userId: {
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
    eventTitle: {
      type: String,
      required: true,
    },
    amount: {
      type: Number, // Amount in paise
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'cleared'],
      default: 'pending',
      index: true,
    },
    clearedVia: {
      type: String,
      enum: ['payment', 'commission', 'referral_reward'],
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    clearedAt: Date,
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

DueSchema.index({ userId: 1, status: 1 });
DueSchema.index({ eventId: 1 });

export const DueModel = mongoose.model<IDueDocument>('Due', DueSchema);

// Payment Order Document
export interface IPaymentOrderDocument extends Omit<IPaymentOrder, '_id'>, Document {}

const PaymentOrderSchema = new Schema<IPaymentOrderDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ['clear_dues', 'event_ticket', 'withdrawal_fee'],
      required: true,
    },
    amount: {
      type: Number, // Amount in paise
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['created', 'attempted', 'paid', 'failed', 'expired'],
      default: 'created',
      index: true,
    },
    gatewayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    gatewayProvider: {
      type: String,
      enum: ['razorpay', 'cashfree'],
      required: true,
    },
    metadata: {
      dueIds: [{ type: Schema.Types.ObjectId, ref: 'Due' }],
      eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
      withdrawalId: { type: Schema.Types.ObjectId, ref: 'Withdrawal' },
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    paidAt: Date,
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

PaymentOrderSchema.index({ userId: 1, status: 1 });
PaymentOrderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for cleanup

export const PaymentOrderModel = mongoose.model<IPaymentOrderDocument>(
  'PaymentOrder',
  PaymentOrderSchema
);

