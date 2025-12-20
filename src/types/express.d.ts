import { IUser } from '../domain/entities/User.js';
import { ITokenPayload } from '../application/services/AuthService.js';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
      tokenPayload?: ITokenPayload;
    }
  }
}

export {};

