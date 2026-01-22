import { friendshipRepository, blockRepository } from '../../infrastructure/database/repositories/index.js';
import { userRepository } from '../../infrastructure/database/repositories/UserRepository.js';
import { eventRepository } from '../../infrastructure/database/repositories/EventRepository.js';
import { IUserSummary } from '../../domain/entities/User.js';
import { redisClient } from '../../config/redis.js';
import { logger } from '../../shared/utils/logger.js';

interface IFriendSuggestion {
  user: IUserSummary;
  score: number;
  reasons: {
    mutualFriends: number;
    sharedEvents: number;
    proximityKm: number;
  };
}

export class RecommendationService {
  private readonly SUGGESTION_CACHE_TTL = 3600; // 1 hour

  async getFriendSuggestions(userId: string, limit: number = 20): Promise<IFriendSuggestion[]> {
    const cacheKey = `suggestions:${userId}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.info('Suggestions cache hit', { userId });
      return JSON.parse(cached);
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      return [];
    }

    // Get existing friends
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

    // Get pending requests
    const pendingRequests = await friendshipRepository.getPendingRequests(userId, { page: 1, limit: 1000 });
    const pendingUserIds = pendingRequests.data.map((f) => {
      return f.user1Id.toString() === userId ? f.user2Id.toString() : f.user1Id.toString();
    });

    // Get all users (in real app, you'd want to optimize this)
    const allUsers = await userRepository.findMany({});

    const suggestions: IFriendSuggestion[] = [];

    for (const candidate of allUsers) {
      const candidateId = candidate._id.toString();

      // Skip if self, already friend, blocked, or pending request
      if (
        candidateId === userId ||
        friendIds.includes(candidateId) ||
        blockedUserIds.includes(candidateId) ||
        pendingUserIds.includes(candidateId)
      ) {
        continue;
      }

      // Calculate mutual friends
      const mutualFriends = await friendshipRepository.getMutualFriends(userId, candidateId);
      const mutualFriendsCount = mutualFriends.length;

      // Calculate shared events
      const sharedEventsCount = await eventRepository.getMutualEventsCount(userId, candidateId);

      // Calculate proximity
      const proximityKm = this.calculateDistance(
        user.location.latitude,
        user.location.longitude,
        candidate.location.latitude,
        candidate.location.longitude
      );

      // Only suggest if within 50km or has mutual connections
      if (proximityKm > 50 && mutualFriendsCount === 0 && sharedEventsCount === 0) {
        continue;
      }

      // Calculate score
      const score = this.calculateSuggestionScore(
        mutualFriendsCount,
        sharedEventsCount,
        proximityKm
      );

      suggestions.push({
        user: {
          _id: candidate._id,
          fullName: candidate.fullName,
          displayName: candidate.displayName,
          avatarUrl: candidate.avatarUrl,
          gender: candidate.gender,
          isOnline: candidate.isOnline,
          kycVerified: candidate.kyc.status === 'approved',
          averageRating: candidate.stats.averageRating,
        },
        score,
        reasons: {
          mutualFriends: mutualFriendsCount,
          sharedEvents: sharedEventsCount,
          proximityKm: Math.round(proximityKm),
        },
      });
    }

    // Sort by score and limit
    suggestions.sort((a, b) => b.score - a.score);
    const topSuggestions = suggestions.slice(0, limit);

    // Cache result
    await redisClient.set(cacheKey, JSON.stringify(topSuggestions), this.SUGGESTION_CACHE_TTL);

    logger.info('Friend suggestions generated', { userId, count: topSuggestions.length });
    return topSuggestions;
  }

  private calculateSuggestionScore(
    mutualFriends: number,
    sharedEvents: number,
    proximityKm: number
  ): number {
    // Mutual friends score (0-1)
    const mutualFriendsScore = Math.min(mutualFriends / 10, 1.0);

    // Shared events score (0-1)
    const sharedEventsScore = Math.min(sharedEvents / 5, 1.0);

    // Proximity score (0-1)
    let proximityScore = 0;
    if (proximityKm <= 5) proximityScore = 1.0;
    else if (proximityKm <= 10) proximityScore = 0.7;
    else if (proximityKm <= 25) proximityScore = 0.4;
    else if (proximityKm <= 50) proximityScore = 0.2;

    // Calculate final score
    const score = mutualFriendsScore * 0.5 + sharedEventsScore * 0.3 + proximityScore * 0.2;

    return score;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  async invalidateSuggestionCache(userId: string): Promise<void> {
    await redisClient.del(`suggestions:${userId}`);
    logger.info('Suggestion cache invalidated', { userId });
  }
}

export const recommendationService = new RecommendationService();
