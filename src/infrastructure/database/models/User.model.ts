import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { IUser } from '../../../domain/entities/User.js';
import { Genders, KYCStatuses } from '../../../shared/constants/index.js';

export interface IUserDocument extends Omit<IUser, '_id'>, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  toSummary(): {
    _id: string;
    fullName: string;
    displayName?: string;
    avatarUrl?: string;
    gender?: string;
    isOnline: boolean;
    kycVerified: boolean;
    averageRating: number;
  };
}

export interface IUserModel extends Model<IUserDocument> {
  findByPhone(phoneNumber: string): Promise<IUserDocument | null>;
  findByEmail(email: string): Promise<IUserDocument | null>;
  findByGoogleId(googleId: string): Promise<IUserDocument | null>;
  findByAppleId(appleId: string): Promise<IUserDocument | null>;
}

const UserLocationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      index: '2dsphere',
    },
    city: {
      type: String,
      required: true,
      index: true,
    },
    state: String,
    country: {
      type: String,
      required: true,
      default: 'India',
    },
  },
  { _id: false }
);

const UserKYCSchema = new Schema(
  {
    status: {
      type: String,
      enum: KYCStatuses,
      default: 'not_started',
      index: true,
    },
    selfieUrl: String,
    documentUrl: String,
    documentType: {
      type: String,
      enum: ['aadhaar', 'pan', 'driving_license', 'passport'],
    },
    verifiedAt: Date,
    rejectionReason: String,
    submittedAt: Date,
  },
  { _id: false }
);

const UserFinanceSchema = new Schema(
  {
    dues: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingCommission: {
      type: Number,
      default: 0,
      min: 0,
    },
    availableCommission: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const UserStatsSchema = new Schema(
  {
    eventsJoined: {
      type: Number,
      default: 0,
      min: 0,
    },
    eventsCreated: {
      type: Number,
      default: 0,
      min: 0,
    },
    eventsCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    friendsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const BankDetailsSchema = new Schema(
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

const UserSchema = new Schema<IUserDocument, IUserModel>(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    email: {
      type: String,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      select: false, // Don't include password by default
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    avatarUrl: String,
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: Genders,
    },
    bio: {
      type: String,
      maxlength: 500,
    },
    location: UserLocationSchema,
    kyc: {
      type: UserKYCSchema,
      default: () => ({ status: 'not_started' }),
    },
    finance: {
      type: UserFinanceSchema,
      default: () => ({}),
    },
    stats: {
      type: UserStatsSchema,
      default: () => ({}),
    },
    bankDetails: BankDetailsSchema,
    referralCode: {
      type: String,
      unique: true,
      index: true,
      default: () => nanoid(8).toUpperCase(),
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    authProvider: {
      type: String,
      enum: ['phone', 'google', 'apple'],
      required: true,
      default: 'phone',
    },
    googleId: {
      type: String,
      sparse: true,
      index: true,
    },
    appleId: {
      type: String,
      sparse: true,
      index: true,
    },
    fcmTokens: {
      type: [String],
      default: [],
    },
    isOnline: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastActiveAt: Date,
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    blockedReason: String,
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Compound indexes
UserSchema.index({ 'location.coordinates': '2dsphere' });
UserSchema.index({ 'location.city': 1, isDeleted: 1, isBlocked: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ 'kyc.status': 1 });

// Pre-save hook to hash password
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to get user summary
UserSchema.methods.toSummary = function () {
  return {
    _id: this._id.toString(),
    fullName: this.fullName,
    displayName: this.displayName,
    avatarUrl: this.avatarUrl,
    gender: this.gender,
    isOnline: this.isOnline,
    kycVerified: this.kyc?.status === 'approved',
    averageRating: this.stats?.averageRating || 0,
  };
};

// Static methods
UserSchema.statics.findByPhone = function (phoneNumber: string) {
  return this.findOne({ phoneNumber, isDeleted: false });
};

UserSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase(), isDeleted: false });
};

UserSchema.statics.findByGoogleId = function (googleId: string) {
  return this.findOne({ googleId, isDeleted: false });
};

UserSchema.statics.findByAppleId = function (appleId: string) {
  return this.findOne({ appleId, isDeleted: false });
};

export const UserModel = mongoose.model<IUserDocument, IUserModel>('User', UserSchema);

