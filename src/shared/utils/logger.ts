import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }
  
  if (stack) {
    log += `\n${stack}`;
  }
  
  return log;
});

// Create logger instance
const createLogger = (): winston.Logger => {
  const logLevel = process.env.LOG_LEVEL || 'debug';
  const logPath = process.env.LOG_FILE_PATH || './logs';
  const isProduction = process.env.NODE_ENV === 'production';

  const transports: winston.transport[] = [];

  // Console transport
  transports.push(
    new winston.transports.Console({
      format: combine(
        colorize({ all: !isProduction }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat
      ),
    })
  );

  // File transports for production
  if (isProduction) {
    // Error logs
    transports.push(
      new winston.transports.File({
        filename: path.join(logPath, 'error.log'),
        level: 'error',
        format: combine(
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          errors({ stack: true }),
          logFormat
        ),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      })
    );

    // Combined logs
    transports.push(
      new winston.transports.File({
        filename: path.join(logPath, 'combined.log'),
        format: combine(
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          errors({ stack: true }),
          logFormat
        ),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      })
    );
  }

  return winston.createLogger({
    level: logLevel,
    transports,
    exitOnError: false,
  });
};

export const logger = createLogger();

// Request logger middleware helper
export const requestLoggerFormat = (
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  userId?: string
): string => {
  return `${method} ${url} ${statusCode} ${duration}ms${userId ? ` [user: ${userId}]` : ''}`;
};

// Structured logging helpers
export const logWithContext = {
  auth: (message: string, data?: Record<string, unknown>): void => {
    logger.info(`[AUTH] ${message}`, data);
  },
  event: (message: string, data?: Record<string, unknown>): void => {
    logger.info(`[EVENT] ${message}`, data);
  },
  payment: (message: string, data?: Record<string, unknown>): void => {
    logger.info(`[PAYMENT] ${message}`, data);
  },
  kyc: (message: string, data?: Record<string, unknown>): void => {
    logger.info(`[KYC] ${message}`, data);
  },
  chat: (message: string, data?: Record<string, unknown>): void => {
    logger.info(`[CHAT] ${message}`, data);
  },
  error: (message: string, error: unknown, data?: Record<string, unknown>): void => {
    logger.error(`[ERROR] ${message}`, { error, ...data });
  },
};

