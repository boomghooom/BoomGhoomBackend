import mongoose from 'mongoose';
import { config } from '../../config/index.js';
import {
  transactionRepository,
  withdrawalRepository,
  commissionRepository,
  dueRepository,
  paymentOrderRepository,
} from '../../infrastructure/database/repositories/FinanceRepository.js';
import { userRepository } from '../../infrastructure/database/repositories/UserRepository.js';
import { eventRepository } from '../../infrastructure/database/repositories/EventRepository.js';
import { notificationRepository } from '../../infrastructure/database/repositories/SocialRepository.js';
import { redisClient } from '../../config/redis.js';
import {
  ITransaction,
  IWithdrawal,
  ICommission,
  IDue,
  IPaymentOrder,
  IFinanceSummary,
  ITransactionQuery,
} from '../../domain/entities/Finance.js';
import { IPaginationOptions, IPaginatedResult } from '../../domain/repositories/IBaseRepository.js';
import {
  NotFoundError,
  BadRequestError,
  InsufficientBalanceError,
  WithdrawalLimitError,
} from '../../shared/errors/AppError.js';
import { CacheKeys, TransactionStatus, TransactionType, PaymentMethod } from '../../shared/constants/index.js';
import { logWithContext, logger } from '../../shared/utils/logger.js';

export interface ICreatePaymentOrderDTO {
  userId: string;
  purpose: 'clear_dues' | 'event_ticket' | 'withdrawal_fee';
  amount: number;
  dueIds?: string[];
  eventId?: string;
  withdrawalId?: string;
}

export interface IPaymentCallbackDTO {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature: string;
  status: 'success' | 'failed';
}

