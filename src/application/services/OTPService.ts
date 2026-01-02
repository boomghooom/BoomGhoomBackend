import axios from 'axios';
import { config } from '../../config/index.js';
import { redisClient } from '../../config/redis.js';
import { CacheKeys } from '../../shared/constants/index.js';
import { BadRequestError, TooManyRequestsError } from '../../shared/errors/AppError.js';
import { logger, logWithContext } from '../../shared/utils/logger.js';

export interface IPendingSignupData {
  phoneNumber: string;
  fullName: string;
  password: string;
  email?: string;
  gender?: string;
  fcmToken?: string;
  referralCode?: string;
}

export interface ISendOTPResponse {
  message: string;
  expiresIn: number;
}

export interface IVerifyOTPResponse {
  verified: boolean;
  message: string;
}

export class OTPService {
  /**
   * Generate a random OTP
   */
  private generateOTP(): string {
    const length = config.sms.otpLength;
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  /**
   * Get Redis key for OTP storage
   */
  private getOTPKey(phoneNumber: string): string {
    console.log('OTP Key is', CacheKeys.OTP(phoneNumber));
    return CacheKeys.OTP(phoneNumber);
  }

  /**
   * Get Redis key for OTP attempts
   */
  private getAttemptsKey(phoneNumber: string): string {
    return CacheKeys.OTP_ATTEMPTS(phoneNumber);
  }

  /**
   * Get Redis key for pending signup data
   */
  private getPendingSignupKey(phoneNumber: string): string {
    // console.log('Pending Signup Key is', `signup:pending:${phoneNumber}`);
    return `signup:pending:${phoneNumber}`;
  }

  /**
   * Format phone number for SMS (adds country code if missing)
   * India (91) is the default country code
   */
  private formatPhoneForSMS(phoneNumber: string): string {
    // Remove all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // If already has country code (starts with 91 and is 12 digits)
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return cleaned;
    }
    
    // If it's a 10-digit number, add India country code (91)
    if (cleaned.length === 10) {
      return `91${cleaned}`;
    }
    
    // Return as is if it doesn't match expected patterns
    // The SMS provider will handle validation
    return cleaned;
  }

  /**
   * Send OTP via SMS API
   */
  private async sendSMS(phoneNumber: string, otp: string): Promise<boolean> {
    try {
      const formattedNumber = this.formatPhoneForSMS(phoneNumber);
      console.log('OTP is', otp);
      console.log('Original phone:', phoneNumber, 'Formatted phone:', formattedNumber);
      
      const body = `Your mobile verification OTP for Connecting Hearts is ${otp}. Please do not share it with anyone. Powered by SHUPRA`;
      const url = `${process.env.SMS_API_URL}?api_id=${process.env.SMS_API_ID}&api_password=${process.env.SMS_API_PASSWORD}&sms_type=${process.env.SMS_TYPE}&sms_encoding=text&sender=${process.env.SMS_SENDER}&number=${formattedNumber}&message=${encodeURIComponent(body)}&template_id=${process.env.SMS_TEMPLATE_ID}`;
      console.log('URL is', url);
      
      const smsResp = await axios.get(url);
      console.log('SMS Response is', smsResp.data);
      
      if (smsResp?.data?.code === 200) {
        logWithContext.auth('OTP sent successfully', { phoneNumber, formattedNumber });
        return true;
      } else {
        logger.error('SMS API returned error', { response: smsResp.data, phoneNumber, formattedNumber });
        return false;
      }
    } catch (error) {
      logger.error('Failed to send SMS', { error, phoneNumber });
      return false;
    }
  }

