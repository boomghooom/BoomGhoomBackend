import {
  TransactionType,
  TransactionStatus,
  PaymentMethod,
  CommissionStatus,
} from '../../shared/constants/index.js';

export interface ITransaction {
  _id: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number; // Amount in paise
  currency: string;
  description: string;
  eventId?: string;
  eventTitle?: string;
  paymentMethod?: PaymentMethod;
  gatewayFee?: number; // Amount in paise
  gst?: number; // Amount in paise
  netAmount?: number; // Amount in paise (after deductions)
  referenceId?: string; // Payment gateway reference
  gatewayOrderId?: string; // Razorpay/Cashfree order ID
  gatewayPaymentId?: string; // Razorpay/Cashfree payment ID
  gatewaySignature?: string;
  bankTransactionId?: string;
  metadata?: Record<string, unknown>;
  failureReason?: string;
  createdAt: Date;
  completedAt?: Date;
  updatedAt: Date;
}

export interface IWithdrawal {
  _id: string;
  userId: string;
  amount: number; // Amount in paise
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  bankDetails: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  };
  gatewayFee: number; // Amount in paise
  gst: number; // Amount in paise
  netAmount: number; // Amount in paise
  transactionId?: string;
  utrNumber?: string; // Unique Transaction Reference from bank
  failureReason?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICommission {
  _id: string;
  adminId: string;
  eventId: string;
  eventTitle: string;
  status: CommissionStatus;
  totalDuesGenerated: number; // Amount in paise
  adminShare: number; // Amount in paise (80%)
  platformShare: number; // Amount in paise (20%)
  participantsCount: number;
  participantsDueCleared: number;
  duePerParticipant: number; // Amount in paise
  availableAt?: Date; // When commission became available
  withdrawnAt?: Date;
  withdrawalId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDue {
  _id: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  amount: number; // Amount in paise
  status: 'pending' | 'cleared';
  clearedVia?: 'payment' | 'commission' | 'referral_reward';
  transactionId?: string;
  createdAt: Date;
  clearedAt?: Date;
}

export interface IPaymentOrder {
  _id: string;
  userId: string;
  purpose: 'clear_dues' | 'event_ticket' | 'withdrawal_fee';
  amount: number; // Amount in paise
  currency: string;
  status: 'created' | 'attempted' | 'paid' | 'failed' | 'expired';
  gatewayOrderId: string;
  gatewayProvider: 'razorpay' | 'cashfree';
  metadata: {
    dueIds?: string[];
    eventId?: string;
    withdrawalId?: string;
  };
  attempts: number;
  expiresAt: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// DTOs
export interface ICreateTransactionDTO {
  userId: string;
  type: TransactionType;
  amount: number;
  currency?: string;
  description: string;
  eventId?: string;
  eventTitle?: string;
  paymentMethod?: PaymentMethod;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export interface ICreateWithdrawalDTO {
  userId: string;
  amount: number;
}

export interface IPaymentCallbackDTO {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature: string;
  status: 'success' | 'failed';
  metadata?: Record<string, unknown>;
}

export interface IFinanceSummary {
  dues: number;
  pendingCommission: number;
  availableCommission: number;
  totalEarned: number;
  totalWithdrawn: number;
  canWithdraw: boolean;
  minWithdrawalAmount: number;
}

export interface ITransactionQuery {
  userId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  eventId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

