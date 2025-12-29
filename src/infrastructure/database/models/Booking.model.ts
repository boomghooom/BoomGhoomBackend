import mongoose, { Schema, Document, Model } from 'mongoose';
import { nanoid } from 'nanoid';

export interface IBookingDocument extends Document {
  bookingId: string; // Human readable: "BG-2024-ABC123"
  userId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  sponsorId?: mongoose.Types.ObjectId; // Denormalized for quick queries

  // Ticket Details
  tickets: Array<{
    type: string; // "general", "vip", "premium", etc.
    name: string;
    quantity: number;
    pricePerTicket: number; // Base price in paise
    platformFeePerTicket: number; // Platform fee in paise
    subtotal: number; // (pricePerTicket + platformFeePerTicket) * quantity in paise
  }>;

  // Pricing Breakdown
  pricing: {
    subtotal: number; // Sum of all ticket subtotals in paise
    gst: number; // GST amount in paise (18%)
    convenienceFee: number; // Additional convenience fee in paise
    discount: number; // Discount amount in paise
    couponCode?: string;
    totalAmount: number; // Final total in paise
  };

  // Payment Details
  payment: {
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    method: 'razorpay' | 'cashfree' | 'upi' | 'card' | 'netbanking' | 'wallet';
    transactionId?: mongoose.Types.ObjectId;
    paidAt?: Date;
  };

  // Booking Status
  status: 'confirmed' | 'cancelled' | 'attended' | 'no_show';
  qrCode: string; // Unique QR code string
  checkedInAt?: Date;

  // Refund Details
  refund: {
    requested: boolean;
    requestedAt?: Date;
    reason?: string;
    status: 'pending' | 'approved' | 'rejected' | 'processed';
    amount?: number; // Refund amount in paise
    processedAt?: Date;
  };

  // Pass reference (for backward compatibility)
  passId?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export interface IBookingModel extends Model<IBookingDocument> {
  findByUser(userId: string, limit?: number): Promise<IBookingDocument[]>;
  findByEvent(eventId: string): Promise<IBookingDocument[]>;
  findBySponsor(sponsorId: string, limit?: number): Promise<IBookingDocument[]>;
  findByBookingId(bookingId: string): Promise<IBookingDocument | null>;
  findByQRCode(qrCode: string): Promise<IBookingDocument | null>;
}

const BookingTicketSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    pricePerTicket: {
      type: Number, // Amount in paise
      required: true,
      min: 0,
    },
    platformFeePerTicket: {
      type: Number, // Amount in paise
      required: true,
      min: 0,
    },
    subtotal: {
      type: Number, // Amount in paise
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const BookingPricingSchema = new Schema(
  {
    subtotal: {
      type: Number, // Amount in paise
      required: true,
      min: 0,
    },
    gst: {
      type: Number, // Amount in paise (18%)
      required: true,
      min: 0,
      default: 0,
    },
    convenienceFee: {
      type: Number, // Amount in paise
      required: true,
      min: 0,
      default: 0,
    },
    discount: {
      type: Number, // Amount in paise
      required: true,
      min: 0,
      default: 0,
    },
    couponCode: String,
    totalAmount: {
      type: Number, // Amount in paise
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const BookingPaymentSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
      required: true,
    },
    method: {
      type: String,
      enum: ['razorpay', 'cashfree', 'upi', 'card', 'netbanking', 'wallet'],
      required: true,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    paidAt: Date,
  },
  { _id: false }
);

const BookingRefundSchema = new Schema(
  {
    requested: {
      type: Boolean,
      default: false,
    },
    requestedAt: Date,
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'processed'],
    },
    amount: {
      type: Number, // Amount in paise
      min: 0,
    },
    processedAt: Date,
  },
  { _id: false }
);

const BookingSchema = new Schema<IBookingDocument, IBookingModel>(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => {
        const year = new Date().getFullYear();
        const random = nanoid(6).toUpperCase();
        return `BG-${year}-${random}`;
      },
    },
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
    sponsorId: {
      type: Schema.Types.ObjectId,
      ref: 'Sponsor',
      index: true,
    },
    tickets: {
      type: [BookingTicketSchema],
      required: true,
      validate: {
        validator: (tickets: unknown[]) => tickets.length > 0,
        message: 'At least one ticket is required',
      },
    },
    pricing: {
      type: BookingPricingSchema,
      required: true,
    },
    payment: {
      type: BookingPaymentSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled', 'attended', 'no_show'],
      default: 'confirmed',
      index: true,
    },
    qrCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => nanoid(16),
    },
    checkedInAt: Date,
    refund: {
      type: BookingRefundSchema,
      default: () => ({
        requested: false,
        status: 'pending',
      }),
    },
    passId: {
      type: Schema.Types.ObjectId,
      ref: 'Pass',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        if ('__v' in ret) {
          const { __v, ...rest } = ret;
          return rest;
        }
        return ret;
      },
    },
  }
);

// Indexes
BookingSchema.index({ userId: 1, status: 1, createdAt: -1 });
BookingSchema.index({ eventId: 1, status: 1 });
BookingSchema.index({ sponsorId: 1, status: 1, createdAt: -1 });
BookingSchema.index({ bookingId: 1 });
BookingSchema.index({ qrCode: 1 });
BookingSchema.index({ 'payment.status': 1 });
BookingSchema.index({ 'refund.status': 1 });
BookingSchema.index({ createdAt: -1 });

// Static methods
BookingSchema.statics.findByUser = function (userId: string, limit = 50) {
  return this.find({ userId })
    .populate('eventId', 'title startTime location')
    .populate('passId', 'passCode qrCodeUrl')
    .sort({ createdAt: -1 })
    .limit(limit);
};

BookingSchema.statics.findByEvent = function (eventId: string) {
  return this.find({ eventId, status: 'confirmed' })
    .populate('userId', 'fullName phoneNumber email')
    .populate('passId', 'passCode qrCodeUrl')
    .sort({ createdAt: -1 });
};

BookingSchema.statics.findBySponsor = function (sponsorId: string, limit = 100) {
  return this.find({ sponsorId })
    .populate('eventId', 'title startTime')
    .populate('userId', 'fullName phoneNumber')
    .sort({ createdAt: -1 })
    .limit(limit);
};

BookingSchema.statics.findByBookingId = function (bookingId: string) {
  return this.findOne({ bookingId })
    .populate('eventId')
    .populate('userId', 'fullName phoneNumber email')
    .populate('passId');
};

BookingSchema.statics.findByQRCode = function (qrCode: string) {
  return this.findOne({ qrCode })
    .populate('eventId', 'title startTime location')
    .populate('userId', 'fullName phoneNumber email');
};

export const BookingModel = mongoose.model<IBookingDocument, IBookingModel>(
  'Booking',
  BookingSchema
);
