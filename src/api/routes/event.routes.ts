import { Router } from 'express';
import { eventController } from '../controllers/event.controller.js';
import { authenticate, optionalAuth, requireKYC } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { heavyOperationLimiter } from '../middleware/rateLimit.middleware.js';
import {
  createEventSchema,
  updateEventSchema,
  eventFiltersSchema,
  cancelEventSchema,
  rejectJoinSchema,
  bulkInviteSchema,
} from '../validators/event.validator.js';
import { idParamSchema } from '../validators/user.validator.js';

const router = Router();

// Public/Optional auth routes
router.get(
  '/',
  optionalAuth,
  validate(eventFiltersSchema, 'query'),
  eventController.list.bind(eventController)
);

router.get('/upcoming', optionalAuth, eventController.getUpcoming.bind(eventController));
router.get('/featured', optionalAuth, eventController.getFeatured.bind(eventController));

router.get(
  '/link/:deepLinkId',
  optionalAuth,
  eventController.getByDeepLink.bind(eventController)
);

router.get(
  '/:id',
  optionalAuth,
  validate(idParamSchema, 'params'),
  eventController.getById.bind(eventController)
);

// Protected routes
router.use(authenticate);

// User's events
router.get('/me/joined', eventController.getMyEvents.bind(eventController));
router.get('/me/created', eventController.getCreatedEvents.bind(eventController));
router.get('/me/previous-participants', eventController.getPreviousParticipants.bind(eventController));

// Create event (requires KYC)
router.post(
  '/',
  requireKYC,
  heavyOperationLimiter,
  validate(createEventSchema),
  eventController.create.bind(eventController)
);

// Event management
router.post(
  '/:id/publish',
  validate(idParamSchema, 'params'),
  eventController.publish.bind(eventController)
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateEventSchema),
  eventController.update.bind(eventController)
);

router.post(
  '/:id/cancel',
  validate(idParamSchema, 'params'),
  validate(cancelEventSchema),
  eventController.cancel.bind(eventController)
);

router.post(
  '/:id/complete',
  validate(idParamSchema, 'params'),
  eventController.complete.bind(eventController)
);

// Participation
router.post(
  '/:id/join',
  validate(idParamSchema, 'params'),
  eventController.join.bind(eventController)
);

router.post(
  '/:id/approve/:userId',
  eventController.approveJoin.bind(eventController)
);

router.post(
  '/:id/reject/:userId',
  validate(rejectJoinSchema),
  eventController.rejectJoin.bind(eventController)
);

router.post(
  '/:id/leave',
  validate(idParamSchema, 'params'),
  eventController.requestLeave.bind(eventController)
);

router.post(
  '/:id/approve-leave/:userId',
  eventController.approveLeave.bind(eventController)
);

// Invites
router.post(
  '/:id/bulk-invite',
  validate(idParamSchema, 'params'),
  validate(bulkInviteSchema),
  eventController.bulkInvite.bind(eventController)
);

// Share tracking
router.post(
  '/:id/share',
  validate(idParamSchema, 'params'),
  eventController.recordShare.bind(eventController)
);

export default router;

