import { postRepository } from '../../infrastructure/database/repositories/PostRepository.js';
import { userRepository } from '../../infrastructure/database/repositories/UserRepository.js';
import { eventRepository } from '../../infrastructure/database/repositories/EventRepository.js';
import { notificationRepository, blockRepository } from '../../infrastructure/database/repositories/index.js';
import { IPost, ICreatePostDTO, IUpdatePostDTO, IComment, ICreateCommentDTO } from '../../domain/entities/Post.js';
import { IPaginationOptions, IPaginatedResult } from '../../domain/repositories/IBaseRepository.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors/AppError.js';
import { MentionParser } from '../../shared/utils/mentionParser.js';
import { HashtagParser } from '../../shared/utils/hashtagParser.js';
import { redisClient } from '../../config/redis.js';
import { CacheKeys } from '../../shared/constants/index.js';
import { logger } from '../../shared/utils/logger.js';

export class PostService {
  async createPost(data: ICreatePostDTO): Promise<IPost> {
    // Validate author exists
    const author = await userRepository.findById(data.authorId);
    if (!author) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Validate content
    if (!data.content || data.content.trim().length === 0) {
      throw new BadRequestError('Post content cannot be empty', 'EMPTY_CONTENT');
    }

    if (data.content.length > 5000) {
      throw new BadRequestError('Post content exceeds maximum length', 'CONTENT_TOO_LONG');
    }

    // Parse mentions and hashtags
    const mentions = MentionParser.parse(data.content);
    const hashtags = HashtagParser.parse(data.content);

    // Validate event if provided
    if (data.eventId) {
      const event = await eventRepository.findById(data.eventId);
      if (!event) {
        throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
      }
    }

    // Validate mentioned users exist
    const mentionedUserIds: string[] = [];
    for (const username of mentions) {
      // In real implementation, you'd look up users by username
      // For now, we'll skip this validation
    }

    // Create post
    const post = await postRepository.createPost({
      ...data,
      mentions: mentionedUserIds,
      hashtags,
      privacy: data.privacy || 'public',
    });

    // Send notifications to mentioned users
    for (const userId of mentionedUserIds) {
      // Check if user has blocked the author
      const isBlocked = await blockRepository.isBlocked(userId, data.authorId);
      if (!isBlocked) {
        await notificationRepository.create({
          userId,
          type: 'mention',
          title: 'You were mentioned',
          body: `${author.fullName} mentioned you in a post`,
          data: { postId: post._id, userId: data.authorId },
        });
      }
    }

    logger.info('Post created', { postId: post._id, authorId: data.authorId });
    return post;
  }

  async updatePost(postId: string, userId: string, data: IUpdatePostDTO): Promise<IPost> {
    const post = await postRepository.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found', 'POST_NOT_FOUND');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenError('Not authorized to update this post', 'NOT_AUTHORIZED');
    }

    if (data.content) {
      if (data.content.length > 5000) {
        throw new BadRequestError('Post content exceeds maximum length', 'CONTENT_TOO_LONG');
      }
      // Re-parse mentions and hashtags if content changed
      const mentions = MentionParser.parse(data.content);
      const hashtags = HashtagParser.parse(data.content);
      (data as any).mentions = [];
      (data as any).hashtags = hashtags;
    }

    const updated = await postRepository.updateById(postId, data);
    if (!updated) {
      throw new NotFoundError('Post not found', 'POST_NOT_FOUND');
    }

