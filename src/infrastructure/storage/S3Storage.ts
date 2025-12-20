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
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
      ...(config.aws.s3Endpoint && { endpoint: config.aws.s3Endpoint }),
    });
    this.bucket = config.aws.s3Bucket;
  }

  async upload(params: IUploadParams): Promise<IUploadResult> {
    const key = `${params.folder}/${uuidv4()}-${params.fileName}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: params.file,
          ContentType: params.mimeType,
        })
      );

      const url = this.getPublicUrl(key);
      logger.info('File uploaded to S3', { key });

      return { key, url };
    } catch (error) {
      logger.error('S3 upload error:', error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      logger.info('File deleted from S3', { key });
    } catch (error) {
      logger.error('S3 delete error:', error);
      throw error;
    }
  }

  async getPresignedUploadUrl(params: IPresignedUrlParams): Promise<{
    uploadUrl: string;
    key: string;
    publicUrl: string;
  }> {
    const key = `${params.folder}/${uuidv4()}-${params.fileName}`;
    const expiresIn = params.expiresIn || 3600; // 1 hour default

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: params.mimeType,
      });

      const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
      const publicUrl = this.getPublicUrl(key);

      logger.info('Presigned upload URL generated', { key });

      return { uploadUrl, key, publicUrl };
    } catch (error) {
      logger.error('Presigned URL error:', error);
      throw error;
    }
  }

  async getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      logger.error('Presigned download URL error:', error);
      throw error;
    }
  }

  getPublicUrl(key: string): string {
    if (config.aws.s3Endpoint) {
      return `${config.aws.s3Endpoint}/${this.bucket}/${key}`;
    }
    return `https://${this.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
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

