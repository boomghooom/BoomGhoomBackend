import { z } from 'zod';

const phoneRegex = /^[6-9]\d{9}$/;

export const signupSchema = z.object({
  phoneNumber: z
    .string()
    .regex(phoneRegex, 'Invalid Indian phone number')
    .transform((val) => val.trim()),
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .transform((val) => val.trim()),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(50, 'Password must be less than 50 characters'),
  email: z.string().email('Invalid email').optional(),
  referralCode: z.string().length(8, 'Invalid referral code').optional(),
});

export const loginSchema = z.object({
  phoneNumber: z
    .string()
    .regex(phoneRegex, 'Invalid Indian phone number')
    .transform((val) => val.trim()),
  password: z.string().min(1, 'Password is required'),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
});

export const appleAuthSchema = z.object({
  identityToken: z.string().min(1, 'Identity token is required'),
  authorizationCode: z.string().min(1, 'Authorization code is required'),
  fullName: z
    .object({
      givenName: z.string().optional(),
      familyName: z.string().optional(),
    })
    .optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(6, 'New password must be at least 6 characters')
    .max(50, 'Password must be less than 50 characters'),
});

export const updatePhoneSchema = z.object({
  newPhoneNumber: z
    .string()
    .regex(phoneRegex, 'Invalid Indian phone number')
    .transform((val) => val.trim()),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type AppleAuthInput = z.infer<typeof appleAuthSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdatePhoneInput = z.infer<typeof updatePhoneSchema>;

