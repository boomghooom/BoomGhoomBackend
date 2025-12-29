import { BookingModel, IBookingDocument } from '../../infrastructure/database/models/Booking.model.js';
import { EventModel } from '../../infrastructure/database/models/Event.model.js';
import { UserModel } from '../../infrastructure/database/models/User.model.js';
import { SponsorModel } from '../../infrastructure/database/models/Sponsor.model.js';
import { TransactionModel } from '../../infrastructure/database/models/Transaction.model.js';
import { passService } from './PassService.js';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  InternalServerError,
} from '../../shared/errors/AppError.js';
import { logger, logWithContext } from '../../shared/utils/logger.js';
import { config } from '../../config/index.js';

export interface ICreateBookingDTO {
  userId: string;
  eventId: string;
  ticketCount: number;
  paymentMethod: 'upi' | 'card' | 'netbanking' | 'wallet';
  transactionId?: string;
  couponCode?: string;
  metadata?: {
    userDetails?: {
      name: string;
      email?: string;
      phoneNumber: string;
    };
  };
}

export interface IBookingResult {
  booking: IBookingDocument;
  pass?: {
    passCode: string;
    qrCodeUrl: string;
  };
}

export class BookingService {
  /**
   * Calculate booking amount with platform charge
   */
  private calculateBookingAmount(
    eventPrice: number,
    ticketCount: number,
    bookingCharge: number,
    discountPercentage?: number
  ): {
    eventPrice: number;
    bookingCharge: number;
    discountAmount: number;
    finalAmount: number;
  } {
    const totalEventPrice = eventPrice * ticketCount;
    const totalBookingCharge = bookingCharge * ticketCount;
    
    let discountAmount = 0;
    if (discountPercentage && discountPercentage > 0) {
      discountAmount = Math.floor((totalEventPrice * discountPercentage) / 100);
    }

    const finalAmount = totalEventPrice + totalBookingCharge - discountAmount;

    return {
      eventPrice: totalEventPrice,
      bookingCharge: totalBookingCharge,
      discountAmount,
      finalAmount,
    };
  }

  /**
   * Create a booking for an event
   */
  async createBooking(data: ICreateBookingDTO): Promise<IBookingResult> {
    const { userId, eventId, ticketCount, paymentMethod, transactionId, couponCode, metadata } = data;

    // Fetch event
    const event = await EventModel.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    // Check if event is published
    if (!event.isPublished || event.status !== 'upcoming') {
      throw new BadRequestError('Event is not available for booking', 'EVENT_NOT_AVAILABLE');
    }

    // Check if spots are available
    const availableSpots = event.eligibility.memberLimit - event.participantCount;
    if (availableSpots < ticketCount) {
      throw new BadRequestError(
        `Only ${availableSpots} spots available`,
        'INSUFFICIENT_SPOTS'
      );
    }

    // Fetch user
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Check if user already has a booking for this event
    const existingBooking = await BookingModel.findOne({
      userId,
      eventId,
      status: { $in: ['pending', 'confirmed'] },
    });

    if (existingBooking) {
      throw new BadRequestError('You already have a booking for this event', 'DUPLICATE_BOOKING');
    }

    // Determine event type and get sponsor if sponsored
    let sponsorId: string | undefined;
    let bookingCharge = config.business.bookingCharge || 1500; // Default 15 Rs

    if (event.type === 'sponsored' && event.sponsorId) {
      const sponsor = await SponsorModel.findById(event.sponsorId);
      if (sponsor && sponsor.isActive && sponsor.status === 'approved') {
        sponsorId = sponsor._id.toString();
        bookingCharge = sponsor.bookingCharge || bookingCharge;
      }
    }

    // Calculate pricing
    const eventPrice = event.pricing.isFree ? 0 : (event.pricing.price || 0);
    
    // Apply coupon if provided
    let discountPercentage = 0;
    if (couponCode && event.coupons.length > 0) {
      const coupon = event.coupons.find(
        (c) => c.code === couponCode.toUpperCase() && c.isActive && c.usedCount < c.usageLimit
      );
      if (coupon) {
        discountPercentage = coupon.discountPercentage;
      }
    }

    const amounts = this.calculateBookingAmount(eventPrice, ticketCount, bookingCharge, discountPercentage);

    // Create booking
    const booking = await BookingModel.create({
      userId,
      eventId,
      sponsorId,
      type: event.type,
      status: 'pending',
      ticketCount,
      totalAmount: amounts.eventPrice + amounts.bookingCharge,
      bookingCharge: amounts.bookingCharge,
      eventPrice: amounts.eventPrice,
      discountAmount: amounts.discountAmount,
      finalAmount: amounts.finalAmount,
      currency: 'INR',
      paymentMethod,
      transactionId: transactionId ? (transactionId as any) : undefined,
      passGenerated: false,
      passSent: false,
      metadata: {
        couponCode: couponCode?.toUpperCase(),
        discountPercentage,
        userDetails: metadata?.userDetails || {
          name: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
        },
      },
    });

    // If transaction ID is provided, confirm booking
    if (transactionId) {
      booking.status = 'confirmed';
      await booking.save();

      // Generate pass
      const passResult = await passService.generatePass({
        bookingId: booking._id.toString(),
        userId,
        eventId,
        sponsorId,
      });

      // Send notifications
      await passService.sendPassNotifications(passResult.pass._id.toString());

      // Update event participant count
      event.participantCount += ticketCount;
      await event.save();

      // Update sponsor stats if sponsored
      if (sponsorId) {
        await SponsorModel.findByIdAndUpdate(sponsorId, {
          $inc: { totalBookings: ticketCount, totalRevenue: amounts.finalAmount },
        });
      }

      logWithContext.event('Booking confirmed and pass generated', {
        bookingId: booking.bookingId,
        eventId,
        userId,
        passCode: passResult.passCode,
      });

      return {
        booking,
        pass: {
          passCode: passResult.passCode,
          qrCodeUrl: passResult.qrCodeUrl,
        },
      };
    }

    logWithContext.event('Booking created (pending payment)', {
      bookingId: booking.bookingId,
      eventId,
      userId,
    });

    return { booking };
  }

