import { z } from 'zod';

export const uploadFileSchema = z.object({
  bucketType: z.enum(['event', 'document', 'profile'], {
    errorMap: () => ({
      message: 'bucketType must be one of: event, document, profile',
    }),
  }),
});

export const deleteFileSchema = z.object({
  url: z.string().url('Invalid URL format').min(1, 'Url is required'),
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;
export type DeleteFileInput = z.infer<typeof deleteFileSchema>;

