import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../../shared/errors/AppError.js';

type ValidateSource = 'body' | 'query' | 'params';

export const validate = (
  schema: ZodSchema,
  source: ValidateSource = 'body'
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      const result = schema.parse(data);

      // Replace original with parsed and transformed data
      if (source === 'body') {
        req.body = result;
      } else if (source === 'query') {
        req.query = result;
      } else {
        req.params = result;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        next(new ValidationError('Validation failed', 'VALIDATION_ERROR', formattedErrors));
      } else {
        next(error);
      }
    }
  };
};

export const validateMultiple = (schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const errors: { field: string; message: string }[] = [];

      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (result.success) {
          req.body = result.data;
        } else {
          errors.push(
            ...result.error.errors.map((err) => ({
              field: `body.${err.path.join('.')}`,
              message: err.message,
            }))
          );
        }
      }

      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (result.success) {
          req.query = result.data;
        } else {
          errors.push(
            ...result.error.errors.map((err) => ({
              field: `query.${err.path.join('.')}`,
              message: err.message,
            }))
          );
        }
      }

      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (result.success) {
          req.params = result.data;
        } else {
          errors.push(
            ...result.error.errors.map((err) => ({
              field: `params.${err.path.join('.')}`,
              message: err.message,
            }))
          );
        }
      }

      if (errors.length > 0) {
        next(new ValidationError('Validation failed', 'VALIDATION_ERROR', errors));
      } else {
        next();
      }
    } catch (error) {
      next(error);
    }
  };
};

