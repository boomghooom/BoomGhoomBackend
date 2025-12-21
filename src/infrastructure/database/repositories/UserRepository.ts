import { ClientSession, FilterQuery } from 'mongoose';
import { BaseRepository } from './BaseRepository.js';
import { UserModel, IUserDocument } from '../models/User.model.js';
import { IUser, ICreateUserDTO, IUpdateUserDTO, IUserSummary } from '../../../domain/entities/User.js';
import { IPaginationOptions, IPaginatedResult } from '../../../domain/repositories/IBaseRepository.js';

export interface IUserRepository {
  create(data: ICreateUserDTO): Promise<IUser>;
  findById(id: string): Promise<IUser | null>;
  findByIdWithPassword(id: string): Promise<IUser | null>;
  findByPhone(phoneNumber: string): Promise<IUser | null>;
  findByPhoneWithPassword(phoneNumber: string): Promise<IUser | null>;
  findByEmail(email: string): Promise<IUser | null>;
  findByGoogleId(googleId: string): Promise<IUser | null>;
  findByAppleId(appleId: string): Promise<IUser | null>;
  findByReferralCode(code: string): Promise<IUser | null>;
  updateById(id: string, data: IUpdateUserDTO): Promise<IUser | null>;
  updateFinance(
    id: string,
    data: Partial<IUser['finance']>,
    session?: ClientSession
  ): Promise<IUser | null>;
  updateStats(id: string, data: Partial<IUser['stats']>): Promise<IUser | null>;
  updateKYCStatus(
    id: string,
    status: IUser['kyc']['status'],
    data?: Partial<IUser['kyc']>
  ): Promise<IUser | null>;
  addFcmToken(id: string, token: string): Promise<IUser | null>;
  removeFcmToken(id: string, token: string): Promise<IUser | null>;
  setOnlineStatus(id: string, isOnline: boolean): Promise<void>;
  softDelete(id: string): Promise<boolean>;
  findNearby(
    coordinates: [number, number],
    maxDistance: number,
    excludeIds?: string[]
  ): Promise<IUserSummary[]>;
  findByCity(city: string, options: IPaginationOptions): Promise<IPaginatedResult<IUserSummary>>;
  searchUsers(searchTerm: string, excludeUserId: string): Promise<IUserSummary[]>;
  comparePassword(id: string, password: string): Promise<boolean>;
}

