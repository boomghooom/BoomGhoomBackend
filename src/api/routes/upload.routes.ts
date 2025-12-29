import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { uploadController } from '../controllers/upload.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { uploadFileSchema } from '../validators/upload.validator.js';
import { FileUploadLimits } from '../../shared/constants/index.js';

const router = Router();

// Configure multer for in-memory storage
const storage = multer.memoryStorage();

// Configure file filter
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Accept all image types and PDF for documents
  const allowedMimeTypes = [
    ...FileUploadLimits.ALLOWED_IMAGE_TYPES,
    'application/pdf',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`
      )
    );
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: FileUploadLimits.MAX_FILE_SIZE, // 10MB max
  },
});

// Middleware to validate Content-Type before multer processing
const validateContentType = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentType = req.headers['content-type'];
  
  if (!contentType || !contentType.includes('multipart/form-data')) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_CONTENT_TYPE',
        message:
          'Invalid Content-Type header. Request must use multipart/form-data. ' +
          'When using fetch or axios, do not set Content-Type header manually - let the browser/library set it automatically.',
      },
    });
    return;
  }
  
  next();
};

// Upload route - requires authentication
router.post(
  '/',
  authenticate,
  validateContentType, // Validate Content-Type before multer
  upload.single('file'), // Accept single file with field name 'file'
  validate(uploadFileSchema, 'query'), // Validate query params
  uploadController.uploadFile.bind(uploadController)
);

export default router;

