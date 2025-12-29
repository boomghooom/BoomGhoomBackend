import QRCode from 'qrcode';
import { PassModel, IPassDocument } from '../../infrastructure/database/models/Pass.model.js';
import { BookingModel } from '../../infrastructure/database/models/Booking.model.js';
import { EventModel } from '../../infrastructure/database/models/Event.model.js';
import { UserModel } from '../../infrastructure/database/models/User.model.js';
import { getS3Storage } from '../../infrastructure/storage/S3Storage.js';
import { NotFoundError, InternalServerError } from '../../shared/errors/AppError.js';
import { logger, logWithContext } from '../../shared/utils/logger.js';
import { config } from '../../config/index.js';
import axios from 'axios';

export interface IGeneratePassData {
  bookingId: string;
  userId: string;
  eventId: string;
  sponsorId?: string;
}

export interface IPassGenerationResult {
  pass: IPassDocument;
  qrCodeUrl: string;
  passCode: string;
}

export interface ISendPassNotificationResult {
  emailSent: boolean;
  whatsappSent: boolean;
}

export class PassService {
  private s3Storage = getS3Storage();

  /**
   * Generate QR code data string
   */
  private generateQRCodeData(passCode: string, bookingId: string, eventId: string): string {
    const data = {
      passCode,
      bookingId,
      eventId,
      timestamp: Date.now(),
      platform: 'BoomGhoom',
    };
    return JSON.stringify(data);
  }

  /**
   * Generate QR code image and upload to S3
   */
  private async generateAndUploadQRCode(
    qrCodeData: string,
    passCode: string
  ): Promise<string> {
    try {
      // Generate QR code as buffer
      const qrCodeBuffer = await QRCode.toBuffer(qrCodeData, {
        errorCorrectionLevel: 'H',
        type: 'png',
        width: 500,
        margin: 2,
      });

      // Upload to S3
      const uploadResult = await this.s3Storage.upload({
        file: qrCodeBuffer,
        fileName: `pass-${passCode}.png`,
        mimeType: 'image/png',
        folder: 'passes/qr-codes',
      });

      logger.info('QR code generated and uploaded', { passCode, url: uploadResult.url });
      return uploadResult.url;
    } catch (error) {
      logger.error('Failed to generate QR code', { error, passCode });
      throw new InternalServerError('Failed to generate pass QR code', 'QR_GENERATION_FAILED');
    }
  }

  /**
   * Generate pass for a booking
   */
  async generatePass(data: IGeneratePassData): Promise<IPassGenerationResult> {
    const { bookingId, userId, eventId, sponsorId } = data;

    // Fetch booking
    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    // Check if pass already exists
    const existingPass = await PassModel.findOne({ bookingId });
    if (existingPass) {
      logger.info('Pass already exists for booking', { bookingId, passCode: existingPass.passCode });
      return {
        pass: existingPass,
        qrCodeUrl: existingPass.qrCodeUrl,
        passCode: existingPass.passCode,
      };
    }

    // Fetch event
    const event = await EventModel.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
    }

