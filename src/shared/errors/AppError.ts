import { HttpStatusCode } from '../constants/httpStatusCodes.js';

export interface IAppError {
  message: string;
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: unknown;
  stack?: string;
}

export class AppError extends Error implements IAppError {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = HttpStatusCode.INTERNAL_SERVER_ERROR,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);

    // Set prototype explicitly for instanceof to work correctly
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON(): IAppError {
    return {
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      isOperational: this.isOperational,
      details: this.details,
      stack: this.stack,
    };
  }
}

// Specific error classes
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', code: string = 'BAD_REQUEST', details?: unknown) {
    super(message, HttpStatusCode.BAD_REQUEST, code, true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', code: string = 'UNAUTHORIZED', details?: unknown) {
    super(message, HttpStatusCode.UNAUTHORIZED, code, true, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', code: string = 'FORBIDDEN', details?: unknown) {
    super(message, HttpStatusCode.FORBIDDEN, code, true, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found', code: string = 'NOT_FOUND', details?: unknown) {
    super(message, HttpStatusCode.NOT_FOUND, code, true, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', code: string = 'CONFLICT', details?: unknown) {
    super(message, HttpStatusCode.CONFLICT, code, true, details);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string = 'Validation Error',
    code: string = 'VALIDATION_ERROR',
    details?: unknown
  ) {
    super(message, HttpStatusCode.UNPROCESSABLE_ENTITY, code, true, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    message: string = 'Too Many Requests',
    code: string = 'RATE_LIMIT_EXCEEDED',
    details?: unknown
  ) {
    super(message, HttpStatusCode.TOO_MANY_REQUESTS, code, true, details);
  }
}

export class InternalServerError extends AppError {
  constructor(
    message: string = 'Internal Server Error',
    code: string = 'INTERNAL_ERROR',
    details?: unknown
  ) {
    super(message, HttpStatusCode.INTERNAL_SERVER_ERROR, code, false, details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    message: string = 'Service Unavailable',
    code: string = 'SERVICE_UNAVAILABLE',
    details?: unknown
  ) {
    super(message, HttpStatusCode.SERVICE_UNAVAILABLE, code, true, details);
  }
}

// Business logic specific errors
export class InsufficientBalanceError extends AppError {
  constructor(message: string = 'Insufficient balance', details?: unknown) {
    super(message, HttpStatusCode.BAD_REQUEST, 'INSUFFICIENT_BALANCE', true, details);
  }
}

export class DuesPendingError extends AppError {
  constructor(message: string = 'Please clear your pending dues first', details?: unknown) {
    super(message, HttpStatusCode.FORBIDDEN, 'DUES_PENDING', true, details);
  }
}

export class KYCRequiredError extends AppError {
  constructor(message: string = 'KYC verification required', details?: unknown) {
    super(message, HttpStatusCode.FORBIDDEN, 'KYC_REQUIRED', true, details);
  }
}

export class EventFullError extends AppError {
  constructor(message: string = 'Event is full', details?: unknown) {
    super(message, HttpStatusCode.CONFLICT, 'EVENT_FULL', true, details);
  }
}

export class EventNotEligibleError extends AppError {
  constructor(message: string = 'You are not eligible for this event', details?: unknown) {
    super(message, HttpStatusCode.FORBIDDEN, 'NOT_ELIGIBLE', true, details);
  }
}

export class LeaveWindowExpiredError extends AppError {
  constructor(message: string = 'Leave request window has expired', details?: unknown) {
    super(message, HttpStatusCode.FORBIDDEN, 'LEAVE_WINDOW_EXPIRED', true, details);
  }
}

export class PaymentFailedError extends AppError {
  constructor(message: string = 'Payment failed', details?: unknown) {
    super(message, HttpStatusCode.BAD_REQUEST, 'PAYMENT_FAILED', true, details);
  }
}

export class WithdrawalLimitError extends AppError {
  constructor(message: string = 'Minimum withdrawal amount not met', details?: unknown) {
    super(message, HttpStatusCode.BAD_REQUEST, 'WITHDRAWAL_LIMIT_NOT_MET', true, details);
  }
}

