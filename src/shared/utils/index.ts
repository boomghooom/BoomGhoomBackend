export * from './logger.js';
export * from './response.js';

// Utility functions

/**
 * Format amount from paise to rupees string
 */
export const formatMoney = (amountInPaise: number, currency = 'INR'): string => {
  const amount = amountInPaise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

/**
 * Calculate age from date of birth
 */
export const calculateAge = (dateOfBirth: Date): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Generate random alphanumeric string
 */
export const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Sleep utility for async operations
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Retry utility for operations that may fail
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await sleep(delayMs * attempt);
      }
    }
  }
  throw lastError;
};

/**
 * Sanitize string for safe display
 */
export const sanitizeString = (str: string): string => {
  return str
    .replace(/[<>]/g, '')
    .replace(/&/g, '&amp;')
    .trim();
};

/**
 * Parse Indian phone number
 */
export const parseIndianPhone = (phone: string): string => {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If starts with 91, remove it
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return cleaned.substring(2);
  }
  
  // If starts with +91, it would have been removed, check length
  if (cleaned.length === 10) {
    return cleaned;
  }
  
  throw new Error('Invalid Indian phone number');
};

/**
 * Mask sensitive data for logging
 */
export const maskSensitive = (data: string, visibleChars = 4): string => {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }
  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  const masked = '*'.repeat(data.length - visibleChars * 2);
  return `${start}${masked}${end}`;
};

/**
 * Check if a date is in the past
 */
export const isPast = (date: Date): boolean => {
  return new Date(date) < new Date();
};

/**
 * Check if a date is in the future
 */
export const isFuture = (date: Date): boolean => {
  return new Date(date) > new Date();
};

/**
 * Get time difference in minutes
 */
export const getMinutesDifference = (date1: Date, date2: Date): number => {
  const diffMs = Math.abs(new Date(date1).getTime() - new Date(date2).getTime());
  return Math.floor(diffMs / (1000 * 60));
};

/**
 * Check if user is within allowed window (e.g., leave request)
 */
export const isWithinWindow = (startTime: Date, windowMinutes: number): boolean => {
  const windowEnd = new Date(new Date(startTime).getTime() + windowMinutes * 60 * 1000);
  return new Date() <= windowEnd;
};