    // Fetch user
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Generate pass code
    const passCode = `PASS${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Generate QR code data
    const qrCodeData = this.generateQRCodeData(passCode, bookingId, eventId);

    // Generate and upload QR code
    const qrCodeUrl = await this.generateAndUploadQRCode(qrCodeData, passCode);

    // Create pass document
    const pass = await PassModel.create({
      passCode,
      bookingId,
      userId,
      eventId,
      sponsorId,
      qrCodeUrl,
      qrCodeData,
      status: 'active',
      eventDetails: {
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        venueName: event.location.venueName,
        address: event.location.address,
        city: event.location.city,
      },
      userDetails: {
        name: user.fullName,
        phoneNumber: user.phoneNumber,
        email: user.email,
      },
      bookingDetails: {
        bookingId: booking.bookingId,
        ticketCount: booking.ticketCount,
        bookingDate: booking.createdAt,
      },
      expiresAt: event.endTime, // Pass expires after event ends
    });

    // Update booking with pass reference
    booking.passId = pass._id;
    booking.passGenerated = true;
    await booking.save();

    logWithContext.event('Pass generated successfully', {
      passCode,
      bookingId,
      eventId,
      userId,
    });

    return {
      pass,
      qrCodeUrl,
      passCode,
    };
  }

  /**
   * Send pass via email
   */
  private async sendPassEmail(
    email: string,
    passCode: string,
    qrCodeUrl: string,
    eventTitle: string,
    userName: string,
    venueName: string,
    startTime: Date
  ): Promise<boolean> {
    try {
      // TODO: Implement email service (using SendGrid, AWS SES, etc.)
      // For now, we'll use a simple email API or log it
      
      const emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .qr-code { text-align: center; margin: 20px 0; }
            .details { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Event Pass - BoomGhoom</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>Your booking has been confirmed! Here's your event pass:</p>
              
              <div class="details">
                <h3>Event Details</h3>
                <p><strong>Event:</strong> ${eventTitle}</p>
                <p><strong>Venue:</strong> ${venueName}</p>
                <p><strong>Date & Time:</strong> ${new Date(startTime).toLocaleString('en-IN')}</p>
                <p><strong>Pass Code:</strong> ${passCode}</p>
              </div>
              
              <div class="qr-code">
                <p><strong>Scan this QR code at the venue:</strong></p>
                <img src="${qrCodeUrl}" alt="QR Code" style="max-width: 300px;" />
              </div>
              
              <p><strong>Important:</strong> Please show this QR code at the event venue for entry.</p>
            </div>
            <div class="footer">
              <p>Thank you for using BoomGhoom!</p>
              <p>If you have any questions, please contact our support team.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // TODO: Replace with actual email service
      // For now, log it
      logger.info('Pass email would be sent', {
        email,
        passCode,
        eventTitle,
      });

      // If you have an email service configured, use it here
      // Example: await emailService.send({ to: email, subject: 'Your Event Pass', html: emailBody });

      return true;
    } catch (error) {
      logger.error('Failed to send pass email', { error, email, passCode });
      return false;
    }
  }

  /**
   * Send pass via WhatsApp
   */
  private async sendPassWhatsApp(
    phoneNumber: string,
    passCode: string,
    qrCodeUrl: string,
    eventTitle: string,
    userName: string,
    venueName: string,
    startTime: Date
  ): Promise<boolean> {
    try {
      const message = `🎉 *Your Event Pass - BoomGhoom*

Hello ${userName},

Your booking has been confirmed!

*Event Details:*
📅 Event: ${eventTitle}
📍 Venue: ${venueName}
🕐 Date & Time: ${new Date(startTime).toLocaleString('en-IN')}
🎫 Pass Code: ${passCode}

*QR Code:* ${qrCodeUrl}

Please show this QR code at the event venue for entry.

Thank you for using BoomGhoom!`;

      // Use SMS API for WhatsApp (if supported) or use WhatsApp Business API
      const url = `${config.sms.apiUrl}?api_id=${config.sms.apiId}&api_password=${config.sms.apiPassword}&sms_type=text&sms_encoding=text&sender=${config.sms.sender}&number=${phoneNumber}&message=${encodeURIComponent(message)}`;

      const response = await axios.get(url);
      
      if (response?.data?.code === 200) {
        logger.info('Pass WhatsApp sent successfully', { phoneNumber, passCode });
        return true;
      } else {
        logger.error('WhatsApp API error', { response: response?.data, phoneNumber });
        return false;
      }
    } catch (error) {
      logger.error('Failed to send pass WhatsApp', { error, phoneNumber, passCode });
      return false;
    }
  }

  /**
   * Send pass notifications (email and WhatsApp)
   */
  async sendPassNotifications(passId: string): Promise<ISendPassNotificationResult> {
    const pass = await PassModel.findById(passId)
      .populate('eventId')
      .populate('userId');

    if (!pass) {
      throw new NotFoundError('Pass not found', 'PASS_NOT_FOUND');
    }

    const event = pass.eventDetails;
    const user = pass.userDetails;

    // Send email if available
    let emailSent = false;
    if (user.email) {
      emailSent = await this.sendPassEmail(
        user.email,
        pass.passCode,
        pass.qrCodeUrl,
        event.title,
        user.name,
        event.venueName,
        event.startTime
      );
    }

    // Send WhatsApp
    const whatsappSent = await this.sendPassWhatsApp(
      user.phoneNumber,
      pass.passCode,
      pass.qrCodeUrl,
      event.title,
      user.name,
      event.venueName,
      event.startTime
    );

    // Update booking passSent status
    const booking = await BookingModel.findById(pass.bookingId);
    if (booking) {
      booking.passSent = emailSent || whatsappSent;
      await booking.save();
    }

    logWithContext.event('Pass notifications sent', {
      passId,
      passCode: pass.passCode,
      emailSent,
      whatsappSent,
    });

    return { emailSent, whatsappSent };
  }

  /**
   * Verify pass by scanning QR code
   */
  async verifyPass(
    passCode: string,
    verifiedBy: string,
    verifiedByType: 'staff' | 'sponsor'
  ): Promise<IPassDocument> {
    const pass = await PassModel.findOne({ passCode });

    if (!pass) {
      throw new NotFoundError('Invalid pass code', 'INVALID_PASS_CODE');
    }

    if (pass.status !== 'active') {
      throw new NotFoundError(
        `Pass is ${pass.status}`,
        `PASS_${pass.status.toUpperCase()}`
      );
    }

    // Check if pass has expired
    if (pass.expiresAt && new Date() > pass.expiresAt) {
      pass.status = 'expired';
      await pass.save();
      throw new NotFoundError('Pass has expired', 'PASS_EXPIRED');
    }

    // Update pass as used
    pass.status = 'used';
    pass.verifiedAt = new Date();
    pass.verifiedBy = verifiedBy as any;
    pass.verifiedByType = verifiedByType;
    await pass.save();

    logWithContext.event('Pass verified', {
      passCode,
      verifiedBy,
      verifiedByType,
      bookingId: pass.bookingId.toString(),
    });

    return pass;
  }

  /**
   * Get pass details by pass code
   */
  async getPassByCode(passCode: string): Promise<IPassDocument | null> {
    return PassModel.findByPassCode(passCode);
  }

  /**
   * Get user passes
   */
  async getUserPasses(userId: string, limit = 50): Promise<IPassDocument[]> {
    return PassModel.findByUser(userId, limit);
  }

  /**
   * Get event passes
   */
  async getEventPasses(eventId: string): Promise<IPassDocument[]> {
    return PassModel.findByEvent(eventId);
  }
}

// Singleton instance
let passServiceInstance: PassService | null = null;

export const getPassService = (): PassService => {
  if (!passServiceInstance) {
    passServiceInstance = new PassService();
  }
  return passServiceInstance;
};

export const passService = getPassService();