  /**
   * Send OTP for signup
   */
  async sendSignupOTP(data: IPendingSignupData): Promise<ISendOTPResponse> {
    const { phoneNumber } = data;

    // Check rate limiting - max attempts per hour
    const attemptsKey = this.getAttemptsKey(phoneNumber);
    const attempts = await redisClient.incr(attemptsKey);
    
    if (attempts === 1) {
      // Set expiry for first attempt
      await redisClient.expire(attemptsKey, 3600); // 1 hour
    }

    if (attempts > config.sms.maxOtpAttempts) {
      throw new TooManyRequestsError(
        'Too many OTP requests. Please try again later.',
        'OTP_RATE_LIMIT'
      );
    }

    // Generate OTP
    // const otp = this.generateOTP();
    const otp = '123456';
    // Store OTP in Redis
    const otpKey = this.getOTPKey(phoneNumber);
    await redisClient.set(otpKey, otp, config.sms.otpExpiry);

    // Store pending signup data in Redis (redisClient.set handles JSON serialization)
    const pendingKey = this.getPendingSignupKey(phoneNumber);
    await redisClient.set(pendingKey, data, config.sms.otpExpiry + 60); // Extra minute buffer

    // Send SMS
    // const sent = await this.sendSMS(phoneNumber, otp);

    // if (!sent) {
    //   // In development, log the OTP for testing
    //   if (config.isDevelopment) {
    //     logger.info(`[DEV] OTP for ${phoneNumber}: ${otp}`);
    //   }
    // }

    logWithContext.auth('Signup OTP requested', { phoneNumber, attempt: attempts });

    return {
      message: 'OTP sent successfully',
      expiresIn: config.sms.otpExpiry,
    };
  }

  /**
   * Verify OTP
   */
  async verifyOTP(phoneNumber: string, otp: string): Promise<IVerifyOTPResponse> {
    const otpKey = this.getOTPKey(phoneNumber);
    const storedOTP = await redisClient.get(otpKey);
    console.log('Stored OTP is', storedOTP, 'Input OTP is', otp);
    
    if (!storedOTP) {
      throw new BadRequestError('OTP expired or not found. Please request a new OTP.', 'OTP_EXPIRED');
    }

    // Convert both to strings for comparison (Redis may return number after JSON.parse)
    if (String(storedOTP) !== String(otp)) {
      throw new BadRequestError('Invalid OTP. Please try again.', 'INVALID_OTP');
    }

    // OTP is valid - delete only the OTP key
    // NOTE: Pending signup data is deleted in getPendingSignupData() after retrieval
    await redisClient.del(otpKey);

    logWithContext.auth('OTP verified successfully', { phoneNumber });

    return {
      verified: true,
      message: 'OTP verified successfully',
    };
  }

  /**
   * Get pending signup data after OTP verification
   */
  async getPendingSignupData(phoneNumber: string): Promise<IPendingSignupData | null> {
    const pendingKey = this.getPendingSignupKey(phoneNumber);
    const data = await redisClient.get<IPendingSignupData>(pendingKey);

    if (!data) {
      return null;
    }

    // Delete the pending data after retrieval
    await redisClient.del(pendingKey);

    // redisClient.get already handles JSON parsing
    return data;
  }

  /**
   * Clear OTP attempts (call after successful verification)
   */
  async clearOTPAttempts(phoneNumber: string): Promise<void> {
    const attemptsKey = this.getAttemptsKey(phoneNumber);
    await redisClient.del(attemptsKey);
  }

  /**
   * Send OTP for login (phone-only login without password)
   */
  async sendLoginOTP(phoneNumber: string): Promise<ISendOTPResponse> {
    // Check rate limiting
    const attemptsKey = this.getAttemptsKey(phoneNumber);
    const attempts = await redisClient.incr(attemptsKey);

    if (attempts === 1) {
      await redisClient.expire(attemptsKey, 3600);
    }

    if (attempts > config.sms.maxOtpAttempts) {
      throw new TooManyRequestsError(
        'Too many OTP requests. Please try again later.',
        'OTP_RATE_LIMIT'
      );
    }

    // Generate and store OTP
    const otp = this.generateOTP();
    const otpKey = this.getOTPKey(phoneNumber);
    await redisClient.set(otpKey, otp, config.sms.otpExpiry);

    // Send SMS
    const sent = await this.sendSMS(phoneNumber, otp);

    if (!sent && config.isDevelopment) {
      logger.info(`[DEV] Login OTP for ${phoneNumber}: ${otp}`);
    }

    logWithContext.auth('Login OTP requested', { phoneNumber, attempt: attempts });

    return {
      message: 'OTP sent successfully',
      expiresIn: config.sms.otpExpiry,
    };
  }

  /**
   * Resend OTP
   */
  async resendOTP(phoneNumber: string): Promise<ISendOTPResponse> {
    // Check if there's pending signup data
    const pendingKey = this.getPendingSignupKey(phoneNumber);
    const pendingData = await redisClient.get<IPendingSignupData>(pendingKey);

    if (pendingData) {
      // Resend signup OTP
      return this.sendSignupOTP(pendingData);
    }

    // Otherwise, it's a login OTP resend
    return this.sendLoginOTP(phoneNumber);
  }
}

export const otpService = new OTPService();

