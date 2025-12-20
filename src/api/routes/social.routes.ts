import { Router } from 'express';
import { socialController } from '../controllers/social.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { paginationSchema, idParamSchema } from '../validators/user.validator.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Friends
router.get(
  '/friends',
  validate(paginationSchema, 'query'),
  socialController.getFriends.bind(socialController)
);

router.get(
  '/friends/requests',
  validate(paginationSchema, 'query'),
  socialController.getPendingRequests.bind(socialController)
);

router.post('/friends/request', socialController.sendFriendRequest.bind(socialController));

router.post(
  '/friends/:id/accept',
  validate(idParamSchema, 'params'),
  socialController.acceptFriendRequest.bind(socialController)
);

router.post(
  '/friends/:id/reject',
  validate(idParamSchema, 'params'),
  socialController.rejectFriendRequest.bind(socialController)
);

router.post(
  '/friends/:id/block',
  validate(idParamSchema, 'params'),
  socialController.blockUser.bind(socialController)
);

router.delete(
  '/friends/:id',
  validate(idParamSchema, 'params'),
  socialController.removeFriend.bind(socialController)
);

// Notifications
router.get(
  '/notifications',
  validate(paginationSchema, 'query'),
  socialController.getNotifications.bind(socialController)
);

router.get('/notifications/unread-count', socialController.getUnreadCount.bind(socialController));

router.post(
  '/notifications/:id/read',
  validate(idParamSchema, 'params'),
  socialController.markNotificationRead.bind(socialController)
);

router.post('/notifications/read-all', socialController.markAllNotificationsRead.bind(socialController));

// Ratings
router.post('/ratings', socialController.rateUser.bind(socialController));

router.get(
  '/ratings/user/:id',
  validate(idParamSchema, 'params'),
  validate(paginationSchema, 'query'),
  socialController.getUserRatings.bind(socialController)
);

// Reports
router.post('/reports', socialController.createReport.bind(socialController));

export default router;

