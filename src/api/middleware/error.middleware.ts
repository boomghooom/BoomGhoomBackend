import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../../shared/errors/AppError.js';
import { HttpStatusCode } from '../../shared/constants/httpStatusCodes.js';
import { logger } from '../../shared/utils/logger.js';
import { config } from '../../config/index.js';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
): void => {
  // Log error
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.userId,
  });

  // Handle AppError
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        stack: config.isDevelopment ? error.stack : undefined,
      },
    });
    return;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const formattedErrors = error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    res.status(HttpStatusCode.UNPROCESSABLE_ENTITY).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: formattedErrors,
      },
    });
    return;
  }

  // Handle Mongoose validation errors
  if (error instanceof mongoose.Error.ValidationError) {
    const formattedErrors = Object.values(error.errors).map((err) => ({
      field: err.path,
      message: err.message,
    }));

    res.status(HttpStatusCode.UNPROCESSABLE_ENTITY).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: formattedErrors,
      },
    });
    return;
  }

  // Handle Mongoose cast errors (invalid ObjectId)
  if (error instanceof mongoose.Error.CastError) {
    res.status(HttpStatusCode.BAD_REQUEST).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: `Invalid ${error.path}: ${error.value}`,
      },
    });
    return;
  }

  // Handle Mongoose duplicate key errors
  if (error.name === 'MongoServerError' && (error as unknown as { code: number }).code === 11000) {
    const field = Object.keys((error as unknown as { keyValue: Record<string, unknown> }).keyValue)[0];
    res.status(HttpStatusCode.CONFLICT).json({
      success: false,
      error: {
        code: 'DUPLICATE_VALUE',
        message: `${field} already exists`,
      },
    });
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(HttpStatusCode.UNAUTHORIZED).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token',
      },
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(HttpStatusCode.UNAUTHORIZED).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Token expired',
      },
    });
    return;
  }

  // Handle syntax errors in JSON body
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(HttpStatusCode.BAD_REQUEST).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in request body',
      },
    });
    return;
  }

  // Default internal server error
  res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isProduction
        ? 'An unexpected error occurred'
        : error.message,
      stack: config.isDevelopment ? error.stack : undefined,
    },
  });
};

export const notFoundHandler = (
  req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
): void => {
  res.status(HttpStatusCode.NOT_FOUND).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
};

