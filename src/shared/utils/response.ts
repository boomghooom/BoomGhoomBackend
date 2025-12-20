import { Response } from 'express';
import { HttpStatusCode } from '../constants/httpStatusCodes.js';

interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export const sendSuccess = <T>(
  res: Response,
  data: T,
  options: {
    statusCode?: number;
    message?: string;
    meta?: SuccessResponse<T>['meta'];
  } = {}
): Response<ApiResponse<T>> => {
  const { statusCode = HttpStatusCode.OK, message, meta } = options;

  return res.status(statusCode).json({
    success: true,
    data,
    message,
    meta,
  });
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message?: string
): Response<ApiResponse<T>> => {
  return sendSuccess(res, data, {
    statusCode: HttpStatusCode.CREATED,
    message,
  });
};

export const sendNoContent = (res: Response): Response => {
  return res.status(HttpStatusCode.NO_CONTENT).send();
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  },
  message?: string
): Response<ApiResponse<T[]>> => {
  return sendSuccess(res, data, {
    message,
    meta: pagination,
  });
};

export const sendError = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): Response<ErrorResponse> => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
};