  /**
   * Confirm booking after payment
   */
  async confirmBooking(
    bookingId: string,
    transactionId: string
  ): Promise<IBookingResult> {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (booking.status !== 'pending') {
      throw new BadRequestError(`Booking is already ${booking.status}`, 'INVALID_BOOKING_STATUS');
    }

    // Update booking
    booking.status = 'confirmed';
    booking.transactionId = transactionId as any;
    await booking.save();

    // Generate pass
    const passResult = await passService.generatePass({
      bookingId: booking._id.toString(),
      userId: booking.userId.toString(),
      eventId: booking.eventId.toString(),
      sponsorId: booking.sponsorId?.toString(),
    });

    // Send notifications
    await passService.sendPassNotifications(passResult.pass._id.toString());

    // Update event participant count
    const event = await EventModel.findById(booking.eventId);
    if (event) {
      event.participantCount += booking.ticketCount;
      await event.save();
    }

    // Update sponsor stats if sponsored
    if (booking.sponsorId) {
      await SponsorModel.findByIdAndUpdate(booking.sponsorId, {
        $inc: { totalBookings: booking.ticketCount, totalRevenue: booking.finalAmount },
      });
    }

    logWithContext.event('Booking confirmed', {
      bookingId: booking.bookingId,
      eventId: booking.eventId.toString(),
      passCode: passResult.passCode,
    });

    return {
      booking,
      pass: {
        passCode: passResult.passCode,
        qrCodeUrl: passResult.qrCodeUrl,
      },
    };
  }

  /**
   * Get user bookings
   */
  async getUserBookings(userId: string, limit = 50): Promise<IBookingDocument[]> {
    return BookingModel.findByUser(userId, limit);
  }

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId: string): Promise<IBookingDocument | null> {
    return BookingModel.findById(bookingId)
      .populate('eventId', 'title startTime location')
      .populate('passId', 'passCode qrCodeUrl status');
  }

  /**
   * Get booking by booking ID (reference)
   */
  async getBookingByBookingId(bookingId: string): Promise<IBookingDocument | null> {
    return BookingModel.findByBookingId(bookingId);
  }

  /**
   * Cancel booking
   */
  async cancelBooking(
    bookingId: string,
    userId: string,
    reason?: string
  ): Promise<IBookingDocument> {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (booking.userId.toString() !== userId) {
      throw new ForbiddenError('Not authorized to cancel this booking', 'NOT_AUTHORIZED');
    }

    if (booking.status === 'cancelled') {
      throw new BadRequestError('Booking is already cancelled', 'ALREADY_CANCELLED');
    }

    if (booking.status === 'refunded') {
      throw new BadRequestError('Booking is already refunded', 'ALREADY_REFUNDED');
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason;
    await booking.save();

    // Update event participant count
    const event = await EventModel.findById(booking.eventId);
    if (event && booking.status === 'confirmed') {
      event.participantCount = Math.max(0, event.participantCount - booking.ticketCount);
      await event.save();
    }

    logWithContext.event('Booking cancelled', {
      bookingId: booking.bookingId,
      eventId: booking.eventId.toString(),
      userId,
    });

    return booking;
  }
}

// Singleton instance
let bookingServiceInstance: BookingService | null = null;

export const getBookingService = (): BookingService => {
  if (!bookingServiceInstance) {
    bookingServiceInstance = new BookingService();
  }
  return bookingServiceInstance;
};

export const bookingService = getBookingService();