    logger.info('Post updated', { postId, userId });
    return updated;
  }

  async deletePost(postId: string, userId: string): Promise<void> {
    const post = await postRepository.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found', 'POST_NOT_FOUND');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenError('Not authorized to delete this post', 'NOT_AUTHORIZED');
    }

    await postRepository.softDelete(postId);
    logger.info('Post deleted', { postId, userId });
  }

  async getPost(postId: string, viewerId: string): Promise<IPost> {
    const post = await postRepository.findById(postId);
    if (!post || post.deletedAt) {
      throw new NotFoundError('Post not found', 'POST_NOT_FOUND');
    }

    // Check privacy
    if (post.privacy === 'private' && post.authorId !== viewerId) {
      throw new ForbiddenError('Not authorized to view this post', 'NOT_AUTHORIZED');
    }

    // Check if blocked
    const isBlocked = await blockRepository.isBlocked(viewerId, post.authorId);
    if (isBlocked) {
      throw new ForbiddenError('Not authorized to view this post', 'BLOCKED');
    }

    return post;
  }

  async getUserPosts(
    userId: string,
    viewerId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IPost>> {
    // Check if blocked
    const isBlocked = await blockRepository.isBlocked(viewerId, userId);
    if (isBlocked) {
      throw new ForbiddenError('Not authorized to view posts', 'BLOCKED');
    }

    const posts = await postRepository.findByAuthor(userId, options);

    // Filter by privacy
    if (userId !== viewerId) {
      posts.data = posts.data.filter((post) => {
        if (post.privacy === 'private') return false;
        // TODO: Check if friends for friends_only posts
        return true;
      });
    }

    return posts;
  }

  async likePost(postId: string, userId: string): Promise<void> {
    const post = await postRepository.findById(postId);
    if (!post || post.deletedAt) {
      throw new NotFoundError('Post not found', 'POST_NOT_FOUND');
    }

    // Check if blocked
    const isBlocked = await blockRepository.isBlocked(userId, post.authorId);
    if (isBlocked) {
      throw new ForbiddenError('Cannot like this post', 'BLOCKED');
    }

    await postRepository.likePost(userId, postId);

    // Send notification to post author
    if (post.authorId !== userId) {
      await notificationRepository.create({
        userId: post.authorId,
        type: 'like',
        title: 'New like',
        body: 'Someone liked your post',
        data: { postId, userId },
      });
    }

    logger.info('Post liked', { postId, userId });
  }

  async unlikePost(postId: string, userId: string): Promise<void> {
    await postRepository.unlikePost(userId, postId);
    logger.info('Post unliked', { postId, userId });
  }

  async createComment(data: ICreateCommentDTO): Promise<IComment> {
    const post = await postRepository.findById(data.postId);
    if (!post || post.deletedAt) {
      throw new NotFoundError('Post not found', 'POST_NOT_FOUND');
    }

    // Check if blocked
    const isBlocked = await blockRepository.isBlocked(data.authorId, post.authorId);
    if (isBlocked) {
      throw new ForbiddenError('Cannot comment on this post', 'BLOCKED');
    }

    if (!data.content || data.content.trim().length === 0) {
      throw new BadRequestError('Comment cannot be empty', 'EMPTY_CONTENT');
    }

    if (data.content.length > 1000) {
      throw new BadRequestError('Comment exceeds maximum length', 'CONTENT_TOO_LONG');
    }

    // Parse mentions
    const mentions = MentionParser.parse(data.content);

    const comment = await postRepository.createComment({
      ...data,
      mentions: [],
    });

    // Send notification to post author
    if (post.authorId !== data.authorId) {
      await notificationRepository.create({
        userId: post.authorId,
        type: 'comment',
        title: 'New comment',
        body: 'Someone commented on your post',
        data: { postId: data.postId, commentId: comment._id, userId: data.authorId },
      });
    }

    logger.info('Comment created', { postId: data.postId, commentId: comment._id });
    return comment;
  }

  async deleteComment(commentId: string, postId: string, userId: string): Promise<void> {
    await postRepository.deleteComment(commentId, postId);
    logger.info('Comment deleted', { commentId, userId });
  }

  async getPostComments(
    postId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IComment>> {
    const post = await postRepository.findById(postId);
    if (!post || post.deletedAt) {
      throw new NotFoundError('Post not found', 'POST_NOT_FOUND');
    }

    return postRepository.getComments(postId, options);
  }

  async sharePost(postId: string, userId: string, content?: string): Promise<IPost> {
    const originalPost = await postRepository.findById(postId);
    if (!originalPost || originalPost.deletedAt) {
      throw new NotFoundError('Post not found', 'POST_NOT_FOUND');
    }

    // Check if blocked
    const isBlocked = await blockRepository.isBlocked(userId, originalPost.authorId);
    if (isBlocked) {
      throw new ForbiddenError('Cannot share this post', 'BLOCKED');
    }

    // Create share post
    const sharePost = await postRepository.createPost({
      authorId: userId,
      content: content || `Shared a post`,
      originalPostId: postId,
      privacy: 'public',
    });

    // Increment share count
    await postRepository.incrementEngagement(postId, 'shareCount');

    // Send notification to original author
    if (originalPost.authorId !== userId) {
      await notificationRepository.create({
        userId: originalPost.authorId,
        type: 'share',
        title: 'Post shared',
        body: 'Someone shared your post',
        data: { postId, sharePostId: sharePost._id, userId },
      });
    }

    logger.info('Post shared', { originalPostId: postId, sharePostId: sharePost._id, userId });
    return sharePost;
  }

  async searchByHashtag(
    hashtag: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IPost>> {
    return postRepository.findByHashtag(hashtag, options);
  }
}

export const postService = new PostService();
