import { Request, Response, NextFunction } from 'express';
import { financeService } from '../../application/services/FinanceService.js';
import { sendSuccess, sendPaginated, sendCreated } from '../../shared/utils/response.js';
import { PaginationInput } from '../validators/user.validator.js';

export class FinanceController {
  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await financeService.getFinanceSummary(req.userId!);
      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(
    req: Request<unknown, unknown, unknown, PaginationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit } = req.query;
      const type = req.query.type as string | undefined;
      const result = await financeService.getTransactionHistory(
        req.userId!,
        type ? { type: type as never } : {},
        { page, limit }
      );
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPendingDues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dues = await financeService.getPendingDues(req.userId!);
      const total = await financeService.getTotalPendingDues(req.userId!);
      sendSuccess(res, { dues, total });
    } catch (error) {
      next(error);
    }
  }

  async getCommissions(
    req: Request<unknown, unknown, unknown, PaginationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit } = req.query;
      const result = await financeService.getCommissionHistory(req.userId!, { page, limit });
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      });
    } catch (error) {
      next(error);
    }
  }

  async getWithdrawals(
    req: Request<unknown, unknown, unknown, PaginationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit } = req.query;
      const result = await financeService.getWithdrawalHistory(req.userId!, { page, limit });
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      });
    } catch (error) {
      next(error);
    }
  }

  async createPaymentOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { purpose, amount, dueIds, eventId } = req.body as {
        purpose: 'clear_dues' | 'event_ticket';
        amount: number;
        dueIds?: string[];
        eventId?: string;
      };
      
      const order = await financeService.createPaymentOrder({
        userId: req.userId!,
        purpose,
        amount,
        dueIds,
        eventId,
      });
      sendCreated(res, order);
    } catch (error) {
      next(error);
    }
  }

  async handlePaymentCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gatewayOrderId, gatewayPaymentId, gatewaySignature, status } = req.body as {
        gatewayOrderId: string;
        gatewayPaymentId: string;
        gatewaySignature: string;
        status: 'success' | 'failed';
      };

      const transaction = await financeService.handlePaymentCallback({
        gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature,
        status,
      });
      sendSuccess(res, transaction);
    } catch (error) {
      next(error);
    }
  }

  async clearDuesWithCommission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { dueIds } = req.body as { dueIds: string[] };
      const transaction = await financeService.clearDuesWithCommission(req.userId!, dueIds);
      sendSuccess(res, transaction, { message: 'Dues cleared' });
    } catch (error) {
      next(error);
    }
  }

  async requestWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const withdrawal = await financeService.requestWithdrawal(req.userId!);
      sendCreated(res, withdrawal, 'Withdrawal requested');
    } catch (error) {
      next(error);
    }
  }
}

export const financeController = new FinanceController();

