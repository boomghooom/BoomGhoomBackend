import { Router } from 'express';
import { userController } from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  updateProfileSchema,
  updateLocationSchema,
  updateBankDetailsSchema,
  searchUsersSchema,
  paginationSchema,
  idParamSchema,
} from '../validators/user.validator.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Profile routes
router.get('/me', userController.getMe.bind(userController));
router.patch(
  '/me',
  validate(updateProfileSchema),
  userController.updateProfile.bind(userController)
);
router.delete('/me', userController.deleteAccount.bind(userController));

router.patch(
  '/me/location',
  validate(updateLocationSchema),
  userController.updateLocation.bind(userController)
);

router.patch('/me/avatar', userController.updateAvatar.bind(userController));

router.patch(
  '/me/bank-details',
  validate(updateBankDetailsSchema),
  userController.updateBankDetails.bind(userController)
);

// FCM tokens
router.post('/me/fcm-token', userController.addFcmToken.bind(userController));
router.delete('/me/fcm-token', userController.removeFcmToken.bind(userController));

// Stats and finance
router.get('/me/stats', userController.getStats.bind(userController));
router.get('/me/finance', userController.getFinanceSummary.bind(userController));

// KYC routes
router.post('/me/kyc/initiate', userController.initiateKYC.bind(userController));
router.post('/me/kyc/selfie', userController.submitSelfie.bind(userController));
router.post('/me/kyc/document', userController.submitDocument.bind(userController));
router.get('/me/kyc/status', userController.getKYCStatus.bind(userController));

// Search users
router.get(
  '/search',
  validate(searchUsersSchema, 'query'),
  userController.searchUsers.bind(userController)
);

// Public profile
router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  userController.getProfile.bind(userController)
);

export default router;

