import { getS3Storage } from '../../infrastructure/storage/S3Storage.js';
import { config } from '../../config/index.js';
import { FileUploadLimits } from '../../shared/constants/index.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/utils/logger.js';

export type UploadBucketType = 'event' | 'document' | 'profile';

export interface IUploadFileParams {
  file: Express.Multer.File;
  bucketType: UploadBucketType;
  userId?: string;
}

export interface IUploadResult {
  url: string;
  key: string;
  bucket: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export class UploadService {
  private s3Storage = getS3Storage();

  /**
   * Get bucket name based on type
   */
  private getBucketName(bucketType: UploadBucketType): string {
    return config.aws.s3Buckets[bucketType];
  }

  /**
   * Validate file type based on bucket type
   */
  private validateFileType(
    mimeType: string,
    bucketType: UploadBucketType
  ): void {
    const allowedTypes =
      bucketType === 'document'
        ? FileUploadLimits.ALLOWED_DOCUMENT_TYPES
        : FileUploadLimits.ALLOWED_IMAGE_TYPES;

    if (!allowedTypes.includes(mimeType)) {
      throw new BadRequestError(
        `Invalid file type. Allowed types for ${bucketType}: ${allowedTypes.join(', ')}`
      );
    }
  }

  /**
   * Validate file size based on bucket type
   */
  private validateFileSize(
    fileSize: number,
    bucketType: UploadBucketType
  ): void {
    const maxSize =
      bucketType === 'document'
        ? FileUploadLimits.MAX_FILE_SIZE
        : FileUploadLimits.MAX_IMAGE_SIZE;

    if (fileSize > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      throw new BadRequestError(
        `File size exceeds maximum allowed size of ${maxSizeMB}MB for ${bucketType}`
      );
    }
  }

  /**
   * Generate folder path based on bucket type and user
   */
  private getFolderPath(bucketType: UploadBucketType, userId?: string): string {
    const baseFolder = bucketType;
    if (userId) {
      return `${baseFolder}/${userId}`;
    }
    return baseFolder;
  }

  /**
   * Sanitize filename
   */
  private sanitizeFileName(fileName: string): string {
    // Remove special characters and replace spaces with underscores
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }

  /**
   * Upload file to S3
   */
  async uploadFile(params: IUploadFileParams): Promise<IUploadResult> {
    const { file, bucketType, userId } = params;

    // Validate file type
    this.validateFileType(file.mimetype, bucketType);

    // Validate file size
    this.validateFileSize(file.size, bucketType);

    // Get bucket name
    const bucketName = this.getBucketName(bucketType);

    // Generate folder path
    const folder = this.getFolderPath(bucketType, userId);

    // Sanitize filename
    const sanitizedFileName = this.sanitizeFileName(file.originalname);

    try {
      // Upload to S3
      const result = await this.s3Storage.upload(
        {
          file: file.buffer,
          fileName: sanitizedFileName,
          mimeType: file.mimetype,
          folder,
        },
        bucketName
      );

      logger.info('File uploaded successfully', {
        bucketType,
        bucket: bucketName,
        key: result.key,
        userId,
      });

      return {
        url: result.url,
        key: result.key,
        bucket: bucketName,
        fileName: sanitizedFileName,
        fileSize: file.size,
        mimeType: file.mimetype,
      };
    } catch (error) {
      logger.error('File upload failed', {
        bucketType,
        bucket: bucketName,
        error,
      });
      throw error;
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string, bucketType: UploadBucketType): Promise<void> {
    const bucketName = this.getBucketName(bucketType);

    try {
      await this.s3Storage.delete(key, bucketName);
      logger.info('File deleted successfully', { key, bucket: bucketName });
    } catch (error) {
      logger.error('File deletion failed', { key, bucket: bucketName, error });
      throw error;
    }
  }
}

// Singleton instance
let uploadServiceInstance: UploadService | null = null;

export const getUploadService = (): UploadService => {
  if (!uploadServiceInstance) {
    uploadServiceInstance = new UploadService();
  }
  return uploadServiceInstance;
};