export class UserRepository
  extends BaseRepository<IUser, IUserDocument, ICreateUserDTO, IUpdateUserDTO>
  implements IUserRepository
{
  constructor() {
    super(UserModel);
  }

  async findById(id: string): Promise<IUser | null> {
    const user = await this.model.findOne({ _id: id, isDeleted: false });
    return user ? (user.toObject() as IUser) : null;
  }

  async findByIdWithPassword(id: string): Promise<IUser | null> {
    const user = await this.model.findOne({ _id: id, isDeleted: false }).select('+password');
    return user ? (user.toObject() as IUser) : null;
  }

  async findByPhone(phoneNumber: string): Promise<IUser | null> {
    const user = await UserModel.findByPhone(phoneNumber);
    return user ? (user.toObject() as IUser) : null;
  }

  async findByPhoneWithPassword(phoneNumber: string): Promise<IUser | null> {
    console.log('Finding user with phone number:', phoneNumber);
    const user = await this.model
      .findOne({ phoneNumber: phoneNumber.toString(), isDeleted: false })
      .select('+password');
    console.log('User foundee:', user);
    return user ? (user.toObject() as unknown as IUser) : null;
  }

  async findByEmail(email: string): Promise<IUser | null> {
    const user = await UserModel.findByEmail(email);
    return user ? (user.toObject() as IUser) : null;
  }

  async findByGoogleId(googleId: string): Promise<IUser | null> {
    const user = await UserModel.findByGoogleId(googleId);
    return user ? (user.toObject() as IUser) : null;
  }

  async findByAppleId(appleId: string): Promise<IUser | null> {
    const user = await UserModel.findByAppleId(appleId);
    return user ? (user.toObject() as IUser) : null;
  }

  async findByReferralCode(code: string): Promise<IUser | null> {
    const user = await this.model.findOne({
      referralCode: code.toUpperCase(),
      isDeleted: false,
    });
    return user ? (user.toObject() as IUser) : null;
  }

  async updateFinance(
    id: string,
    data: Partial<IUser['finance']>,
    session?: ClientSession
  ): Promise<IUser | null> {
    const updateData: Record<string, unknown> = {};
    
    if (data.dues !== undefined) updateData['finance.dues'] = data.dues;
    if (data.pendingCommission !== undefined) updateData['finance.pendingCommission'] = data.pendingCommission;
    if (data.availableCommission !== undefined) updateData['finance.availableCommission'] = data.availableCommission;
    if (data.totalEarned !== undefined) updateData['finance.totalEarned'] = data.totalEarned;
    if (data.totalWithdrawn !== undefined) updateData['finance.totalWithdrawn'] = data.totalWithdrawn;

    const user = await this.model.findByIdAndUpdate(id, { $set: updateData }, {
      new: true,
      runValidators: true,
      session,
    });
    return user ? (user.toObject() as IUser) : null;
  }

  async updateStats(id: string, data: Partial<IUser['stats']>): Promise<IUser | null> {
    const updateData: Record<string, unknown> = {};
    
    if (data.eventsJoined !== undefined) updateData['stats.eventsJoined'] = data.eventsJoined;
    if (data.eventsCreated !== undefined) updateData['stats.eventsCreated'] = data.eventsCreated;
    if (data.eventsCompleted !== undefined) updateData['stats.eventsCompleted'] = data.eventsCompleted;
    if (data.friendsCount !== undefined) updateData['stats.friendsCount'] = data.friendsCount;
    if (data.averageRating !== undefined) updateData['stats.averageRating'] = data.averageRating;
    if (data.totalRatings !== undefined) updateData['stats.totalRatings'] = data.totalRatings;

    const user = await this.model.findByIdAndUpdate(id, { $set: updateData }, {
      new: true,
      runValidators: true,
    });
    return user ? (user.toObject() as IUser) : null;
  }

  async updateKYCStatus(
    id: string,
    status: IUser['kyc']['status'],
    data?: Partial<IUser['kyc']>
  ): Promise<IUser | null> {
    const updateData: Record<string, unknown> = { 'kyc.status': status };
    
    if (data) {
      if (data.selfieUrl) updateData['kyc.selfieUrl'] = data.selfieUrl;
      if (data.documentUrl) updateData['kyc.documentUrl'] = data.documentUrl;
      if (data.documentType) updateData['kyc.documentType'] = data.documentType;
      if (data.verifiedAt) updateData['kyc.verifiedAt'] = data.verifiedAt;
      if (data.rejectionReason) updateData['kyc.rejectionReason'] = data.rejectionReason;
      if (data.submittedAt) updateData['kyc.submittedAt'] = data.submittedAt;
    }

    const user = await this.model.findByIdAndUpdate(id, { $set: updateData }, {
      new: true,
      runValidators: true,
    });
    return user ? (user.toObject() as IUser) : null;
  }

  async addFcmToken(id: string, token: string): Promise<IUser | null> {
    const user = await this.model.findByIdAndUpdate(
      id,
      { $addToSet: { fcmTokens: token } },
      { new: true }
    );
    return user ? (user.toObject() as IUser) : null;
  }

  async removeFcmToken(id: string, token: string): Promise<IUser | null> {
    const user = await this.model.findByIdAndUpdate(
      id,
      { $pull: { fcmTokens: token } },
      { new: true }
    );
    return user ? (user.toObject() as IUser) : null;
  }

  async setOnlineStatus(id: string, isOnline: boolean): Promise<void> {
    await this.model.findByIdAndUpdate(id, {
      isOnline,
      lastActiveAt: new Date(),
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });
    return result !== null;
  }

  async findNearby(
    coordinates: [number, number],
    maxDistance: number,
    excludeIds: string[] = []
  ): Promise<IUserSummary[]> {
    const users = await this.model
      .find({
        isDeleted: false,
        isBlocked: false,
        _id: { $nin: excludeIds },
        'location.coordinates': {
          $near: {
            $geometry: { type: 'Point', coordinates },
            $maxDistance: maxDistance,
          },
        },
      })
      .limit(50);

    return users.map((user) => user.toSummary());
  }

  async findByCity(
    city: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IUserSummary>> {
    const query: FilterQuery<IUserDocument> = {
      isDeleted: false,
      isBlocked: false,
      'location.city': { $regex: new RegExp(city, 'i') },
    };

    const result = await this.findPaginated(query, options);
    
    return {
      ...result,
      data: result.data.map((user) => ({
        _id: user._id,
        fullName: user.fullName,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        gender: user.gender,
        isOnline: user.isOnline,
        kycVerified: user.kyc?.status === 'approved',
        averageRating: user.stats?.averageRating || 0,
      })),
    };
  }

  async searchUsers(searchTerm: string, excludeUserId: string): Promise<IUserSummary[]> {
    const users = await this.model
      .find({
        isDeleted: false,
        isBlocked: false,
        _id: { $ne: excludeUserId },
        $or: [
          { fullName: { $regex: searchTerm, $options: 'i' } },
          { displayName: { $regex: searchTerm, $options: 'i' } },
          { phoneNumber: { $regex: searchTerm, $options: 'i' } },
        ],
      })
      .limit(20);

    return users.map((user) => user.toSummary());
  }

  async comparePassword(id: string, password: string): Promise<boolean> {
    const user = await this.model.findById(id).select('+password');
    if (!user) return false;
    return user.comparePassword(password);
  }
}

export const userRepository = new UserRepository();

