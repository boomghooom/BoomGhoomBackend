import mongoose, { Schema, Document, Model } from 'mongoose';
import { nanoid } from 'nanoid';

export interface IPassDocument extends Document {
  passCode: string; // Unique pass code for verification
  bookingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  sponsorId?: mongoose.Types.ObjectId; // If sponsored event
  qrCodeUrl: string; // URL to QR code image
  qrCodeData: string; // QR code data (JSON stringified)
  status: 'active' | 'used' | 'cancelled' | 'expired';
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId; // Staff ID or Sponsor ID
  verifiedByType?: 'staff' | 'sponsor';
  eventDetails: {
    title: string;
    startTime: Date;
    endTime: Date;
    venueName: string;
    address: string;
    city: string;
  };
  userDetails: {
    name: string;
    phoneNumber: string;
    email?: string;
  };
  bookingDetails: {
    bookingId: string;
    ticketCount: number;
    bookingDate: Date;
  };
  expiresAt?: Date; // Pass expires after event end time
  createdAt: Date;
  updatedAt: Date;
}

export interface IPassModel extends Model<IPassDocument> {
  findByPassCode(passCode: string): Promise<IPassDocument | null>;
  findByBooking(bookingId: string): Promise<IPassDocument | null>;
  findByUser(userId: string, limit?: number): Promise<IPassDocument[]>;
  findByEvent(eventId: string): Promise<IPassDocument[]>;
}

const PassEventDetailsSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    venueName: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const PassUserDetailsSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    email: String,
  },
  { _id: false }
);

const PassBookingDetailsSchema = new Schema(
  {
    bookingId: {
      type: String,
      required: true,
    },
    ticketCount: {
      type: Number,
      required: true,
    },
    bookingDate: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const PassSchema = new Schema<IPassDocument, IPassModel>(
  {
    passCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `PASS${nanoid(12).toUpperCase()}`,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
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
    qrCodeUrl: {
      type: String,
      required: true,
    },
    qrCodeData: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'used', 'cancelled', 'expired'],
      default: 'active',
      index: true,
    },
    verifiedAt: Date,
    verifiedBy: {
      type: Schema.Types.ObjectId,
      refPath: 'verifiedByType',
    },
    verifiedByType: {
      type: String,
      enum: ['staff', 'sponsor'],
    },
    eventDetails: {
      type: PassEventDetailsSchema,
      required: true,
    },
    userDetails: {
      type: PassUserDetailsSchema,
      required: true,
    },
    bookingDetails: {
      type: PassBookingDetailsSchema,
      required: true,
    },
    expiresAt: Date,
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
PassSchema.index({ passCode: 1 });
PassSchema.index({ bookingId: 1 });
PassSchema.index({ userId: 1, status: 1, createdAt: -1 });
PassSchema.index({ eventId: 1, status: 1 });
PassSchema.index({ sponsorId: 1, status: 1 });
PassSchema.index({ status: 1, expiresAt: 1 });
PassSchema.index({ createdAt: -1 });

// Static methods
PassSchema.statics.findByPassCode = function (passCode: string) {
  return this.findOne({ passCode })
    .populate('eventId', 'title startTime endTime location')
    .populate('userId', 'fullName phoneNumber email')
    .populate('bookingId', 'bookingId ticketCount');
};

PassSchema.statics.findByBooking = function (bookingId: string) {
  return this.findOne({ bookingId })
    .populate('eventId')
    .populate('userId');
};

PassSchema.statics.findByUser = function (userId: string, limit = 50) {
  return this.find({ userId })
    .populate('eventId', 'title startTime location')
    .sort({ createdAt: -1 })
    .limit(limit);
};

PassSchema.statics.findByEvent = function (eventId: string) {
  return this.find({ eventId, status: 'active' })
    .populate('userId', 'fullName phoneNumber')
    .sort({ createdAt: -1 });
};

export const PassModel = mongoose.model<IPassDocument, IPassModel>('Pass', PassSchema);

