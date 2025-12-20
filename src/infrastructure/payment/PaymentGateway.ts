import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';

export interface ICreateOrderParams {
  amount: number; // Amount in paise
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface IPaymentOrder {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  createdAt: number;
}

export interface IPaymentVerification {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface IPayoutParams {
  accountNumber: string;
  ifscCode: string;
  amount: number;
  currency: string;
  mode: 'IMPS' | 'NEFT' | 'RTGS';
  purpose: string;
  narration: string;
}

export interface IPayout {
  id: string;
  status: string;
  utr?: string;
  failureReason?: string;
}

export interface IPaymentGateway {
  createOrder(params: ICreateOrderParams): Promise<IPaymentOrder>;
  verifyPayment(verification: IPaymentVerification): boolean;
  createPayout(params: IPayoutParams): Promise<IPayout>;
  getPayoutStatus(payoutId: string): Promise<IPayout>;
  handleWebhook(payload: unknown, signature: string): { event: string; data: unknown };
}

// Razorpay Implementation (mock - replace with actual SDK)
export class RazorpayGateway implements IPaymentGateway {
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor() {
    this.keyId = config.razorpay.keyId;
    this.keySecret = config.razorpay.keySecret;
    this.webhookSecret = config.razorpay.webhookSecret;
  }

  async createOrder(params: ICreateOrderParams): Promise<IPaymentOrder> {
    // In production, use actual Razorpay SDK:
    // const Razorpay = require('razorpay');
    // const instance = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
    // return instance.orders.create(params);

    logger.info('Creating Razorpay order', { amount: params.amount, receipt: params.receipt });

    // Mock implementation
    return {
      id: `order_${Date.now()}`,
      entity: 'order',
      amount: params.amount,
      currency: params.currency,
      receipt: params.receipt,
      status: 'created',
      attempts: 0,
      notes: params.notes || {},
      createdAt: Date.now(),
    };
  }

  verifyPayment(verification: IPaymentVerification): boolean {
    // In production, verify signature using:
    // const crypto = require('crypto');
    // const generatedSignature = crypto
    //   .createHmac('sha256', this.keySecret)
    //   .update(verification.orderId + '|' + verification.paymentId)
    //   .digest('hex');
    // return generatedSignature === verification.signature;

    logger.info('Verifying Razorpay payment', { orderId: verification.orderId });
    
    // Mock: always return true in development
    return config.isDevelopment || verification.signature.length > 0;
  }

  async createPayout(params: IPayoutParams): Promise<IPayout> {
    // In production, use Razorpay Payouts API or RazorpayX
    logger.info('Creating Razorpay payout', { amount: params.amount });

    return {
      id: `pout_${Date.now()}`,
      status: 'processing',
    };
  }

  async getPayoutStatus(payoutId: string): Promise<IPayout> {
    logger.info('Getting payout status', { payoutId });

    return {
      id: payoutId,
      status: 'processed',
      utr: `UTR${Date.now()}`,
    };
  }

  handleWebhook(payload: unknown, signature: string): { event: string; data: unknown } {
    // In production, verify webhook signature
    // const crypto = require('crypto');
    // const expectedSignature = crypto
    //   .createHmac('sha256', this.webhookSecret)
    //   .update(JSON.stringify(payload))
    //   .digest('hex');
    // if (expectedSignature !== signature) throw new Error('Invalid signature');

    const body = payload as { event: string; payload: unknown };
    return {
      event: body.event,
      data: body.payload,
    };
  }
}

// Cashfree Implementation (mock - replace with actual SDK)
export class CashfreeGateway implements IPaymentGateway {
  private appId: string;
  private secretKey: string;
  private env: 'TEST' | 'PROD';

  constructor() {
    this.appId = config.cashfree.appId;
    this.secretKey = config.cashfree.secretKey;
    this.env = config.cashfree.env;
  }

  async createOrder(params: ICreateOrderParams): Promise<IPaymentOrder> {
    logger.info('Creating Cashfree order', { amount: params.amount, receipt: params.receipt });

    return {
      id: `cf_${Date.now()}`,
      entity: 'order',
      amount: params.amount,
      currency: params.currency,
      receipt: params.receipt,
      status: 'created',
      attempts: 0,
      notes: params.notes || {},
      createdAt: Date.now(),
    };
  }

  verifyPayment(verification: IPaymentVerification): boolean {
    logger.info('Verifying Cashfree payment', { orderId: verification.orderId });
    return config.isDevelopment || verification.signature.length > 0;
  }

  async createPayout(params: IPayoutParams): Promise<IPayout> {
    logger.info('Creating Cashfree payout', { amount: params.amount });

    return {
      id: `cfp_${Date.now()}`,
      status: 'PENDING',
    };
  }

  async getPayoutStatus(payoutId: string): Promise<IPayout> {
    logger.info('Getting Cashfree payout status', { payoutId });

    return {
      id: payoutId,
      status: 'SUCCESS',
      utr: `CFT${Date.now()}`,
    };
  }

  handleWebhook(payload: unknown, signature: string): { event: string; data: unknown } {
    const body = payload as { type: string; data: unknown };
    return {
      event: body.type,
      data: body.data,
    };
  }
}

// Factory function to get payment gateway
export const getPaymentGateway = (provider: 'razorpay' | 'cashfree' = 'razorpay'): IPaymentGateway => {
  if (provider === 'cashfree') {
    return new CashfreeGateway();
  }
  return new RazorpayGateway();
};

// Singleton instance
let paymentGateway: IPaymentGateway | null = null;

export const getPaymentGatewayInstance = (): IPaymentGateway => {
  if (!paymentGateway) {
    paymentGateway = getPaymentGateway('razorpay');
  }
  return paymentGateway;
};