export class FinanceService {
  async getFinanceSummary(userId: string): Promise<IFinanceSummary> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    return {
      dues: user.finance.dues,
      pendingCommission: user.finance.pendingCommission,
      availableCommission: user.finance.availableCommission,
      totalEarned: user.finance.totalEarned,
      totalWithdrawn: user.finance.totalWithdrawn,
      canWithdraw: user.finance.availableCommission >= config.business.minWithdrawalAmount,
      minWithdrawalAmount: config.business.minWithdrawalAmount,
    };
  }

  async getTransactionHistory(
    userId: string,
    query: ITransactionQuery,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<ITransaction>> {
    return transactionRepository.findByQuery({ ...query, userId }, options);
  }

  async getPendingDues(userId: string): Promise<IDue[]> {
    return dueRepository.findPendingByUser(userId);
  }

  async getTotalPendingDues(userId: string): Promise<number> {
    return dueRepository.getTotalPending(userId);
  }

  async getCommissionHistory(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<ICommission>> {
    return commissionRepository.findByAdmin(userId, options);
  }

  async getWithdrawalHistory(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IWithdrawal>> {
    return withdrawalRepository.findByUser(userId, options);
  }

  async createPaymentOrder(data: ICreatePaymentOrderDTO): Promise<IPaymentOrder> {
    const user = await userRepository.findById(data.userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Validate amount
    if (data.amount <= 0) {
      throw new BadRequestError('Invalid amount', 'INVALID_AMOUNT');
    }

    // For clearing dues, verify the dues exist
    if (data.purpose === 'clear_dues' && data.dueIds) {
      const dues = await Promise.all(
        data.dueIds.map((id) => dueRepository.findById(id))
      );
      const totalDues = dues
        .filter((d) => d && d.status === 'pending')
        .reduce((sum, d) => sum + (d?.amount || 0), 0);

      if (totalDues !== data.amount) {
        throw new BadRequestError('Amount mismatch with dues', 'AMOUNT_MISMATCH');
      }
    }

    // Calculate fees
    const gatewayFee = Math.ceil(
      (data.amount * config.business.paymentGatewayFeePercentage) / 100
    );
    const gst = Math.ceil((gatewayFee * config.business.gstPercentage) / 100);
    const totalAmount = data.amount + gatewayFee + gst;

    // Create gateway order (this should call actual payment gateway)
    const gatewayOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const paymentOrder = await paymentOrderRepository.create({
      userId: data.userId,
      purpose: data.purpose,
      amount: totalAmount,
      currency: 'INR',
      status: 'created',
      gatewayOrderId,
      gatewayProvider: 'razorpay', // or 'cashfree'
      metadata: {
        dueIds: data.dueIds,
        eventId: data.eventId,
        withdrawalId: data.withdrawalId,
      },
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    });

    logWithContext.payment('Payment order created', {
      orderId: paymentOrder._id,
      userId: data.userId,
      amount: totalAmount,
    });

    return paymentOrder;
  }

  async handlePaymentCallback(data: IPaymentCallbackDTO): Promise<ITransaction> {
    const paymentOrder = await paymentOrderRepository.findByGatewayOrderId(data.gatewayOrderId);
    if (!paymentOrder) {
      throw new NotFoundError('Payment order not found', 'ORDER_NOT_FOUND');
    }

    if (paymentOrder.status === 'paid') {
      throw new BadRequestError('Payment already processed', 'ALREADY_PROCESSED');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (data.status === 'success') {
        // Update payment order
        await paymentOrderRepository.updateStatus(paymentOrder._id, 'paid', session);

        // Create transaction record
        const transaction = await transactionRepository.createWithSession(
          {
            userId: paymentOrder.userId,
            type: paymentOrder.purpose === 'clear_dues' ? 'due_cleared' : 'event_payment',
            amount: paymentOrder.amount,
            description: `Payment for ${paymentOrder.purpose}`,
            referenceId: data.gatewayPaymentId,
          },
          session
        );

        // Process based on purpose
        if (paymentOrder.purpose === 'clear_dues' && paymentOrder.metadata?.dueIds) {
          await this.processDuesCleared(
            paymentOrder.userId,
            paymentOrder.metadata.dueIds as string[],
            transaction._id,
            session
          );
        }

        await session.commitTransaction();

        logWithContext.payment('Payment successful', {
          orderId: paymentOrder._id,
          transactionId: transaction._id,
        });

        return transaction;
      } else {
        // Payment failed
        await paymentOrderRepository.updateStatus(paymentOrder._id, 'failed', session);

        const transaction = await transactionRepository.createWithSession(
          {
            userId: paymentOrder.userId,
            type: paymentOrder.purpose === 'clear_dues' ? 'due_cleared' : 'event_payment',
            amount: paymentOrder.amount,
            description: `Failed payment for ${paymentOrder.purpose}`,
            referenceId: data.gatewayPaymentId,
          },
          session
        );

        await transactionRepository.updateStatus(transaction._id, 'failed', {
          failureReason: 'Payment failed at gateway',
        });

        await session.commitTransaction();

        logWithContext.payment('Payment failed', {
          orderId: paymentOrder._id,
          transactionId: transaction._id,
        });

        return transaction;
      }
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async clearDuesWithCommission(userId: string, dueIds: string[]): Promise<ITransaction> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Get pending dues
    const dues = await Promise.all(dueIds.map((id) => dueRepository.findById(id)));
    const validDues = dues.filter((d) => d && d.status === 'pending' && d.userId === userId);

    if (validDues.length === 0) {
      throw new BadRequestError('No valid pending dues found', 'NO_DUES');
    }

    const totalDues = validDues.reduce((sum, d) => sum + (d?.amount || 0), 0);

    if (user.finance.availableCommission < totalDues) {
      throw new InsufficientBalanceError(
        `Insufficient commission balance. Need ₹${(totalDues / 100).toFixed(2)}, have ₹${(user.finance.availableCommission / 100).toFixed(2)}`
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create transaction
      const transaction = await transactionRepository.createWithSession(
        {
          userId,
          type: 'due_cleared',
          amount: totalDues,
          description: 'Dues cleared using commission balance',
          paymentMethod: 'commission',
        },
        session
      );

      // Process dues
      await this.processDuesCleared(userId, dueIds, transaction._id, session);

      // Deduct from commission
      await userRepository.updateFinance(
        userId,
        {
          availableCommission: user.finance.availableCommission - totalDues,
        },
        session
      );

      // Update transaction status
      await transactionRepository.updateStatus(transaction._id, 'completed', undefined, session);

      await session.commitTransaction();

      // Invalidate cache
      await redisClient.del(CacheKeys.USER(userId));

      logWithContext.payment('Dues cleared with commission', {
        userId,
        amount: totalDues,
        dueCount: validDues.length,
      });

      return transaction;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async requestWithdrawal(userId: string): Promise<IWithdrawal> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    if (!user.bankDetails || !user.bankDetails.isVerified) {
      throw new BadRequestError('Bank details not verified', 'BANK_NOT_VERIFIED');
    }

    const availableAmount = user.finance.availableCommission;

    if (availableAmount < config.business.minWithdrawalAmount) {
      throw new WithdrawalLimitError(
        `Minimum withdrawal amount is ₹${(config.business.minWithdrawalAmount / 100).toFixed(2)}. You have ₹${(availableAmount / 100).toFixed(2)}`
      );
    }

    // Calculate fees
    const gatewayFee = Math.ceil(
      (availableAmount * config.business.paymentGatewayFeePercentage) / 100
    );
    const gst = Math.ceil((gatewayFee * config.business.gstPercentage) / 100);
    const netAmount = availableAmount - gatewayFee - gst;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create withdrawal request
      const withdrawal = await withdrawalRepository.create({
        userId,
        amount: availableAmount,
        currency: 'INR',
        status: 'pending',
        bankDetails: user.bankDetails,
        gatewayFee,
        gst,
        netAmount,
      });

      // Deduct from available commission
      await userRepository.updateFinance(
        userId,
        { availableCommission: 0 },
        session
      );

      // Create transaction record
      await transactionRepository.createWithSession(
        {
          userId,
          type: 'withdrawal_requested',
          amount: availableAmount,
          description: 'Withdrawal requested',
        },
        session
      );

      // Update commission records to withdrawn
      const availableCommissions = await commissionRepository.findAvailableByAdmin(userId);
      for (const commission of availableCommissions) {
        await commissionRepository.updateStatus(commission._id, 'withdrawn', {
          withdrawalId: withdrawal._id,
        });
      }

      await session.commitTransaction();

      // Invalidate cache
      await redisClient.del(CacheKeys.USER(userId));

      // Send notification
      await notificationRepository.create({
        userId,
        type: 'withdrawal_completed',
        title: 'Withdrawal Requested',
        body: `Your withdrawal of ₹${(netAmount / 100).toFixed(2)} is being processed`,
        data: { transactionId: withdrawal._id },
      });

      logWithContext.payment('Withdrawal requested', {
        userId,
        withdrawalId: withdrawal._id,
        amount: availableAmount,
        netAmount,
      });

      return withdrawal;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async processWithdrawal(
    withdrawalId: string,
    status: 'completed' | 'failed',
    utrNumber?: string,
    failureReason?: string
  ): Promise<IWithdrawal> {
    const withdrawal = await withdrawalRepository.findById(withdrawalId);
    if (!withdrawal) {
      throw new NotFoundError('Withdrawal not found', 'NOT_FOUND');
    }

    if (withdrawal.status !== 'pending' && withdrawal.status !== 'processing') {
      throw new BadRequestError('Withdrawal already processed', 'ALREADY_PROCESSED');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const updatedWithdrawal = await withdrawalRepository.updateStatus(
        withdrawalId,
        status,
        { utrNumber, failureReason },
        session
      );

      if (!updatedWithdrawal) {
        throw new NotFoundError('Withdrawal not found', 'NOT_FOUND');
      }

      if (status === 'completed') {
        // Update user total withdrawn
        const user = await userRepository.findById(withdrawal.userId);
        if (user) {
          await userRepository.updateFinance(
            withdrawal.userId,
            {
              totalWithdrawn: user.finance.totalWithdrawn + withdrawal.netAmount,
            },
            session
          );
        }

        // Create transaction record
        await transactionRepository.createWithSession(
          {
            userId: withdrawal.userId,
            type: 'withdrawal_completed',
            amount: withdrawal.netAmount,
            description: `Withdrawal completed. UTR: ${utrNumber}`,
          },
          session
        );

        // Send success notification
        await notificationRepository.create({
          userId: withdrawal.userId,
          type: 'withdrawal_completed',
          title: 'Withdrawal Successful! 🎉',
          body: `₹${(withdrawal.netAmount / 100).toFixed(2)} has been credited to your bank account`,
          data: { transactionId: withdrawal._id },
        });
      } else {
        // Refund to available commission
        const user = await userRepository.findById(withdrawal.userId);
        if (user) {
          await userRepository.updateFinance(
            withdrawal.userId,
            {
              availableCommission: user.finance.availableCommission + withdrawal.amount,
            },
            session
          );
        }

        // Create failed transaction record
        await transactionRepository.createWithSession(
          {
            userId: withdrawal.userId,
            type: 'withdrawal_failed',
            amount: withdrawal.amount,
            description: `Withdrawal failed: ${failureReason}`,
          },
          session
        );

        // Send failure notification
        await notificationRepository.create({
          userId: withdrawal.userId,
          type: 'withdrawal_completed',
          title: 'Withdrawal Failed',
          body: `Your withdrawal failed: ${failureReason}. Amount has been refunded to your commission balance.`,
          data: { transactionId: withdrawal._id },
        });
      }

      await session.commitTransaction();

      // Invalidate cache
      await redisClient.del(CacheKeys.USER(withdrawal.userId));

      logWithContext.payment('Withdrawal processed', {
        withdrawalId,
        status,
        utrNumber,
      });

      return updatedWithdrawal;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async processReferralReward(referrerId: string, amount: number): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await userRepository.findById(referrerId);
      if (!user) {
        throw new NotFoundError('User not found', 'USER_NOT_FOUND');
      }

      // Create transaction
      await transactionRepository.createWithSession(
        {
          userId: referrerId,
          type: 'referral_reward',
          amount,
          description: 'Referral reward earned',
        },
        session
      );

      // Add to available commission
      await userRepository.updateFinance(
        referrerId,
        {
          availableCommission: user.finance.availableCommission + amount,
          totalEarned: user.finance.totalEarned + amount,
        },
        session
      );

      await session.commitTransaction();

      // Invalidate cache
      await redisClient.del(CacheKeys.USER(referrerId));

      // Send notification
      await notificationRepository.create({
        userId: referrerId,
        type: 'referral_reward',
        title: 'Referral Reward! 🎁',
        body: `You earned ₹${(amount / 100).toFixed(2)} from a referral`,
      });

      logWithContext.payment('Referral reward processed', { referrerId, amount });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private async processDuesCleared(
    userId: string,
    dueIds: string[],
    transactionId: string,
    session: mongoose.ClientSession
  ): Promise<void> {
    const clearedCount = await dueRepository.clearMultipleDues(
      dueIds,
      'payment',
      transactionId,
      session
    );

    // Get the dues to calculate total
    const dues = await Promise.all(dueIds.map((id) => dueRepository.findById(id)));
    const totalCleared = dues.reduce((sum, d) => sum + (d?.amount || 0), 0);

    // Update user dues
    const user = await userRepository.findById(userId);
    if (user) {
      await userRepository.updateFinance(
        userId,
        { dues: Math.max(0, user.finance.dues - totalCleared) },
        session
      );
    }

    // Update event dues stats and check commission availability
    for (const due of dues) {
      if (due) {
        await eventRepository.updateDuesStats(due.eventId, 0, due.amount, session);

        // Update participant dues status
        await eventRepository.updateParticipantStatus(
          due.eventId,
          userId,
          'approved',
          { duesCleared: true }
        );

        // Check if all dues for event are cleared
        const commission = await commissionRepository.findByEvent(due.eventId);
        if (commission && commission.status === 'pending') {
          await commissionRepository.incrementDueCleared(due.eventId, session);

          // Check if all cleared
          const updatedCommission = await commissionRepository.findByEvent(due.eventId);
          if (
            updatedCommission &&
            updatedCommission.participantsDueCleared >= updatedCommission.participantsCount
          ) {
            await commissionRepository.updateStatus(
              updatedCommission._id,
              'available',
              undefined,
              session
            );

            // Move from pending to available for admin
            const admin = await userRepository.findById(updatedCommission.adminId);
            if (admin) {
              await userRepository.updateFinance(
                updatedCommission.adminId,
                {
                  pendingCommission: Math.max(
                    0,
                    admin.finance.pendingCommission - updatedCommission.adminShare
                  ),
                  availableCommission:
                    admin.finance.availableCommission + updatedCommission.adminShare,
                },
                session
              );

              // Notify admin
              await notificationRepository.create({
                userId: updatedCommission.adminId,
                type: 'commission_available',
                title: 'Commission Available! 💰',
                body: `₹${(updatedCommission.adminShare / 100).toFixed(2)} commission from ${commission.eventTitle} is now available for withdrawal`,
                data: { eventId: due.eventId },
              });
            }
          }
        }
      }
    }

    logger.info('Dues cleared', { userId, count: clearedCount, total: totalCleared });
  }
}

export const financeService = new FinanceService();

