import { z } from 'zod';

export const uploadFileSchema = z.object({
  bucketType: z.enum(['event', 'document', 'profile'], {
    errorMap: () => ({
      message: 'bucketType must be one of: event, document, profile',
    }),
  }),
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;


