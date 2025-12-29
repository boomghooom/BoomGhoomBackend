import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export interface IUploadParams {
  file: Buffer;
  fileName: string;
  mimeType: string;
  folder: string;
}

export interface IUploadResult {
  key: string;
  url: string;
}

export interface IPresignedUrlParams {
  folder: string;
  fileName: string;
  mimeType: string;
  expiresIn?: number;
}

export class S3Storage {
  private client: S3Client;
  private defaultBucket: string;

  constructor(bucket?: string) {
    this.client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
      ...(config.aws.s3Endpoint && { endpoint: config.aws.s3Endpoint }),
    });
    this.defaultBucket = bucket || config.aws.s3Bucket;
  }

  async upload(params: IUploadParams, bucket?: string): Promise<IUploadResult> {
    const targetBucket = bucket || this.defaultBucket;
    const key = `${params.folder}/${uuidv4()}-${params.fileName}`;

    try {
      // Try with ACL first, fallback without ACL if ACLs are disabled
      const putCommand = new PutObjectCommand({
        Bucket: targetBucket,
        Key: key,
        Body: params.file,
        ContentType: params.mimeType,
        ACL: 'public-read', // Make files publicly readable
      });

      await this.client.send(putCommand);

      const url = this.getPublicUrl(key, targetBucket);
      logger.info('File uploaded to S3', { key, bucket: targetBucket });

      return { key, url };
    } catch (error: any) {
      // If ACL error, retry without ACL (in case bucket has ACLs disabled)
      if (error?.name === 'AccessControlListNotSupported' || error?.Code === 'AccessControlListNotSupported') {
        logger.warn('ACL not supported, retrying without ACL', { key, bucket: targetBucket });
        try {
          const putCommandNoAcl = new PutObjectCommand({
            Bucket: targetBucket,
            Key: key,
            Body: params.file,
            ContentType: params.mimeType,
          });
          await this.client.send(putCommandNoAcl);
          const url = this.getPublicUrl(key, targetBucket);
          logger.info('File uploaded to S3 without ACL', { key, bucket: targetBucket });
          return { key, url };
        } catch (retryError) {
          logger.error('S3 upload error (retry without ACL):', retryError);
          throw retryError;
        }
      }
      logger.error('S3 upload error:', error);
      throw error;
    }
  }

  async delete(key: string, bucket?: string): Promise<void> {
    const targetBucket = bucket || this.defaultBucket;
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: targetBucket,
          Key: key,
        })
      );
      logger.info('File deleted from S3', { key, bucket: targetBucket });
    } catch (error) {
      logger.error('S3 delete error:', error);
      throw error;
    }
  }

  async getPresignedUploadUrl(params: IPresignedUrlParams, bucket?: string): Promise<{
    uploadUrl: string;
    key: string;
    publicUrl: string;
  }> {
    const targetBucket = bucket || this.defaultBucket;
    const key = `${params.folder}/${uuidv4()}-${params.fileName}`;
    const expiresIn = params.expiresIn || 3600; // 1 hour default

    try {
      // Try with ACL first
      const command = new PutObjectCommand({
        Bucket: targetBucket,
        Key: key,
        ContentType: params.mimeType,
        ACL: 'public-read',
      });

      const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
      const publicUrl = this.getPublicUrl(key, targetBucket);

      logger.info('Presigned upload URL generated', { key, bucket: targetBucket });

      return { uploadUrl, key, publicUrl };
    } catch (error: any) {
      // If ACL error, retry without ACL
      if (error?.name === 'AccessControlListNotSupported' || error?.Code === 'AccessControlListNotSupported') {
        logger.warn('ACL not supported, retrying without ACL for presigned URL', { key, bucket: targetBucket });
        try {
          const commandNoAcl = new PutObjectCommand({
            Bucket: targetBucket,
            Key: key,
            ContentType: params.mimeType,
          });
          const uploadUrl = await getSignedUrl(this.client, commandNoAcl, { expiresIn });
          const publicUrl = this.getPublicUrl(key, targetBucket);
          return { uploadUrl, key, publicUrl };
        } catch (retryError) {
          logger.error('Presigned URL error (retry without ACL):', retryError);
          throw retryError;
        }
      }
      logger.error('Presigned URL error:', error);
      throw error;
    }
  }

  async getPresignedDownloadUrl(key: string, expiresIn = 3600, bucket?: string): Promise<string> {
    const targetBucket = bucket || this.defaultBucket;
    try {
      const command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      logger.error('Presigned download URL error:', error);
      throw error;
    }
  }

  getPublicUrl(key: string, bucket?: string): string {
    const targetBucket = bucket || this.defaultBucket;
    if (config.aws.s3Endpoint) {
      return `${config.aws.s3Endpoint}/${targetBucket}/${key}`;
    }
    return `https://${targetBucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
  }
}

// Singleton instance
let s3Storage: S3Storage | null = null;

export const getS3Storage = (): S3Storage => {
  if (!s3Storage) {
    s3Storage = new S3Storage();
  }
  return s3Storage;
};

