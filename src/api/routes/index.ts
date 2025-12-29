import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import eventRoutes from './event.routes.js';
import financeRoutes from './finance.routes.js';
import socialRoutes from './social.routes.js';
import chatRoutes from './chat.routes.js';
import bookingRoutes from './booking.routes.js';
import passRoutes from './pass.routes.js';
import uploadRoutes from './upload.routes.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'BoomGhoom API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/events', eventRoutes);
router.use('/finance', financeRoutes);
router.use('/social', socialRoutes);
router.use('/chats', chatRoutes);
router.use('/bookings', bookingRoutes);
router.use('/passes', passRoutes);
router.use('/upload', uploadRoutes);

export default router;

