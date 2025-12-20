import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../../config/redis.js';
import { config } from '../../config/index.js';
import { TooManyRequestsError } from '../../shared/errors/AppError.js';

// General rate limiter
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many requests, please try again later'));
  },
  skip: () => config.isTest,
});

// Auth rate limiter (stricter)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body?.phoneNumber || req.ip || 'unknown';
  },
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many authentication attempts. Please try again later.'));
  },
  skip: () => config.isTest,
});

// OTP rate limiter
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 OTP requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body?.phoneNumber || req.ip || 'unknown';
  },
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many OTP requests. Please try again later.'));
  },
  skip: () => config.isTest,
});

// API rate limiter (for heavy endpoints)
export const heavyOperationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many requests. Please slow down.'));
  },
  skip: () => config.isTest,
});

// Create Redis-backed rate limiter for production
export const createRedisRateLimiter = (options: {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}): ReturnType<typeof rateLimit> => {
  if (config.isTest || config.isDevelopment) {
    return rateLimit({
      windowMs: options.windowMs,
      max: options.max,
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient.getClient().call(...args) as Promise<unknown>,
      prefix: options.keyPrefix || 'rl:',
    }),
    handler: (_req, _res, next) => {
      next(new TooManyRequestsError('Too many requests. Please try again later.'));
    },
  });
};

