import { Router } from 'express';
import { financeController } from '../controllers/finance.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { paginationSchema } from '../validators/user.validator.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Summary
router.get('/summary', financeController.getSummary.bind(financeController));

// Transactions
router.get(
  '/transactions',
  validate(paginationSchema, 'query'),
  financeController.getTransactions.bind(financeController)
);

// Dues
router.get('/dues', financeController.getPendingDues.bind(financeController));
router.post('/dues/pay', financeController.createPaymentOrder.bind(financeController));
router.post('/dues/clear-with-commission', financeController.clearDuesWithCommission.bind(financeController));

// Commissions
router.get(
  '/commissions',
  validate(paginationSchema, 'query'),
  financeController.getCommissions.bind(financeController)
);

// Withdrawals
router.get(
  '/withdrawals',
  validate(paginationSchema, 'query'),
  financeController.getWithdrawals.bind(financeController)
);
router.post('/withdraw', financeController.requestWithdrawal.bind(financeController));

// Payment webhook (no auth - secured by signature verification)
router.post('/webhook/payment', financeController.handlePaymentCallback.bind(financeController));

export default router;

