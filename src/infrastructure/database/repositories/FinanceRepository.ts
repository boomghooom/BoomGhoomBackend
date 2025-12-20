import { ClientSession, FilterQuery, Types } from 'mongoose';
import { BaseRepository } from './BaseRepository.js';
import {
  TransactionModel,
  ITransactionDocument,
  WithdrawalModel,
  IWithdrawalDocument,
  CommissionModel,
  ICommissionDocument,
  DueModel,
  IDueDocument,
  PaymentOrderModel,
  IPaymentOrderDocument,
} from '../models/Transaction.model.js';
import {
  ITransaction,
  IWithdrawal,
  ICommission,
  IDue,
  IPaymentOrder,
  ICreateTransactionDTO,
  ICreateWithdrawalDTO,
  ITransactionQuery,
} from '../../../domain/entities/Finance.js';
import { IPaginationOptions, IPaginatedResult } from '../../../domain/repositories/IBaseRepository.js';
import { TransactionType, TransactionStatus } from '../../../shared/constants/index.js';

// Transaction Repository
export class TransactionRepository extends BaseRepository<
  ITransaction,
  ITransactionDocument,
  ICreateTransactionDTO,
  Partial<ITransaction>
> {
  constructor() {
    super(TransactionModel);
  }

  async findByUser(userId: string, options: IPaginationOptions): Promise<IPaginatedResult<ITransaction>> {
    return this.findPaginated({ userId: new Types.ObjectId(userId) }, options);
  }

  async findByUserAndType(
    userId: string,
    type: TransactionType,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<ITransaction>> {
    return this.findPaginated(
      { userId: new Types.ObjectId(userId), type },
      options
    );
  }

  async findByQuery(
    query: ITransactionQuery,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<ITransaction>> {
    const filterQuery: FilterQuery<ITransactionDocument> = {};
    
    if (query.userId) filterQuery.userId = new Types.ObjectId(query.userId);
    if (query.type) filterQuery.type = query.type;
    if (query.status) filterQuery.status = query.status;
    if (query.eventId) filterQuery.eventId = new Types.ObjectId(query.eventId);
    if (query.dateFrom || query.dateTo) {
      filterQuery.createdAt = {};
      if (query.dateFrom) filterQuery.createdAt.$gte = query.dateFrom;
      if (query.dateTo) filterQuery.createdAt.$lte = query.dateTo;
    }

    return this.findPaginated(filterQuery, options);
  }

  async findByGatewayOrderId(orderId: string): Promise<ITransaction | null> {
    return this.findOne({ gatewayOrderId: orderId });
  }

  async updateStatus(
    id: string,
    status: TransactionStatus,
    data?: Partial<ITransaction>,
    session?: ClientSession
  ): Promise<ITransaction | null> {
    const updateData: Record<string, unknown> = { status };
    
    if (status === 'completed') updateData.completedAt = new Date();
    if (data?.gatewayPaymentId) updateData.gatewayPaymentId = data.gatewayPaymentId;
    if (data?.gatewaySignature) updateData.gatewaySignature = data.gatewaySignature;
    if (data?.failureReason) updateData.failureReason = data.failureReason;
    if (data?.metadata) updateData.metadata = data.metadata;

    const transaction = await this.model.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true, session }
    );
    return transaction ? (transaction.toObject() as ITransaction) : null;
  }

  async getTotalByType(userId: string, type: TransactionType): Promise<number> {
    return TransactionModel.getTotalByType(userId, type);
  }

  async createWithSession(
    data: ICreateTransactionDTO,
    session: ClientSession
  ): Promise<ITransaction> {
    const [transaction] = await this.model.create([data], { session });
    return transaction.toObject() as ITransaction;
  }
}

// Withdrawal Repository
export class WithdrawalRepository extends BaseRepository<
  IWithdrawal,
  IWithdrawalDocument,
  ICreateWithdrawalDTO,
  Partial<IWithdrawal>
> {
  constructor() {
    super(WithdrawalModel);
  }

  async findByUser(userId: string, options: IPaginationOptions): Promise<IPaginatedResult<IWithdrawal>> {
    return this.findPaginated({ userId: new Types.ObjectId(userId) }, options);
  }

  async findPending(): Promise<IWithdrawal[]> {
    return this.findMany({ status: 'pending' });
  }

  async updateStatus(
    id: string,
    status: IWithdrawal['status'],
    data?: Partial<IWithdrawal>,
    session?: ClientSession
  ): Promise<IWithdrawal | null> {
    const updateData: Record<string, unknown> = { status };
    
    if (status === 'completed' || status === 'failed') updateData.processedAt = new Date();
    if (data?.utrNumber) updateData.utrNumber = data.utrNumber;
    if (data?.failureReason) updateData.failureReason = data.failureReason;
    if (data?.transactionId) updateData.transactionId = data.transactionId;

    const withdrawal = await this.model.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true, session }
    );
    return withdrawal ? (withdrawal.toObject() as IWithdrawal) : null;
  }
}

// Commission Repository
export class CommissionRepository extends BaseRepository<
  ICommission,
  ICommissionDocument,
  Partial<ICommission>,
  Partial<ICommission>
