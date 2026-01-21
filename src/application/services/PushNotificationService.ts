import admin from '../../config/firebase.js';
import { userRepository } from '../../infrastructure/database/repositories/UserRepository.js';
import { notificationRepository } from '../../infrastructure/database/repositories/SocialRepository.js';
import { UserModel } from '../../infrastructure/database/models/User.model.js';
import { INotification } from '../../domain/entities/Social.js';
import { logger } from '../../shared/utils/logger.js';

interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export class PushNotificationService {
  /**
   * Send push notification to a user by their user ID
   */
  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
    notificationId?: string
  ): Promise<{ success: boolean; sentCount: number; failedCount: number }> {
    try {
      // Get user with FCM tokens
      const user = await userRepository.findById(userId);
      if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
        logger.warn(`No FCM tokens found for user ${userId}`);
        return { success: false, sentCount: 0, failedCount: 0 };
      }

      // Send to all user's devices
      const results = await this.sendToTokens(user.fcmTokens, payload);

      // Mark notification as pushed if notificationId is provided
      if (notificationId && results.success) {
        try {
          await notificationRepository.markAsPushed(notificationId);
        } catch (error) {
          logger.error(`Failed to mark notification ${notificationId} as pushed:`, error);
        }
      }

      return results;
    } catch (error) {
      logger.error(`Error sending push notification to user ${userId}:`, error);
      return { success: false, sentCount: 0, failedCount: 0 };
    }
  }

  /**
   * Send push notification to multiple FCM tokens
   */
  async sendToTokens(
    tokens: string[],
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; sentCount: number; failedCount: number }> {
    if (!tokens || tokens.length === 0) {
      return { success: false, sentCount: 0, failedCount: 0 };
    }

    const message: admin.messaging.MulticastMessage = {
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data
        ? Object.entries(payload.data).reduce(
            (acc, [key, value]) => {
              acc[key] = String(value);
              return acc;
            },
            {} as Record<string, string>
          )
        : undefined,
      tokens: tokens,
      android: {
        priority: 'high' as const,
        notification: {
          sound:  "boomghoomNotification.wav",
          channelId:  "boomghoom-default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);

      // Remove invalid tokens
      const invalidTokens: string[] = [];
      if (response.responses) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const errorCode = resp.error.code;
            if (
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(tokens[idx]);
            }
            logger.warn(`Failed to send to token ${tokens[idx]}: ${resp.error.message}`);
          }
        });
      }

      // Remove invalid tokens from user's device list
      if (invalidTokens.length > 0) {
        await this.removeInvalidTokens(invalidTokens);
      }

      const sentCount = response.successCount || 0;
      const failedCount = response.failureCount || 0;

      logger.info(
        `Push notification sent: ${sentCount} successful, ${failedCount} failed out of ${tokens.length} tokens`
      );

      return {
        success: sentCount > 0,
        sentCount,
        failedCount,
      };
    } catch (error) {
      logger.error('Error sending multicast push notification:', error);
      return { success: false, sentCount: 0, failedCount: tokens.length };
    }
  }

  /**
   * Send push notification after creating a notification in DB
   */
  async sendNotification(notification: INotification): Promise<void> {
    try {
      const payload: PushNotificationPayload = {
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification._id,
          type: notification.type,
          ...(notification.data?.eventId && { eventId: notification.data.eventId }),
          ...(notification.data?.userId && { userId: notification.data.userId }),
          ...(notification.data?.friendshipId && { friendshipId: notification.data.friendshipId }),
          ...(notification.data?.chatId && { chatId: notification.data.chatId }),
          ...(notification.data?.transactionId && { transactionId: notification.data.transactionId }),
        },
        imageUrl: notification.imageUrl,
      };
    
      await this.sendToUser(notification.userId, payload, notification._id);
      console.log('Push notification sent for notification', notification._id);
      logger.info(`Push notification sent for notification ${notification._id}`);
    } catch (error) {
      logger.error(`Error sending push notification for notification ${notification._id}:`, error);
      // Don't throw - we don't want notification creation to fail if push fails
    }
  }

  /**
   * Remove invalid FCM tokens from all users
   */
  private async removeInvalidTokens(tokens: string[]): Promise<void> {
    try {
      if (tokens.length === 0) return;

      // Use MongoDB to find and remove tokens from all users in one operation
      const result = await UserModel.updateMany(
        { fcmTokens: { $in: tokens } },
        { $pull: { fcmTokens: { $in: tokens } } }
      );
      logger.info(`Removed ${tokens.length} invalid FCM tokens from ${result.modifiedCount} users`);
    } catch (error) {
      logger.error('Error removing invalid FCM tokens:', error);
    }
  }
}

export const pushNotificationService = new PushNotificationService();
