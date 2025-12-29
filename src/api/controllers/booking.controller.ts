import { Request, Response, NextFunction } from 'express';
import { bookingService } from '../../application/services/BookingService.js';
import { sendSuccess, sendCreated } from '../../shared/utils/response.js';
import { IdParamInput } from '../validators/user.validator.js';
import { z } from 'zod';

export const createBookingSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  ticketCount: z.number().int().min(1).max(10),
  paymentMethod: z.enum(['upi', 'card', 'netbanking', 'wallet']),
  transactionId: z.string().optional(),
  couponCode: z.string().optional(),
  metadata: z
    .object({
      userDetails: z
        .object({
          name: z.string(),
          email: z.string().email().optional(),
          phoneNumber: z.string(),
        })
        .optional(),
    })
    .optional(),
});

export const confirmBookingSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
});

export const cancelBookingSchema = z.object({
  reason: z.string().optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

export class BookingController {
  async create(
    req: Request<unknown, unknown, CreateBookingInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await bookingService.createBooking({
        ...req.body,
        userId: req.userId!,
      });

      if (result.pass) {
        sendCreated(res, {
          booking: result.booking,
          pass: result.pass,
        }, 'Booking confirmed and pass generated');
      } else {
        sendCreated(res, result.booking, 'Booking created. Please complete payment.');
      }
    } catch (error) {
      next(error);
    }
  }

  async confirm(
    req: Request<IdParamInput, unknown, ConfirmBookingInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await bookingService.confirmBooking(
        req.params.id,
        req.body.transactionId
      );

      sendSuccess(res, {
        booking: result.booking,
        pass: result.pass,
      }, { message: 'Booking confirmed and pass generated' });
    } catch (error) {
      next(error);
    }
  }

  async getMyBookings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const bookings = await bookingService.getUserBookings(req.userId!);
      sendSuccess(res, bookings, { message: 'Bookings retrieved' });
    } catch (error) {
      next(error);
    }
  }

  async getById(
    req: Request<IdParamInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const booking = await bookingService.getBookingById(req.params.id);
      if (!booking) {
        return next(new Error('Booking not found'));
      }
      sendSuccess(res, booking, { message: 'Booking retrieved' });
    } catch (error) {
      next(error);
    }
  }

  async cancel(
    req: Request<IdParamInput, unknown, CancelBookingInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const booking = await bookingService.cancelBooking(
        req.params.id,
        req.userId!,
        req.body.reason
      );
      sendSuccess(res, booking, { message: 'Booking cancelled' });
    } catch (error) {
      next(error);
    }
  }
}

export const bookingController = new BookingController();