> {
  constructor() {
    super(CommissionModel);
  }

  async findByAdmin(adminId: string, options: IPaginationOptions): Promise<IPaginatedResult<ICommission>> {
    return this.findPaginated({ adminId: new Types.ObjectId(adminId) }, options);
  }

  async findByEvent(eventId: string): Promise<ICommission | null> {
    return this.findOne({ eventId: new Types.ObjectId(eventId) });
  }

  async findPendingByAdmin(adminId: string): Promise<ICommission[]> {
    return this.findMany({
      adminId: new Types.ObjectId(adminId),
      status: 'pending',
    });
  }

  async findAvailableByAdmin(adminId: string): Promise<ICommission[]> {
    return this.findMany({
      adminId: new Types.ObjectId(adminId),
      status: 'available',
    });
  }

  async getTotalAvailable(adminId: string): Promise<number> {
    const result = await this.model.aggregate([
      { $match: { adminId: new Types.ObjectId(adminId), status: 'available' } },
      { $group: { _id: null, total: { $sum: '$adminShare' } } },
    ]);
    return result.length > 0 ? result[0].total : 0;
  }

  async getTotalPending(adminId: string): Promise<number> {
    const result = await this.model.aggregate([
      { $match: { adminId: new Types.ObjectId(adminId), status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$adminShare' } } },
    ]);
    return result.length > 0 ? result[0].total : 0;
  }

  async updateStatus(
    id: string,
    status: ICommission['status'],
    data?: Partial<ICommission>,
    session?: ClientSession
  ): Promise<ICommission | null> {
    const updateData: Record<string, unknown> = { status };
    
    if (status === 'available') updateData.availableAt = new Date();
    if (status === 'withdrawn') {
      updateData.withdrawnAt = new Date();
      if (data?.withdrawalId) updateData.withdrawalId = data.withdrawalId;
    }

    const commission = await this.model.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true, session }
    );
    return commission ? (commission.toObject() as ICommission) : null;
  }

  async incrementDueCleared(
    eventId: string,
    session?: ClientSession
  ): Promise<ICommission | null> {
    const commission = await this.model.findOneAndUpdate(
      { eventId: new Types.ObjectId(eventId) },
      { $inc: { participantsDueCleared: 1 } },
      { new: true, session }
    );
    return commission ? (commission.toObject() as ICommission) : null;
  }
}

// Due Repository
export class DueRepository extends BaseRepository<
  IDue,
  IDueDocument,
  Partial<IDue>,
  Partial<IDue>
> {
  constructor() {
    super(DueModel);
  }

  async findByUser(userId: string): Promise<IDue[]> {
    return this.findMany({ userId: new Types.ObjectId(userId) });
  }

  async findPendingByUser(userId: string): Promise<IDue[]> {
    return this.findMany({
      userId: new Types.ObjectId(userId),
      status: 'pending',
    });
  }

  async findByEvent(eventId: string): Promise<IDue[]> {
    return this.findMany({ eventId: new Types.ObjectId(eventId) });
  }

  async findByUserAndEvent(userId: string, eventId: string): Promise<IDue | null> {
    return this.findOne({
      userId: new Types.ObjectId(userId),
      eventId: new Types.ObjectId(eventId),
    });
  }

  async getTotalPending(userId: string): Promise<number> {
    const result = await this.model.aggregate([
      { $match: { userId: new Types.ObjectId(userId), status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result.length > 0 ? result[0].total : 0;
  }

  async clearDue(
    id: string,
    clearedVia: IDue['clearedVia'],
    transactionId?: string,
    session?: ClientSession
  ): Promise<IDue | null> {
    const due = await this.model.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'cleared',
          clearedVia,
          transactionId: transactionId ? new Types.ObjectId(transactionId) : undefined,
          clearedAt: new Date(),
        },
      },
      { new: true, session }
    );
    return due ? (due.toObject() as IDue) : null;
  }

  async clearMultipleDues(
    dueIds: string[],
    clearedVia: IDue['clearedVia'],
    transactionId?: string,
    session?: ClientSession
  ): Promise<number> {
    const result = await this.model.updateMany(
      { _id: { $in: dueIds.map((id) => new Types.ObjectId(id)) } },
      {
        $set: {
          status: 'cleared',
          clearedVia,
          transactionId: transactionId ? new Types.ObjectId(transactionId) : undefined,
          clearedAt: new Date(),
        },
      },
      { session }
    );
    return result.modifiedCount;
  }
}

// Payment Order Repository
export class PaymentOrderRepository extends BaseRepository<
  IPaymentOrder,
  IPaymentOrderDocument,
  Partial<IPaymentOrder>,
  Partial<IPaymentOrder>
> {
  constructor() {
    super(PaymentOrderModel);
  }

  async findByGatewayOrderId(orderId: string): Promise<IPaymentOrder | null> {
    return this.findOne({ gatewayOrderId: orderId });
  }

  async findActiveByUser(userId: string): Promise<IPaymentOrder[]> {
    return this.findMany({
      userId: new Types.ObjectId(userId),
      status: { $in: ['created', 'attempted'] },
      expiresAt: { $gt: new Date() },
    });
  }

  async updateStatus(
    id: string,
    status: IPaymentOrder['status'],
    session?: ClientSession
  ): Promise<IPaymentOrder | null> {
    const updateData: Record<string, unknown> = { status };
    
    if (status === 'paid') updateData.paidAt = new Date();
    if (status === 'attempted') updateData['$inc'] = { attempts: 1 };

    const order = await this.model.findByIdAndUpdate(
      id,
      status === 'attempted' ? { $set: { status }, $inc: { attempts: 1 } } : { $set: updateData },
      { new: true, session }
    );
    return order ? (order.toObject() as IPaymentOrder) : null;
  }
}

// Export singleton instances
export const transactionRepository = new TransactionRepository();
export const withdrawalRepository = new WithdrawalRepository();
export const commissionRepository = new CommissionRepository();
export const dueRepository = new DueRepository();
export const paymentOrderRepository = new PaymentOrderRepository();

