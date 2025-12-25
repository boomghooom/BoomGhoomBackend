import { z } from 'zod';
import { EventCategories, EventTypes, Genders, EventStatuses } from '../../shared/constants/index.js';

export const createEventSchema = z.object({
  type: z.enum(EventTypes),
  category: z.enum(EventCategories),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(150, 'Title must be less than 150 characters'),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(5000, 'Description must be less than 5000 characters'),
  location: z.object({
    /**
     * Latitude in decimal degrees (WGS84)
     * Range: -90 to 90
     * Example: 19.0760 (Mumbai)
     */
    latitude: z.number().min(-90).max(90),
    /**
     * Longitude in decimal degrees (WGS84)
     * Range: -180 to 180
     * Example: 72.8777 (Mumbai)
     * 
     * NOTE: Internally stored as [longitude, latitude] array following GeoJSON standard
     */
    longitude: z.number().min(-180).max(180),
    address: z.string().min(5, 'Address is required'),
    venueName: z.string().min(2, 'Venue name is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().optional(),
    landmark: z.string().optional(),
  }),
  startTime: z.coerce.date().refine((date) => date > new Date(), {
    message: 'Start time must be in the future',
  }),
  endTime: z.coerce.date(),
  imageUrls: z.array(z.string().url()).max(10).optional(),
  coverImageUrl: z.string().url().optional(),
  eligibility: z.object({
    genderAllowed: z.array(z.enum(Genders)).default(['male', 'female', 'other', 'prefer_not_to_say']),
    minAge: z.number().int().min(13).max(100).default(18),
    maxAge: z.number().int().min(13).max(100).default(100),
    maxDistance: z.number().positive().optional(),
    memberLimit: z.number().int().min(2).max(1000),
    requiresApproval: z.boolean().default(true),
  }),
  pricing: z
    .object({
      isFree: z.boolean().default(true),
      price: z.number().int().min(0).optional(),
      currency: z.string().default('INR'),
      includesGST: z.boolean().default(true),
    })
    .optional(),
  rules: z.array(z.string().max(500)).max(20).optional(),
}).refine((data) => data.endTime > data.startTime, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const updateEventSchema = z.object({
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(150, 'Title must be less than 150 characters')
    .optional(),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(5000, 'Description must be less than 5000 characters')
    .optional(),
  location: z
    .object({
      /**
       * Latitude in decimal degrees (WGS84)
       * Range: -90 to 90
       */
      latitude: z.number().min(-90).max(90),
      /**
       * Longitude in decimal degrees (WGS84)
       * Range: -180 to 180
       * NOTE: Internally stored as [longitude, latitude] array following GeoJSON standard
       */
      longitude: z.number().min(-180).max(180),
      address: z.string().min(5),
      venueName: z.string().min(2),
      city: z.string().min(1),
      state: z.string().optional(),
      landmark: z.string().optional(),
    })
    .optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  imageUrls: z.array(z.string().url()).max(10).optional(),
  coverImageUrl: z.string().url().optional(),
  eligibility: z
    .object({
      genderAllowed: z.array(z.enum(Genders)).optional(),
      minAge: z.number().int().min(13).max(100).optional(),
      maxAge: z.number().int().min(13).max(100).optional(),
      maxDistance: z.number().positive().optional(),
      memberLimit: z.number().int().min(2).max(1000).optional(),
      requiresApproval: z.boolean().optional(),
    })
    .optional(),
  pricing: z
    .object({
      isFree: z.boolean().optional(),
      price: z.number().int().min(0).optional(),
      currency: z.string().optional(),
      includesGST: z.boolean().optional(),
    })
    .optional(),
  rules: z.array(z.string().max(500)).max(20).optional(),
});

export const eventFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: z.enum(EventCategories).optional(),
  type: z.enum(EventTypes).optional(),
  status: z.enum(EventStatuses).optional(),
  city: z.string().optional(),
  /**
   * Latitude in decimal degrees (WGS84)
   * Range: -90 to 90
   */
  latitude: z.coerce.number().min(-90).max(90).optional(),
  /**
   * Longitude in decimal degrees (WGS84)
   * Range: -180 to 180
   * NOTE: When used in queries, coordinates are stored as [longitude, latitude] following GeoJSON standard
   */
  longitude: z.coerce.number().min(-180).max(180).optional(),
  maxDistance: z.coerce.number().positive().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  isFree: z.coerce.boolean().optional(),
  sortBy: z.enum(['startTime', 'distance', 'createdAt', 'participantCount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const cancelEventSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
});

export const rejectJoinSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const bulkInviteSchema = z.object({
  recipientIds: z.array(z.string()).min(1).max(100),
  message: z.string().max(200).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventFiltersInput = z.infer<typeof eventFiltersSchema>;
export type CancelEventInput = z.infer<typeof cancelEventSchema>;
export type RejectJoinInput = z.infer<typeof rejectJoinSchema>;
export type BulkInviteInput = z.infer<typeof bulkInviteSchema>;

