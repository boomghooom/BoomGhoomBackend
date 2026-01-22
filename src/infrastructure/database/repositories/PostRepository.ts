import { Types } from 'mongoose';
import { BaseRepository } from './BaseRepository.js';
import { PostModel, IPostDocument } from '../models/Post.model.js';
import { PostLikeModel } from '../models/PostLike.model.js';
import { PostCommentModel } from '../models/PostComment.model.js';
import { IPost, ICreatePostDTO, IUpdatePostDTO } from '../../../domain/entities/Post.js';
import { IPaginationOptions, IPaginatedResult } from '../../../domain/repositories/IBaseRepository.js';

export class PostRepository extends BaseRepository<
  IPost,
  IPostDocument,
  ICreatePostDTO,
  IUpdatePostDTO
> {
  constructor() {
    super(PostModel);
  }

  async createPost(data: ICreatePostDTO): Promise<IPost> {
    const post = await this.create(data);
    return post;
  }

  async findByAuthor(
    authorId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IPost>> {
    return this.findPaginated(
      { authorId: new Types.ObjectId(authorId), deletedAt: null },
      { ...options, sort: { createdAt: -1 } }
    );
  }

  async findByHashtag(
    hashtag: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IPost>> {
    return this.findPaginated(
      { hashtags: hashtag.toLowerCase(), deletedAt: null },
      { ...options, sort: { createdAt: -1 } }
    );
  }

  async findByEvent(
    eventId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IPost>> {
    return this.findPaginated(
      { eventId: new Types.ObjectId(eventId), deletedAt: null },
      { ...options, sort: { createdAt: -1 } }
    );
  }

  async incrementEngagement(
    postId: string,
    field: 'likeCount' | 'commentCount' | 'shareCount'
  ): Promise<void> {
    await this.model.findByIdAndUpdate(postId, { $inc: { [field]: 1 } });
  }

  async decrementEngagement(
    postId: string,
    field: 'likeCount' | 'commentCount' | 'shareCount'
  ): Promise<void> {
    await this.model.findByIdAndUpdate(postId, { $inc: { [field]: -1 } });
  }

  async softDelete(postId: string): Promise<void> {
    await this.model.findByIdAndUpdate(postId, { deletedAt: new Date() });
  }

  async findForFeed(
    authorIds: string[],
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IPost>> {
    const objectIds = authorIds.map((id) => new Types.ObjectId(id));
    return this.findPaginated(
      {
        authorId: { $in: objectIds },
        deletedAt: null,
        privacy: { $in: ['public', 'friends_only'] },
      },
      { ...options, sort: { createdAt: -1 } }
    );
  }

  async findPublicPosts(options: IPaginationOptions): Promise<IPaginatedResult<IPost>> {
    return this.findPaginated(
      { privacy: 'public', deletedAt: null },
      { ...options, sort: { createdAt: -1 } }
    );
  }

  async likePost(userId: string, postId: string): Promise<void> {
    await PostLikeModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        targetId: new Types.ObjectId(postId),
        targetType: 'post',
      },
      {
        $setOnInsert: {
          userId: new Types.ObjectId(userId),
          targetId: new Types.ObjectId(postId),
          targetType: 'post',
        },
      },
      { upsert: true, new: true }
    );
    await this.incrementEngagement(postId, 'likeCount');
  }

  async unlikePost(userId: string, postId: string): Promise<boolean> {
    const result = await PostLikeModel.deleteOne({
      userId: new Types.ObjectId(userId),
      targetId: new Types.ObjectId(postId),
      targetType: 'post',
    });
    if (result.deletedCount > 0) {
      await this.decrementEngagement(postId, 'likeCount');
      return true;
    }
    return false;
  }

  async isLiked(userId: string, postId: string): Promise<boolean> {
    const count = await PostLikeModel.countDocuments({
      userId: new Types.ObjectId(userId),
      targetId: new Types.ObjectId(postId),
      targetType: 'post',
    });
    return count > 0;
  }

  async createComment(data: {
    postId: string;
    authorId: string;
    content: string;
    parentCommentId?: string;
    mentions?: string[];
  }): Promise<any> {
    const comment = await PostCommentModel.create({
      postId: new Types.ObjectId(data.postId),
      authorId: new Types.ObjectId(data.authorId),
      content: data.content,
      parentCommentId: data.parentCommentId
        ? new Types.ObjectId(data.parentCommentId)
        : undefined,
      mentions: data.mentions?.map((id) => new Types.ObjectId(id)) || [],
    });
    await this.incrementEngagement(data.postId, 'commentCount');
    return comment.toObject();
  }

  async deleteComment(commentId: string, postId: string): Promise<void> {
    await PostCommentModel.findByIdAndUpdate(commentId, { deletedAt: new Date() });
    await this.decrementEngagement(postId, 'commentCount');
  }

  async getComments(
    postId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<any>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      PostCommentModel.find({ postId: new Types.ObjectId(postId), deletedAt: null })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PostCommentModel.countDocuments({ postId: new Types.ObjectId(postId), deletedAt: null }),
    ]);

    return {
      data: comments as any[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    };
  }
}

export const postRepository = new PostRepository();
