import { Router } from 'express';
import { feedController } from '../controllers/feed.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Feed endpoints
router.get('/home', feedController.getHomeFeed.bind(feedController));
router.get('/discover', feedController.getDiscoverFeed.bind(feedController));
router.get('/events', feedController.getEventFeed.bind(feedController));

// Friend suggestions
router.get('/suggestions', feedController.getFriendSuggestions.bind(feedController));

export default router;
