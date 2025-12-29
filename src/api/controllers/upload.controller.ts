import { Request, Response, NextFunction } from 'express';
import { getUploadService } from '../../application/services/UploadService.js';
import { sendSuccess } from '../../shared/utils/response.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

const uploadService = getUploadService();

export class UploadController {
  async uploadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if file exists
      if (!req.file) {
        throw new BadRequestError('No file provided. Please upload a file.');
      }

      // Get bucket type from query parameter
      const bucketType = req.query.bucketType as 'event' | 'document' | 'profile';

      if (!bucketType || !['event', 'document', 'profile'].includes(bucketType)) {
        throw new BadRequestError(
          'Invalid or missing bucketType. Must be one of: event, document, profile'
        );
      }

      // Get user ID if authenticated (optional for some use cases)
      const userId = req.userId || undefined;

      // Upload file
      const result = await uploadService.uploadFile({
        file: req.file,
        bucketType,
        userId,
      });

      // Return success response with image URL
      sendSuccess(res, {
        url: result.url,
        key: result.key,
        bucket: result.bucket,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Singleton instance
export const uploadController = new UploadController();

