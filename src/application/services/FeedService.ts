import { postRepository } from '../../infrastructure/database/repositories/PostRepository.js';
import { friendshipRepository, blockRepository } from '../../infrastructure/database/repositories/index.js';
import { userRepository } from '../../infrastructure/database/repositories/UserRepository.js';
import { eventRepository } from '../../infrastructure/database/repositories/EventRepository.js';
import { IPost } from '../../domain/entities/Post.js';
import { IPaginationOptions, IPaginatedResult } from '../../domain/repositories/IBaseRepository.js';
import { redisClient } from '../../config/redis.js';
import { logger } from '../../shared/utils/logger.js';

export class FeedService {
  private readonly FEED_CACHE_TTL = 300; // 5 minutes

  async getHomeFeed(userId: string, options: IPaginationOptions): Promise<IPaginatedResult<IPost>> {
    const cacheKey = `feed:home:${userId}:${options.page}:${options.limit}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.info('Feed cache hit', { userId, type: 'home' });
      return JSON.parse(cached);
    }

    // Get user's friends
    const friendships = await friendshipRepository.getUserFriends(userId, { page: 1, limit: 1000 });
    const friendIds = friendships.data.map((f) => {
      return f.user1Id.toString() === userId ? f.user2Id.toString() : f.user1Id.toString();
    });

    // Get blocked users
    const blockedUsers = await blockRepository.getBlockedUsers(userId, { page: 1, limit: 1000 });
    const blockerUsers = await blockRepository.getBlockerUsers(userId);
    const blockedUserIds = [
      ...blockedUsers.data.map((b) => b.blockedUserId),
      ...blockerUsers,
    ];

    // Filter out blocked users from friends
    const validFriendIds = friendIds.filter((id) => !blockedUserIds.includes(id));

    // Get posts from friends
    let posts = await postRepository.findForFeed(validFriendIds, options);

    // Calculate relevance scores and sort
    const scoredPosts = await Promise.all(
      posts.data.map(async (post) => {
        const score = await this.calculateRelevanceScore(post, userId);
        return { post, score };
      })
    );

    scoredPosts.sort((a, b) => b.score - a.score);
    posts.data = scoredPosts.map((sp) => sp.post);

    // Cache result
    await redisClient.set(cacheKey, JSON.stringify(posts), this.FEED_CACHE_TTL);

    logger.info('Home feed generated', { userId, postsCount: posts.data.length });
    return posts;
  }

  async getDiscoverFeed(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IPost>> {
    const cacheKey = `feed:discover:${userId}:${options.page}:${options.limit}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.info('Feed cache hit', { userId, type: 'discover' });
      return JSON.parse(cached);
    }

    // Get user's city
    const user = await userRepository.findById(userId);
    if (!user) {
      return { data: [], total: 0, page: 1, limit: 20, totalPages: 0, hasNextPage: false, hasPrevPage: false };
    }

    // Get blocked users
    const blockedUsers = await blockRepository.getBlockedUsers(userId, { page: 1, limit: 1000 });
    const blockerUsers = await blockRepository.getBlockerUsers(userId);
    const blockedUserIds = [
      ...blockedUsers.data.map((b) => b.blockedUserId),
      ...blockerUsers,
    ];

    // Get public posts (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let posts = await postRepository.findPublicPosts(options);

    // Filter out blocked users and old posts
    posts.data = posts.data.filter((post) => {
      return (
        !blockedUserIds.includes(post.authorId) &&
        new Date(post.createdAt) > sevenDaysAgo
      );
    });

    // Sort by engagement
    posts.data.sort((a, b) => {
      const engagementA = a.likeCount + a.commentCount * 2 + a.shareCount * 3;
      const engagementB = b.likeCount + b.commentCount * 2 + b.shareCount * 3;
      return engagementB - engagementA;
    });

    // Cache result
    await redisClient.set(cacheKey, JSON.stringify(posts), this.FEED_CACHE_TTL);

    logger.info('Discover feed generated', { userId, postsCount: posts.data.length });
    return posts;
  }

  async getEventFeed(
    userId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<IPost>> {
    const cacheKey = `feed:events:${userId}:${options.page}:${options.limit}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.info('Feed cache hit', { userId, type: 'events' });
      return JSON.parse(cached);
    }

    // Get user's events
    const events = await eventRepository.findUserEvents(userId);
    const eventIds = events.map((e) => e._id);

    // Get blocked users
    const blockedUsers = await blockRepository.getBlockedUsers(userId, { page: 1, limit: 1000 });
    const blockerUsers = await blockRepository.getBlockerUsers(userId);
    const blockedUserIds = [
      ...blockedUsers.data.map((b) => b.blockedUserId),
      ...blockerUsers,
    ];

    // Get posts from events
    const allPosts: IPost[] = [];
    for (const eventId of eventIds) {
      const eventPosts = await postRepository.findByEvent(eventId, { page: 1, limit: 100 });
      allPosts.push(...eventPosts.data);
    }

    // Filter out blocked users
    const filteredPosts = allPosts.filter((post) => !blockedUserIds.includes(post.authorId));

    // Sort by date
    filteredPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Paginate
    const page = options.page || 1;
    const limit = options.limit || 20;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedPosts = filteredPosts.slice(start, end);

    const result = {
      data: paginatedPosts,
      total: filteredPosts.length,
      page,
      limit,
      totalPages: Math.ceil(filteredPosts.length / limit),
      hasNextPage: end < filteredPosts.length,
      hasPrevPage: page > 1,
    };

    // Cache result
    await redisClient.set(cacheKey, JSON.stringify(result), this.FEED_CACHE_TTL);

    logger.info('Event feed generated', { userId, postsCount: result.data.length });
    return result;
  }

  async calculateRelevanceScore(post: IPost, viewerId: string): Promise<number> {
    // Recency score (0-1)
    const hoursSincePost = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
    const recencyScore = 1 / (1 + hoursSincePost / 24);

    // Engagement score (0-1)
    const totalEngagement = post.likeCount + post.commentCount * 2 + post.shareCount * 3;
    const engagementScore = Math.min(totalEngagement / 100, 1);

    // Relationship score (0-1)
    const areFriends = await friendshipRepository.areFriends(viewerId, post.authorId);
    const relationshipScore = areFriends ? 1.0 : 0.5;

    // Calculate final score
    const score = recencyScore * 0.4 + engagementScore * 0.3 + relationshipScore * 0.3;

    return score;
  }

  async invalidateFeedCache(userId: string): Promise<void> {
    const keys = [
      `feed:home:${userId}:*`,
      `feed:discover:${userId}:*`,
      `feed:events:${userId}:*`,
    ];

    for (const pattern of keys) {
      await redisClient.del(pattern);
    }

    logger.info('Feed cache invalidated', { userId });
  }
}

export const feedService = new FeedService();
