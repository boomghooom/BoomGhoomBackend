import { Gender, KYCStatus } from '../../shared/constants/index.js';

export interface IUserLocation {
  type: 'Point';
  /**
   * GeoJSON coordinates array: [longitude, latitude]
   * 
   * IMPORTANT: Format is [longitude, latitude] NOT [latitude, longitude]
   * This follows the GeoJSON and MongoDB 2dsphere standard.
   * 
   * @example [72.8777, 19.076] represents Mumbai (longitude: 72.8777, latitude: 19.076)
   * @example coordinates[0] = longitude, coordinates[1] = latitude
   */
  coordinates: [number, number];
  city: string;
  state?: string;
  country: string;
}

export interface IUserKYC {
  status: KYCStatus;
  selfieUrl?: string;
  documentUrl?: string;
  documentType?: 'aadhaar' | 'pan' | 'driving_license' | 'passport';
  verifiedAt?: Date;
  rejectionReason?: string;
  submittedAt?: Date;
}

export interface IUserFinance {
  dues: number; // Amount in paise
  pendingCommission: number; // Amount in paise
  availableCommission: number; // Amount in paise
  totalEarned: number; // Amount in paise
  totalWithdrawn: number; // Amount in paise
}

export interface IUserStats {
  eventsJoined: number;
  eventsCreated: number;
  eventsCompleted: number;
  friendsCount: number;
  averageRating: number;
  totalRatings: number;
}

export interface IBankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  isVerified: boolean;
}

export interface IUser {
  _id: string;
  phoneNumber: string;
  email?: string;
  password?: string; // Hashed - only for phone+password auth
  fullName: string;
  displayName?: string;
  avatarUrl?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  bio?: string;
  location?: IUserLocation;
  kyc: IUserKYC;
  finance: IUserFinance;
  stats: IUserStats;
  bankDetails?: IBankDetails;
  referralCode: string;
  referredBy?: string; // User ID who referred this user
  authProvider: 'phone' | 'google' | 'apple';
  googleId?: string;
  appleId?: string;
  fcmTokens: string[]; // Firebase Cloud Messaging tokens for push notifications
  isOnline: boolean;
  lastActiveAt?: Date;
  isBlocked: boolean;
  blockedReason?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserSummary {
  _id: string;
  fullName: string;
  displayName?: string;
  avatarUrl?: string;
  gender?: Gender;
  isOnline: boolean;
  kycVerified: boolean;
  averageRating: number;
}

export interface ICreateUserDTO {
  phoneNumber: string;
  fullName: string;
  password?: string;
  email?: string;
  gender?: string;
  fcmTokens?: string[];
  authProvider: 'phone' | 'google' | 'apple';
  googleId?: string;
  appleId?: string;
  referredBy?: string;
}

export interface IUpdateUserDTO {
  fullName?: string;
  displayName?: string;
  avatarUrl?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  bio?: string;
  location?: IUserLocation;
  email?: string;
  bankDetails?: IBankDetails;
}

export interface IUserQuery {
  phoneNumber?: string;
  email?: string;
  googleId?: string;
  appleId?: string;
  city?: string;
  isBlocked?: boolean;
  isDeleted?: boolean;
}

