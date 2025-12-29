import mongoose, { Schema, Document, Model } from 'mongoose';
import { nanoid } from 'nanoid';
import { EventCategory } from '../../../shared/constants/index.js';


export interface ISponsorDocument extends Document {
  companyName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: 'sponsor' | 'sponsor_manager' | 'finance';
  eventCategory: EventCategory[];
  contactPerson: {
    name: string;
    designation: string;
    phoneNumber: string;
  };
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  businessDetails: {
    gstin?: string;
    pan?: string;
    registrationNumber?: string;
    businessType: string; // 'sole_proprietorship' | 'partnership' | 'llp' | 'private_limited' | 'public_limited'
  };
  bankDetails: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    isVerified: boolean;
  };
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  isActive: boolean;
  commissionRate: number; // Percentage (0-100)
  bookingCharge: number; // Amount in paise (10-20 Rs = 1000-2000 paise)
  logoUrl?: string;
  websiteUrl?: string;
  description?: string;
  totalEventsCreated: number;
  totalBookings: number;
  totalRevenue: number; // Amount in paise
  totalPayouts: number; // Amount in paise
  pendingPayout: number; // Amount in paise
  rejectedAt?: Date;
  rejectionReason?: string;
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId; // Staff ID
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface ISponsorModel extends Model<ISponsorDocument> {
  findByEmail(email: string): Promise<ISponsorDocument | null>;
  findByPhone(phoneNumber: string): Promise<ISponsorDocument | null>;
}

const SponsorContactPersonSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const SponsorAddressSchema = new Schema(
  {
    street: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      default: 'India',
    },
  },
  { _id: false }
);

const SponsorBusinessDetailsSchema = new Schema(
  {
    gstin: {
      type: String,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    pan: {
      type: String,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      sparse: true,
      trim: true,
    },
    businessType: {
      type: String,
      enum: ['sole_proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited'],
      required: true,
    },
  },
  { _id: false }
);

const SponsorBankDetailsSchema = new Schema(
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
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const SponsorSchema = new Schema<ISponsorDocument, ISponsorModel>(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    contactPerson: {
      type: SponsorContactPersonSchema,
      required: true,
    },
    address: {
      type: SponsorAddressSchema,
      required: true,
    },
    businessDetails: {
      type: SponsorBusinessDetailsSchema,
      required: true,
    },
    bankDetails: {
      type: SponsorBankDetailsSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    commissionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    bookingCharge: {
      type: Number,
      default: 1500, // 15 Rs default
      min: 1000, // 10 Rs minimum
      max: 2000, // 20 Rs maximum
    },
    logoUrl: String,
    websiteUrl: String,
    description: {
      type: String,
      maxlength: 1000,
    },
    totalEventsCreated: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalBookings: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPayouts: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingPayout: {
      type: Number,
      default: 0,
      min: 0,
    },
    rejectedAt: Date,
    rejectionReason: String,
    approvedAt: Date,
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
    },
    lastLoginAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        if ('password' in ret) delete ret.password;
        if ('__v' in ret) delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
SponsorSchema.index({ status: 1, isActive: 1 });
SponsorSchema.index({ createdAt: -1 });
SponsorSchema.index({ 'address.city': 1 });

// Pre-save hook to hash password
SponsorSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const bcrypt = await import('bcryptjs');
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
SponsorSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(candidatePassword, this.password);
};

// Static methods
SponsorSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

SponsorSchema.statics.findByPhone = function (phoneNumber: string) {
  return this.findOne({ phoneNumber, isActive: true });
};

export const SponsorModel = mongoose.model<ISponsorDocument, ISponsorModel>(
  'Sponsor',
  SponsorSchema
);

