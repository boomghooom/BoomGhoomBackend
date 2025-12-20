import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
};

const getEnvVarAsInt = (key: string, defaultValue?: number): number => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Environment variable ${key} is not defined`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer`);
  }
  return parsed;
};

const getEnvVarAsBool = (key: string, defaultValue?: boolean): boolean => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value.toLowerCase() === 'true';
};

export const config = {
  // Application
  env: getEnvVar('NODE_ENV', 'development'),
  port: getEnvVarAsInt('PORT', 3000),
  apiVersion: getEnvVar('API_VERSION', 'v1'),
  appName: getEnvVar('APP_NAME', 'BoomGhoom'),
  appUrl: getEnvVar('APP_URL', 'http://localhost:3000'),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',

  // Database
  mongodb: {
    uri: getEnvVar('MONGODB_URI', 'mongodb://localhost:27017/boomghoom'),
    testUri: getEnvVar('MONGODB_URI_TEST', 'mongodb://localhost:27017/boomghoom_test'),
  },

  // Redis
  redis: {
    host: getEnvVar('REDIS_HOST', 'localhost'),
    port: getEnvVarAsInt('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: getEnvVarAsInt('REDIS_DB', 0),
    get url(): string {
      const auth = this.password ? `:${this.password}@` : '';
      return `redis://${auth}${this.host}:${this.port}/${this.db}`;
    },
  },

  // JWT
  jwt: {
    accessSecret: getEnvVar('JWT_ACCESS_SECRET', 'dev-access-secret-key-min-32-chars'),
    refreshSecret: getEnvVar('JWT_REFRESH_SECRET', 'dev-refresh-secret-key-min-32-chars'),
    accessExpiry: getEnvVar('JWT_ACCESS_EXPIRY', '15m'),
    refreshExpiry: getEnvVar('JWT_REFRESH_EXPIRY', '7d'),
  },

  // OAuth - Google
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },

  // OAuth - Apple
  apple: {
    clientId: process.env.APPLE_CLIENT_ID || '',
    teamId: process.env.APPLE_TEAM_ID || '',
    keyId: process.env.APPLE_KEY_ID || '',
    privateKeyPath: process.env.APPLE_PRIVATE_KEY_PATH || './keys/apple-private-key.p8',
  },

  // AWS S3
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: getEnvVar('AWS_REGION', 'ap-south-1'),
    s3Bucket: getEnvVar('AWS_S3_BUCKET', 'boomghoom-assets'),
    s3Endpoint: process.env.AWS_S3_ENDPOINT || undefined,
  },

  // Payment - Razorpay
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  // Payment - Cashfree
  cashfree: {
    appId: process.env.CASHFREE_APP_ID || '',
    secretKey: process.env.CASHFREE_SECRET_KEY || '',
    env: getEnvVar('CASHFREE_ENV', 'TEST') as 'TEST' | 'PROD',
  },

  // Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  },

  // SMS
  sms: {
    provider: getEnvVar('SMS_PROVIDER', 'msg91') as 'msg91' | 'twilio',
    msg91: {
      authKey: process.env.MSG91_AUTH_KEY || '',
      senderId: getEnvVar('MSG91_SENDER_ID', 'BOOMGH'),
      templateId: process.env.MSG91_TEMPLATE_ID || '',
    },
  },

  // Rate Limiting
  rateLimit: {
    windowMs: getEnvVarAsInt('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
    maxRequests: getEnvVarAsInt('RATE_LIMIT_MAX_REQUESTS', 100),
  },

  // Business Rules (amounts in paise for precision)
  business: {
    dueAmount: getEnvVarAsInt('DUE_AMOUNT', 2500), // ₹25 in paise
    minWithdrawalAmount: getEnvVarAsInt('MIN_WITHDRAWAL_AMOUNT', 100000), // ₹1000 in paise
    adminCommissionPercentage: getEnvVarAsInt('ADMIN_COMMISSION_PERCENTAGE', 80),
    leaveRequestWindowMinutes: getEnvVarAsInt('LEAVE_REQUEST_WINDOW_MINUTES', 60),
    gstPercentage: getEnvVarAsInt('GST_PERCENTAGE', 18),
    paymentGatewayFeePercentage: getEnvVarAsInt('PAYMENT_GATEWAY_FEE_PERCENTAGE', 2),
  },

  // Deep Links
  deepLink: {
    scheme: getEnvVar('DEEP_LINK_SCHEME', 'boomghoom'),
    domain: getEnvVar('DEEP_LINK_DOMAIN', 'boomghoom.app.link'),
  },

  // Logging
  logging: {
    level: getEnvVar('LOG_LEVEL', 'debug'),
    filePath: getEnvVar('LOG_FILE_PATH', './logs'),
  },

  // Encryption
  encryption: {
    key: getEnvVar('ENCRYPTION_KEY', 'dev-encryption-key-32-characters'),
  },

  // CORS
  cors: {
    origins: (process.env.CORS_ORIGINS || '*').split(','),
  },
} as const;

export type Config = typeof config;

