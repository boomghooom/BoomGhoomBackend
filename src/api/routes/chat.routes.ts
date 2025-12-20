import { Router } from 'express';
import { chatController } from '../controllers/chat.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { paginationSchema, idParamSchema } from '../validators/user.validator.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List chats
router.get(
  '/',
  validate(paginationSchema, 'query'),
  chatController.getChats.bind(chatController)
);

// Create/get direct chat
router.post('/direct', chatController.getOrCreateDirectChat.bind(chatController));

// Get event chat
router.get('/event/:eventId', chatController.getEventChat.bind(chatController));

// Chat by ID
router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  chatController.getChatById.bind(chatController)
);

// Messages
router.get(
  '/:id/messages',
  validate(idParamSchema, 'params'),
  validate(paginationSchema, 'query'),
  chatController.getMessages.bind(chatController)
);

router.post(
  '/:id/messages',
  validate(idParamSchema, 'params'),
  chatController.sendMessage.bind(chatController)
);

router.delete(
  '/:id/messages/:messageId',
  chatController.deleteMessage.bind(chatController)
);

// Mark as read
router.post(
  '/:id/read',
  validate(idParamSchema, 'params'),
  chatController.markAsRead.bind(chatController)
);

// Mute/unmute
router.post(
  '/:id/mute',
  validate(idParamSchema, 'params'),
  chatController.muteChat.bind(chatController)
);

router.post(
  '/:id/unmute',
  validate(idParamSchema, 'params'),
  chatController.unmuteChat.bind(chatController)
);

export default router;

