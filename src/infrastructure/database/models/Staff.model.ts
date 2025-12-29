import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IStaffDocument extends Document {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: 'super_admin' | 'admin' | 'moderator' | 'support' | 
  'event_manager' | 'sponsor_manager' | 'finance_manager';
  permissions: {
    canManageUsers: boolean;
    canManageEvents: boolean;
    canManageSponsors: boolean;
    canManageStaff: boolean;
    canViewReports: boolean;
    canProcessPayouts: boolean;
    canVerifyPasses: boolean;
  };
  isActive: boolean;
  lastLoginAt?: Date;
  createdBy?: mongoose.Types.ObjectId; // Staff ID
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IStaffModel extends Model<IStaffDocument> {
  findByEmail(email: string): Promise<IStaffDocument | null>;
  findByPhone(phoneNumber: string): Promise<IStaffDocument | null>;
}

const StaffPermissionsSchema = new Schema(
  {
    canManageUsers: {
      type: Boolean,
      default: false,
    },
    canManageEvents: {
      type: Boolean,
      default: false,
    },
    canManageSponsors: {
      type: Boolean,
      default: false,
    },
    canManageStaff: {
      type: Boolean,
      default: false,
    },
    canViewReports: {
      type: Boolean,
      default: false,
    },
    canProcessPayouts: {
      type: Boolean,
      default: false,
    },
    canVerifyPasses: {
      type: Boolean,
      default: true, // All staff can verify passes
    },
  },
  { _id: false }
);

const StaffSchema = new Schema<IStaffDocument, IStaffModel>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
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
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'moderator', 'support'],
      required: true,
      index: true,
    },
    permissions: {
      type: StaffPermissionsSchema,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: Date,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
    },
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
StaffSchema.index({ role: 1, isActive: 1 });
StaffSchema.index({ createdAt: -1 });

// Pre-save hook to hash password
StaffSchema.pre('save', async function (next) {
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
StaffSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Static methods
StaffSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

StaffSchema.statics.findByPhone = function (phoneNumber: string) {
  return this.findOne({ phoneNumber, isActive: true });
};

export const StaffModel = mongoose.model<IStaffDocument, IStaffModel>('Staff', StaffSchema);

