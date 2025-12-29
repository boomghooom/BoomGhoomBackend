import { Request, Response, NextFunction } from 'express';
import { passService } from '../../application/services/PassService.js';
import { sendSuccess } from '../../shared/utils/response.js';
import { z } from 'zod';
import { NotFoundError } from '../../shared/errors/AppError.js';

export const verifyPassSchema = z.object({
  passCode: z.string().min(1, 'Pass code is required'),
});

export type VerifyPassInput = z.infer<typeof verifyPassSchema>;

export class PassController {
  /**
   * Verify pass by scanning QR code (for admin/staff/sponsor)
   */
  async verify(
    req: Request<unknown, unknown, VerifyPassInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { passCode } = req.body;
      
      // Determine verifier type from request
      // If req.staffId exists, it's staff verification
      // If req.sponsorId exists, it's sponsor verification
      const verifiedBy = (req as any).staffId || (req as any).sponsorId || req.userId!;
      const verifiedByType = (req as any).staffId ? 'staff' : (req as any).sponsorId ? 'sponsor' : 'staff';

      const pass = await passService.verifyPass(passCode, verifiedBy, verifiedByType);

      sendSuccess(res, {
        pass,
        verified: true,
      }, { message: 'Pass verified successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pass details by pass code (for verification check)
   */
  async getByCode(
    req: Request<{ passCode: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { passCode } = req.params;
      const pass = await passService.getPassByCode(passCode);

      if (!pass) {
        throw new NotFoundError('Pass not found', 'PASS_NOT_FOUND');
      }

      sendSuccess(res, pass, { message: 'Pass details retrieved' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's passes
   */
  async getMyPasses(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const passes = await passService.getUserPasses(req.userId!);
      sendSuccess(res, passes, { message: 'Passes retrieved' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get event passes (for admin/sponsor)
   */
  async getEventPasses(
    req: Request<{ eventId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      const passes = await passService.getEventPasses(eventId);
      sendSuccess(res, passes, { message: 'Event passes retrieved' });
    } catch (error) {
      next(error);
    }
  }
}

export const passController = new PassController();

