import { Router } from 'express';
import { bookingController, createBookingSchema, confirmBookingSchema, cancelBookingSchema } from '../controllers/booking.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { idParamSchema } from '../validators/user.validator.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create booking
router.post(
  '/',
  validate(createBookingSchema),
  bookingController.create.bind(bookingController)
);

// Confirm booking after payment
router.post(
  '/:id/confirm',
  validate(idParamSchema, 'params'),
  validate(confirmBookingSchema),
  bookingController.confirm.bind(bookingController)
);

// Get user's bookings
router.get(
  '/my',
  bookingController.getMyBookings.bind(bookingController)
);

// Get booking by ID
router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  bookingController.getById.bind(bookingController)
);

// Cancel booking
router.post(
  '/:id/cancel',
  validate(idParamSchema, 'params'),
  validate(cancelBookingSchema),
  bookingController.cancel.bind(bookingController)
);

export default router;

