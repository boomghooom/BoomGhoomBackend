export * from './httpStatusCodes.js';

// Cache keys
export const CacheKeys = {
  USER: (id: string): string => `user:${id}`,
  USER_BY_PHONE: (phone: string): string => `user:phone:${phone}`,
  USER_SESSION: (userId: string): string => `session:${userId}`,
  EVENT: (id: string): string => `event:${id}`,
  EVENTS_BY_CITY: (city: string, page: number): string => `events:city:${city}:page:${page}`,
  EVENTS_NEARBY: (lat: number, lng: number, radius: number): string =>
    `events:nearby:${lat}:${lng}:${radius}`,
  KYC_STATUS: (userId: string): string => `kyc:${userId}`,
  RATE_LIMIT: (ip: string, endpoint: string): string => `ratelimit:${ip}:${endpoint}`,
  OTP: (phone: string): string => `otp:${phone}`,
  OTP_ATTEMPTS: (phone: string): string => `otp:attempts:${phone}`,
  REFRESH_TOKEN: (token: string): string => `refresh:${token}`,
  ONLINE_USERS: 'online:users',
  CHAT_ROOM: (roomId: string): string => `chat:room:${roomId}`,
} as const;

// Cache TTL (in seconds)
export const CacheTTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 900, // 15 minutes
  HOUR: 3600, // 1 hour
  DAY: 86400, // 24 hours
  WEEK: 604800, // 7 days
  OTP: 300, // 5 minutes
  SESSION: 604800, // 7 days
  REFRESH_TOKEN: 604800, // 7 days
} as const;

// Event categories
export const EventCategories = [
  'sports',
  'music',
  'food',
  'travel',
  'games',
  'movies',
  'art',
  'tech',
  'fitness',
  'nightlife',
  'outdoor',
  'learning',
  'networking',
  'other',
] as const;

export type EventCategory = (typeof EventCategories)[number];

// Event types
export const EventTypes = ['sponsored', 'user_created'] as const;
export type EventType = (typeof EventTypes)[number];

// Event status
export const EventStatuses = ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'] as const;
export type EventStatus = (typeof EventStatuses)[number];

// Gender
export const Genders = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
export type Gender = (typeof Genders)[number];

// KYC status
export const KYCStatuses = ['not_started', 'pending', 'approved', 'rejected'] as const;
export type KYCStatus = (typeof KYCStatuses)[number];

// Transaction types
export const TransactionTypes = [
  'due_added',
  'due_cleared',
  'commission_earned',
  'commission_available',
  'withdrawal_requested',
  'withdrawal_completed',
  'withdrawal_failed',
  'referral_reward',
  'event_payment',
  'refund',
] as const;
export type TransactionType = (typeof TransactionTypes)[number];

// Transaction status
export const TransactionStatuses = ['pending', 'completed', 'failed', 'cancelled'] as const;
export type TransactionStatus = (typeof TransactionStatuses)[number];

// Payment methods
export const PaymentMethods = ['upi', 'card', 'netbanking', 'wallet', 'commission'] as const;
export type PaymentMethod = (typeof PaymentMethods)[number];

// Commission status
export const CommissionStatuses = ['pending', 'available', 'withdrawn'] as const;
export type CommissionStatus = (typeof CommissionStatuses)[number];

// Friend request status
export const FriendRequestStatuses = ['pending', 'accepted', 'rejected', 'blocked'] as const;
export type FriendRequestStatus = (typeof FriendRequestStatuses)[number];

// Notification types
export const NotificationTypes = [
  'event_join_request',
  'event_join_approved',
  'event_join_rejected',
  'event_reminder',
  'event_update',
  'event_cancelled',
  'event_completed',
  'friend_request',
  'friend_accepted',
  'friend_event_created',
  'message_received',
  'due_reminder',
  'commission_available',
  'withdrawal_completed',
  'kyc_approved',
  'kyc_rejected',
  'referral_reward',
  'system',
] as const;
export type NotificationType = (typeof NotificationTypes)[number];

// Participation status
export const ParticipationStatuses = [
  'pending_approval',
  'approved',
  'rejected',
  'leave_requested',
  'left',
  'removed',
] as const;
export type ParticipationStatus = (typeof ParticipationStatuses)[number];

// Message types
export const MessageTypes = ['text', 'image', 'event_share', 'system'] as const;
export type MessageType = (typeof MessageTypes)[number];

// Report reasons
export const ReportReasons = [
  'spam',
  'inappropriate_content',
  'harassment',
  'fake_event',
  'scam',
  'other',
] as const;
export type ReportReason = (typeof ReportReasons)[number];

// Supported cities (can be expanded)
export const SupportedCities = [
  { name: 'Mumbai', state: 'Maharashtra', country: 'India', coordinates: [72.8777, 19.076] },
  { name: 'Delhi', state: 'Delhi', country: 'India', coordinates: [77.1025, 28.7041] },
  { name: 'Bangalore', state: 'Karnataka', country: 'India', coordinates: [77.5946, 12.9716] },
  { name: 'Hyderabad', state: 'Telangana', country: 'India', coordinates: [78.4867, 17.385] },
  { name: 'Chennai', state: 'Tamil Nadu', country: 'India', coordinates: [80.2707, 13.0827] },
  { name: 'Kolkata', state: 'West Bengal', country: 'India', coordinates: [88.3639, 22.5726] },
  { name: 'Pune', state: 'Maharashtra', country: 'India', coordinates: [73.8567, 18.5204] },
  { name: 'Ahmedabad', state: 'Gujarat', country: 'India', coordinates: [72.5714, 23.0225] },
  { name: 'Jaipur', state: 'Rajasthan', country: 'India', coordinates: [75.7873, 26.9124] },
  { name: 'Lucknow', state: 'Uttar Pradesh', country: 'India', coordinates: [80.9462, 26.8467] },
  { name: 'Goa', state: 'Goa', country: 'India', coordinates: [74.124, 15.2993] },
  { name: 'Chandigarh', state: 'Chandigarh', country: 'India', coordinates: [76.7794, 30.7333] },
] as const;

// Pagination defaults
export const PaginationDefaults = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// File upload limits
export const FileUploadLimits = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILES: 10,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
} as const;

// Distance units (in meters)
export const DistanceUnits = {
  KM_TO_METERS: 1000,
  MILE_TO_METERS: 1609.34,
  DEFAULT_SEARCH_RADIUS: 10000, // 10km
  MAX_SEARCH_RADIUS: 50000, // 50km
} as const;

