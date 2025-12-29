import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPayoutDocument extends Document {
  recipientType: 'sponsor' | 'admin'; // Who is receiving the payout
  recipientId: mongoose.Types.ObjectId; // Sponsor ID or User ID (for admin)
  amount: number; // Amount in paise
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  paymentMethod: 'bank_transfer' | 'upi' | 'neft' | 'rtgs';
  bankDetails: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  };
  transactionId?: mongoose.Types.ObjectId;
  utrNumber?: string; // UTR for bank transfers
  failureReason?: string;
  processedBy?: mongoose.Types.ObjectId; // Staff ID
  processedAt?: Date;
  metadata: {
    eventIds?: mongoose.Types.ObjectId[];
    bookingIds?: mongoose.Types.ObjectId[];
    commissionIds?: mongoose.Types.ObjectId[];
    description?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayoutModel extends Model<IPayoutDocument> {
  findByRecipient(
    recipientType: 'sponsor' | 'admin',
    recipientId: string,
    limit?: number
  ): Promise<IPayoutDocument[]>;
  findPending(limit?: number): Promise<IPayoutDocument[]>;
}

const PayoutBankDetailsSchema = new Schema(
  {
    accountHolderName: {
      type: String,
      required: true,
    },
    accountNumber: {
      type: String,
      required: true,
    },
    ifscCode: {
      type: String,
      required: true,
    },
    bankName: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const PayoutMetadataSchema = new Schema(
  {
    eventIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Event',
      },
    ],
    bookingIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Booking',
      },
    ],
    commissionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Commission',
      },
    ],
    description: String,
  },
  { _id: false }
);

const PayoutSchema = new Schema<IPayoutDocument, IPayoutModel>(
  {
    recipientType: {
      type: String,
      enum: ['sponsor', 'admin'],
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
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
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'upi', 'neft', 'rtgs'],
      required: true,
    },
    bankDetails: {
      type: PayoutBankDetailsSchema,
      required: true,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    utrNumber: {
      type: String,
      sparse: true,
      index: true,
    },
    failureReason: String,
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
    },
    processedAt: Date,
    metadata: {
      type: PayoutMetadataSchema,
      default: () => ({}),
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
PayoutSchema.index({ recipientType: 1, recipientId: 1, status: 1 });
PayoutSchema.index({ status: 1, createdAt: -1 });
PayoutSchema.index({ createdAt: -1 });
PayoutSchema.index({ processedBy: 1 });

// Static methods
PayoutSchema.statics.findByRecipient = function (
  recipientType: 'sponsor' | 'admin',
  recipientId: string,
  limit = 50
) {
  return this.find({ recipientType, recipientId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

PayoutSchema.statics.findPending = function (limit = 100) {
  return this.find({ status: { $in: ['pending', 'processing'] } })
    .sort({ createdAt: 1 })
    .limit(limit);
};

export const PayoutModel = mongoose.model<IPayoutDocument, IPayoutModel>(
  'Payout',
  PayoutSchema
);

