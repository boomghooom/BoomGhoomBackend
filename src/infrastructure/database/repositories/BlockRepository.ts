import { Types } from 'mongoose';
import { BaseRepository } from './BaseRepository.js';
import { BlockModel, IBlockDocument } from '../models/Block.model.js';
import { IPaginationOptions, IPaginatedResult } from '../../../domain/repositories/IBaseRepository.js';

export interface IBlock {
  _id: string;
  blockerId: string;
  blockedUserId: string;
  createdAt: Date;
}

export class BlockRepository extends BaseRepository<
  IBlock,
  IBlockDocument,
  Partial<IBlock>,
  Partial<IBlock>
> {
  constructor() {
    super(BlockModel);
  }

  async blockUser(blockerId: string, blockedUserId: string): Promise<IBlock> {
    const block = await this.model.findOneAndUpdate(
      {
        blockerId: new Types.ObjectId(blockerId),
        blockedUserId: new Types.ObjectId(blockedUserId),
      },
      {
        $setOnInsert: {
          blockerId: new Types.ObjectId(blockerId),
          blockedUserId: new Types.ObjectId(blockedUserId),
        },
      },
      { upsert: true, new: true }
    );
    return block.toObject() as unknown as IBlock;
  }

  async unblockUser(blockerId: string, blockedUserId: string): Promise<boolean> {
    const result = await this.model.deleteOne({
      blockerId: new Types.ObjectId(blockerId),
      blockedUserId: new Types.ObjectId(blockedUserId),
    });
    return result.deletedCount > 0;
  }

  async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    const count = await this.model.countDocuments({
      $or: [
        {
          blockerId: new Types.ObjectId(userId1),
          blockedUserId: new Types.ObjectId(userId2),
        },
        {
          blockerId: new Types.ObjectId(userId2),
          blockedUserId: new Types.ObjectId(userId1),
        },
      ],
    });
    return count > 0;
  }

  async getBlockedUsers(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IBlock>> {
    return this.findPaginated(
      { blockerId: new Types.ObjectId(userId) },
      { ...options, sort: { createdAt: -1 } }
    );
  }

  async getBlockerUsers(userId: string): Promise<string[]> {
    const blocks = await this.model.find({
      blockedUserId: new Types.ObjectId(userId),
    });
    return blocks.map((b) => b.blockerId.toString());
  }
}

export const blockRepository = new BlockRepository();
