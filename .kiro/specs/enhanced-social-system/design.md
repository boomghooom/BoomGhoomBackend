# Design Document: Enhanced Social System

## Overview

The Enhanced Social System transforms BoomGhoom into a comprehensive social platform by introducing posts, feeds, and improved social interactions. The system follows clean architecture principles with clear separation between domain entities, application services, infrastructure repositories, and API controllers.

The design introduces four new core entities (Post, Comment, Like, Share) and three new services (PostService, FeedService, RecommendationService) while enhancing the existing SocialService. The system integrates seamlessly with existing event and chat systems, uses Redis for caching and performance optimization, and Socket.IO for real-time updates.

Key architectural decisions:
- **Separate collections** for posts, comments, likes to enable efficient querying and scaling
- **Denormalized engagement counts** on posts for fast retrieval
- **Feed ranking algorithm** based on recency, engagement, and relationship strength
- **Redis caching** for feeds and friend suggestions with smart invalidation
- **Event-driven notifications** using Socket.IO for real-time updates
- **Privacy-first design** with block checks at every interaction point

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Post       │  │    Feed      │  │   Social     │      │
│  │  Controller  │  │  Controller  │  │  Controller  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Post      │  │    Feed      │  │Recommendation│      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │   Social     │  │ Notification │                        │
│  │   Service    │  │   Service    │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Post      │  │  Friendship  │  │    Cache     │      │
│  │  Repository  │  │  Repository  │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Event     │  │     User     │  │   Socket     │      │
│  │  Repository  │  │  Repository  │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   MongoDB    │  │    Redis     │  │     S3       │      │
│  │  (Primary)   │  │   (Cache)    │  │   (Media)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Service Responsibilities

**PostService**:
- Create, update, delete posts
- Handle post engagement (likes, comments, shares)
- Parse mentions and hashtags
- Validate permissions and privacy
- Trigger notifications for engagement

**FeedService**:
- Generate personalized feeds (home, discover, event)
- Calculate relevance scores for ranking
- Apply privacy filters and block checks
- Manage feed caching and invalidation
- Implement cursor-based pagination

**RecommendationService**:
- Generate friend suggestions based on multiple factors
- Calculate suggestion relevance scores
- Cache suggestions with smart invalidation
- Rank suggestions by mutual friends, events, proximity

**SocialService** (Enhanced):
- Handle friend requests to any user (not just event participants)
- Manage block relationships by user ID (not friendship ID)
- Check block status in both directions
- Remove friendships when blocking occurs

### Data Flow Examples

**Creating a Post**:
```
User → API Controller → PostService → PostRepository → MongoDB
                     ↓
                  Parse mentions/hashtags
                     ↓
                  Validate event reference
                     ↓
                  Upload media to S3
                     ↓
                  Create notifications
                     ↓
                  Invalidate cached feeds
                     ↓
                  Emit Socket.IO event
```

**Generating Home Feed**:
```
User → API Controller → FeedService → Check Redis cache
                                    ↓ (cache miss)
                                  Get friend IDs
                                    ↓
                                  Query posts from friends
                                    ↓
                                  Filter by privacy & blocks
                                    ↓
                                  Calculate relevance scores
                                    ↓
                                  Sort by score
                                    ↓
                                  Cache in Redis (5 min TTL)
                                    ↓
                                  Return paginated results
```

## Components and Interfaces

### Domain Entities

**Post Entity**:
```typescript
interface Post {
  id: string;
  authorId: string;
  content: string;
  mediaUrls: string[];
  mediaTypes: ('image' | 'video')[];
  eventId?: string;
  mentions: string[];  // Array of user IDs
  hashtags: string[];  // Array of lowercase hashtags
  privacy: 'public' | 'friends_only' | 'private';
  likeCount: number;
  commentCount: number;
  shareCount: number;
  originalPostId?: string;  // For shares
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

**Comment Entity**:
```typescript
interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  parentCommentId?: string;  // For nested replies
  mentions: string[];
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

**Like Entity**:
```typescript
interface Like {
  id: string;
  userId: string;
  targetId: string;  // Post ID or Comment ID
  targetType: 'post' | 'comment';
  createdAt: Date;
}
```

**FriendSuggestion Entity**:
```typescript
interface FriendSuggestion {
  userId: string;
  suggestedUserId: string;
  score: number;
  reasons: {
    mutualFriends: number;
    sharedEvents: number;
    proximityKm: number;
  };
  createdAt: Date;
}
```

**BlockRelationship Entity** (NEW - Replaces friendship-based blocking):
```typescript
interface BlockRelationship {
  id: string;
  blockerId: string;  // User who initiated the block
  blockedUserId: string;  // User who is blocked
  createdAt: Date;
}
```

**Migration from Old System:**
- **Old**: Blocking required friendship ID, only friends could be blocked
- **New**: Blocking uses user ID directly, ANY user can be blocked
- **Migration**: Keep existing blocked friendships, add new blocks collection

### Service Interfaces

**IPostService**:
```typescript
interface IPostService {
  createPost(data: CreatePostDTO): Promise<Post>;
  updatePost(postId: string, userId: string, data: UpdatePostDTO): Promise<Post>;
  deletePost(postId: string, userId: string): Promise<void>;
  getPost(postId: string, viewerId: string): Promise<Post | null>;
  getUserPosts(userId: string, viewerId: string, pagination: PaginationDTO): Promise<PaginatedResult<Post>>;
  
  likePost(postId: string, userId: string): Promise<void>;
  unlikePost(postId: string, userId: string): Promise<void>;
  
  createComment(postId: string, data: CreateCommentDTO): Promise<Comment>;
  deleteComment(commentId: string, userId: string): Promise<void>;
  getPostComments(postId: string, pagination: PaginationDTO): Promise<PaginatedResult<Comment>>;
  
  sharePost(postId: string, userId: string, content?: string): Promise<Post>;
  
  searchByHashtag(hashtag: string, pagination: PaginationDTO): Promise<PaginatedResult<Post>>;
}
```

**IFeedService**:
```typescript
interface IFeedService {
  getHomeFeed(userId: string, pagination: CursorPaginationDTO): Promise<PaginatedResult<Post>>;
  getDiscoverFeed(userId: string, pagination: CursorPaginationDTO): Promise<PaginatedResult<Post>>;
  getEventFeed(userId: string, pagination: CursorPaginationDTO): Promise<PaginatedResult<Post>>;
  
  calculateRelevanceScore(post: Post, viewerId: string): Promise<number>;
  invalidateFeedCache(userId: string): Promise<void>;
}
```

**IRecommendationService**:
```typescript
interface IRecommendationService {
  getFriendSuggestions(userId: string, limit: number): Promise<FriendSuggestion[]>;
  calculateSuggestionScore(userId: string, candidateId: string): Promise<number>;
  invalidateSuggestionCache(userId: string): Promise<void>;
}
```

**ISocialService** (Enhanced):
```typescript
interface ISocialService {
  // Enhanced friend request methods
  sendFriendRequest(fromUserId: string, toUserId: string): Promise<Friendship>;
  acceptFriendRequest(friendshipId: string, userId: string): Promise<Friendship>;
  rejectFriendRequest(friendshipId: string, userId: string): Promise<void>;
  getFriends(userId: string): Promise<User[]>;
  
  // Enhanced block methods (using user IDs directly)
  blockUser(blockerId: string, blockedUserId: string): Promise<void>;
  unblockUser(blockerId: string, blockedUserId: string): Promise<void>;
  getBlockedUsers(userId: string): Promise<User[]>;
  isBlocked(userId1: string, userId2: string): Promise<boolean>;
  
  // Search
  searchUsers(query: string, searcherId: string, pagination: PaginationDTO): Promise<PaginatedResult<User>>;
}
```

### API Endpoints

**Post Endpoints**:
```
POST   /api/posts                    - Create post
GET    /api/posts/:postId            - Get single post
PUT    /api/posts/:postId            - Update post
DELETE /api/posts/:postId            - Delete post
GET    /api/posts/user/:userId       - Get user's posts

POST   /api/posts/:postId/like       - Like post
DELETE /api/posts/:postId/like       - Unlike post

POST   /api/posts/:postId/comments   - Create comment
GET    /api/posts/:postId/comments   - Get post comments
DELETE /api/comments/:commentId      - Delete comment

POST   /api/posts/:postId/share      - Share post

GET    /api/posts/hashtag/:hashtag   - Search by hashtag
```

**Feed Endpoints**:
```
GET /api/feed/home                   - Get home feed
GET /api/feed/discover               - Get discover feed
GET /api/feed/events                 - Get event feed
```

**Social Endpoints** (Enhanced):
```
POST   /api/social/friends/request   - Send friend request (to any user)
POST   /api/social/friends/accept    - Accept friend request
POST   /api/social/friends/reject    - Reject friend request
GET    /api/social/friends           - Get friends list

POST   /api/social/block             - Block user (by user ID)
DELETE /api/social/block/:userId     - Unblock user
GET    /api/social/blocked           - Get blocked users

GET    /api/social/suggestions       - Get friend suggestions
GET    /api/social/search            - Search users
```

## Data Models

### MongoDB Collections

**posts Collection**:
```typescript
{
  _id: ObjectId,
  authorId: ObjectId,
  content: string,
  mediaUrls: string[],
  mediaTypes: string[],
  eventId: ObjectId | null,
  mentions: ObjectId[],
  hashtags: string[],
  privacy: string,
  likeCount: number,
  commentCount: number,
  shareCount: number,
  originalPostId: ObjectId | null,
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date | null
}

// Indexes
{ authorId: 1, createdAt: -1 }
{ hashtags: 1, createdAt: -1 }
{ eventId: 1, createdAt: -1 }
{ createdAt: -1 }
{ mentions: 1, createdAt: -1 }
```

**comments Collection**:
```typescript
{
  _id: ObjectId,
  postId: ObjectId,
  authorId: ObjectId,
  content: string,
  parentCommentId: ObjectId | null,
  mentions: ObjectId[],
  likeCount: number,
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date | null
}

// Indexes
{ postId: 1, createdAt: -1 }
{ parentCommentId: 1, createdAt: -1 }
{ authorId: 1, createdAt: -1 }
```

**likes Collection**:
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  targetId: ObjectId,
  targetType: string,
  createdAt: Date
}

// Indexes
{ userId: 1, targetId: 1, targetType: 1 } (unique)
{ targetId: 1, targetType: 1, createdAt: -1 }
```

**friendships Collection** (Existing - No changes needed):
```typescript
{
  _id: ObjectId,
  user1Id: ObjectId,
  user2Id: ObjectId,
  status: string,  // 'pending', 'accepted'
  requesterId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ user1Id: 1, user2Id: 1 } (unique)
{ user1Id: 1, status: 1 }
{ user2Id: 1, status: 1 }
```

**blocks Collection** (New - replaces blockedBy field):
```typescript
{
  _id: ObjectId,
  blockerId: ObjectId,
  blockedUserId: ObjectId,
  createdAt: Date
}

// Indexes
{ blockerId: 1, blockedUserId: 1 } (unique)
{ blockedUserId: 1 }
```

### Redis Cache Keys

```
feed:home:{userId}:{cursor}           - Home feed cache (TTL: 5 min)
feed:discover:{userId}:{cursor}       - Discover feed cache (TTL: 5 min)
feed:events:{userId}:{cursor}         - Event feed cache (TTL: 5 min)
suggestions:{userId}                  - Friend suggestions (TTL: 1 hour)
block:check:{userId1}:{userId2}       - Block status cache (TTL: 10 min)
post:engagement:{postId}              - Post engagement counts (TTL: 1 min)
```

### Feed Ranking Algorithm

**Relevance Score Calculation**:
```
score = recencyScore * 0.4 + engagementScore * 0.3 + relationshipScore * 0.3

recencyScore = 1 / (1 + hoursSincePost / 24)
  - Posts from last hour: ~1.0
  - Posts from 24 hours ago: ~0.5
  - Posts from 7 days ago: ~0.1

engagementScore = (likes + comments * 2 + shares * 3) / (1 + totalEngagement)
  - Normalized between 0 and 1
  - Comments weighted 2x likes
  - Shares weighted 3x likes

relationshipScore:
  - Close friend (frequent interactions): 1.0
  - Regular friend: 0.7
  - Event participant: 0.5
  - Same city user: 0.3
```

**Friend Suggestion Score Calculation**:
```
score = mutualFriendsScore * 0.5 + sharedEventsScore * 0.3 + proximityScore * 0.2

mutualFriendsScore = min(mutualFriendCount / 10, 1.0)
  - 10+ mutual friends: 1.0
  - 5 mutual friends: 0.5
  - 1 mutual friend: 0.1

sharedEventsScore = min(sharedEventCount / 5, 1.0)
  - 5+ shared events: 1.0
  - 2 shared events: 0.4
  - 1 shared event: 0.2

proximityScore:
  - Within 5km: 1.0
  - Within 10km: 0.7
  - Within 25km: 0.4
  - Within 50km: 0.2
  - Beyond 50km: 0.0
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Post Creation and Management Properties

**Property 1: Post Creation with Valid Content**
*For any* valid text content (non-empty, ≤5000 characters), creating a post should return a post object containing the provided content and the correct author ID.
**Validates: Requirements 1.1**

**Property 2: Post Creation with Media**
*For any* valid media files (supported formats, ≤50MB total), creating a post should upload files to S3 and store the resulting URLs in the post's mediaUrls array.
**Validates: Requirements 1.2**

**Property 3: Event Reference Validation**
*For any* post creation with an event ID, the post should only be created if the event exists in the database; otherwise, validation should fail.
**Validates: Requirements 1.3**

**Property 4: Privacy Setting Storage**
*For any* privacy level (public, friends_only, private), creating a post with that privacy level should store it correctly and retrieving the post should return the same privacy level.
**Validates: Requirements 1.4**

**Property 5: Post Update Preserves Ownership**
*For any* post and its author, updating the post with new content should succeed and update the timestamp; attempting to update as a different user should fail with authorization error.
**Validates: Requirements 1.5, 1.7**

**Property 6: Post Deletion Cascade**
*For any* post with associated engagement (likes, comments, shares), deleting the post should remove the post and all associated engagement data from the database.
**Validates: Requirements 1.6, 2.10**

### Post Engagement Properties

**Property 7: Like/Unlike Round Trip**
*For any* post and user, liking then unliking the post should return the like count to its original value, and the user should no longer appear in the post's likers.
**Validates: Requirements 2.1, 2.2**

**Property 8: Like Idempotence**
*For any* post and user, liking the post multiple times should result in the same state as liking it once (like count increases by 1, only one like record exists).
**Validates: Requirements 2.3**

**Property 9: Comment Creation Increments Count**
*For any* post and valid comment content, creating a comment should increment the post's comment count by 1 and the comment should appear in the post's comments.
**Validates: Requirements 2.4**

**Property 10: Nested Comment Parent Relationship**
*For any* comment and valid reply content, creating a reply should create a nested comment with parentCommentId pointing to the original comment.
**Validates: Requirements 2.5**

**Property 11: Comment Deletion Decrements Count**
*For any* comment, deleting it should decrement the post's comment count by 1 and the comment should no longer appear in the post's comments.
**Validates: Requirements 2.6**

**Property 12: Share Creation and Count Increment**
*For any* post, sharing it should create a new post with originalPostId referencing the original post and increment the original post's share count by 1.
**Validates: Requirements 2.7, 2.8**

### Mentions and Hashtags Properties

**Property 13: Mention Parsing and Extraction**
*For any* post content containing @username patterns, the system should parse and extract all mentioned usernames into the mentions array.
**Validates: Requirements 3.1**

**Property 14: Mention User Validation**
*For any* post with mentions, the system should only create the post if all mentioned users exist in the database; otherwise, validation should fail.
**Validates: Requirements 3.2**

**Property 15: Mention Notification Creation**
*For any* post with valid mentions, creating the post should create a notification for each mentioned user (excluding users who have blocked the author).
**Validates: Requirements 3.3, 3.7**

**Property 16: Hashtag Parsing and Extraction**
*For any* post content containing #hashtag patterns, the system should parse and extract all hashtags into the hashtags array.
**Validates: Requirements 3.4**

**Property 17: Hashtag Normalization**
*For any* post with hashtags, all hashtags should be stored in lowercase regardless of the original casing in the post content.
**Validates: Requirements 3.5**

**Property 18: Hashtag Search Completeness**
*For any* hashtag, searching for that hashtag should return all posts containing that hashtag (case-insensitive).
**Validates: Requirements 3.6**

### Feed Generation and Ranking Properties

**Property 19: Home Feed Friend Filtering**
*For any* user requesting their home feed, all returned posts should be authored by users who are friends with the requesting user.
**Validates: Requirements 4.1**

**Property 20: Relevance Score Calculation**
*For any* post, the relevance score should be calculated using the formula: recencyScore * 0.4 + engagementScore * 0.3 + relationshipScore * 0.3, where each component follows the specified calculation rules.
**Validates: Requirements 4.2**

**Property 21: Discover Feed City Filtering**
*For any* user requesting the discover feed, all returned posts should be authored by users in the same city as the requesting user.
**Validates: Requirements 4.3**

**Property 22: Event Feed Participant Filtering**
*For any* user requesting the event feed, all returned posts should be authored by participants of events the requesting user has joined.
**Validates: Requirements 4.4**

**Property 23: Feed Block Filtering**
*For any* user requesting any feed, the results should exclude all posts authored by users who have blocked the requesting user or whom the requesting user has blocked.
**Validates: Requirements 4.5**

**Property 24: Feed Privacy Filtering**
*For any* user requesting any feed, the results should only include posts where the user has permission to view based on privacy settings (public for all, friends_only for friends, private for author only).
**Validates: Requirements 4.6**

**Property 25: Feed Pagination Consistency**
*For any* feed request with cursor-based pagination, each page should return exactly 20 posts (or fewer for the last page), and using the returned cursor should fetch the next page without duplicates or gaps.
**Validates: Requirements 4.7**

**Property 26: Feed Cache Invalidation on Post Creation**
*For any* new post creation, the cached home feeds for all friends of the post author should be invalidated.
**Validates: Requirements 4.8**

**Property 27: Discover Feed Recency Filtering**
*For any* user requesting the discover feed, all returned posts should be from the last 7 days and ranked by engagement score.
**Validates: Requirements 4.9**

**Property 28: Home Feed Time Window**
*For any* user requesting the home feed, all returned posts should be from the last 30 days maximum.
**Validates: Requirements 4.10**

### Enhanced Friend System Properties

**Property 29: Friend Request to Any User**
*For any* two valid user IDs where neither has blocked the other, sending a friend request should create a pending friendship record with the correct requester and recipient.
**Validates: Requirements 5.1**

**Property 30: Friend Request Block Validation**
*For any* two users where one has blocked the other, attempting to send a friend request should fail with a validation error.
**Validates: Requirements 5.2**

**Property 31: Friend Request Acceptance**
*For any* pending friendship, accepting the request should update the friendship status to "accepted" and both users should appear in each other's friends list.
**Validates: Requirements 5.3**

**Property 32: Friend Request Rejection**
*For any* pending friendship, rejecting the request should remove the friendship record from the database.
**Validates: Requirements 5.4**

**Property 33: Friend Suggestions Include Mutual Friends**
*For any* user requesting friend suggestions, the results should include users who share mutual friends with the requesting user (excluding already-friends and blocked users).
**Validates: Requirements 5.5, 5.8**

**Property 34: Friend Suggestions Include Event Participants**
*For any* user requesting friend suggestions, the results should include users who have participated in the same events (excluding already-friends and blocked users).
**Validates: Requirements 5.6, 5.8**

**Property 35: Friend Suggestions Proximity Filtering**
*For any* user requesting friend suggestions, the results should only include users within 50km proximity (excluding already-friends and blocked users).
**Validates: Requirements 5.7, 5.8**

**Property 36: User Search Matching**
*For any* search query, the results should include all users whose name or location contains the query string (case-insensitive).
**Validates: Requirements 5.9**

**Property 37: Friend Suggestion Ranking**
*For any* friend suggestions, they should be ranked by relevance score calculated as: mutualFriendsScore * 0.5 + sharedEventsScore * 0.3 + proximityScore * 0.2.
**Validates: Requirements 5.10**

### Improved Block System Properties

**Property 38: Block User by User ID**
*For any* two valid user IDs, blocking should create a block relationship record with the correct blocker and blocked user IDs.
**Validates: Requirements 6.1**

**Property 39: Block Removes Friendship**
*For any* two users with an existing friendship, blocking one user should remove the friendship record from the database.
**Validates: Requirements 6.2**

**Property 40: Block Prevents Friend Requests**
*For any* two users where one has blocked the other, attempting to send a friend request in either direction should fail with a validation error.
**Validates: Requirements 6.3**

**Property 41: Bidirectional Block Post Filtering**
*For any* two users where one has blocked the other, neither user should see the other's posts in any feed, regardless of who initiated the block.
**Validates: Requirements 6.4, 6.5**

**Property 42: Block/Unblock Round Trip**
*For any* two users, blocking then unblocking should remove the block relationship, and the users should be able to interact normally again.
**Validates: Requirements 6.6**

**Property 43: Blocked Users List Completeness**
*For any* user requesting their blocked users list, the results should include all users they have blocked and no users they haven't blocked.
**Validates: Requirements 6.7**

**Property 44: Block Prevents All Engagement**
*For any* two users where one has blocked the other, the blocked user should not be able to like or comment on the blocker's posts.
**Validates: Requirements 6.8, 6.9**

**Property 45: Bidirectional Block Check**
*For any* two users, checking if they are blocked should return true if either user has blocked the other (checking both directions).
**Validates: Requirements 6.10**

### Privacy and Permissions Properties

**Property 46: Public Post Visibility**
*For any* post with privacy level "public", the post should appear in feeds for all users (subject to block filtering).
**Validates: Requirements 7.1**

**Property 47: Friends-Only Post Visibility**
*For any* post with privacy level "friends_only", the post should only appear in feeds for users who are friends with the post author.
**Validates: Requirements 7.2**

**Property 48: Private Post Visibility**
*For any* post with privacy level "private", the post should only appear in feeds for the post author.
**Validates: Requirements 7.3**

**Property 49: Non-Friend Profile Visibility**
*For any* user viewing another user's profile without being friends, only posts with privacy level "public" should be visible.
**Validates: Requirements 7.4**

**Property 50: Friend Profile Visibility**
*For any* user viewing a friend's profile, posts with privacy levels "public" and "friends_only" should be visible.
**Validates: Requirements 7.5**

**Property 51: Self Profile Visibility**
*For any* user viewing their own profile, all posts should be visible regardless of privacy level.
**Validates: Requirements 7.6**

**Property 52: Share Privacy Inheritance**
*For any* shared post, viewing the share should respect the original post's privacy settings (if the viewer doesn't have permission to see the original, they shouldn't see it through the share).
**Validates: Requirements 7.7**

**Property 53: Dynamic Privacy Enforcement on Unfriend**
*For any* two users who were friends, if the friendship is removed, friends_only posts from one user should immediately stop appearing in the other user's feeds.
**Validates: Requirements 7.8**

### Notifications and Real-time Updates Properties

**Property 54: Like Notification Creation**
*For any* post that receives a like, a notification should be created for the post author (unless the liker is the author).
**Validates: Requirements 8.1**

**Property 55: Comment Notification Creation**
*For any* post that receives a comment, a notification should be created for the post author (unless the commenter is the author).
**Validates: Requirements 8.2**

**Property 56: Mention Notification Creation**
*For any* user mentioned in a post, a notification should be created for that user (unless they blocked the post author).
**Validates: Requirements 8.3**

**Property 57: Friend Request Notification Creation**
*For any* friend request sent, a notification should be created for the recipient.
**Validates: Requirements 8.4**

**Property 58: Friend Request Acceptance Notification**
*For any* friend request accepted, a notification should be created for the original requester.
**Validates: Requirements 8.5**

**Property 59: Real-time Notification Emission**
*For any* notification created, a Socket.IO event should be emitted to the recipient's connected clients.
**Validates: Requirements 8.6**

**Property 60: Real-time Engagement Update Emission**
*For any* post engagement (like, comment, share), a Socket.IO event should be emitted to connected clients viewing that post.
**Validates: Requirements 8.7**

**Property 61: Notification Aggregation**
*For any* set of similar notifications (same type, same target) within a time window, they should be aggregated into a single notification showing the count and sample users.
**Validates: Requirements 8.8**

### Performance and Caching Properties

**Property 62: Feed Cache Check Before Database Query**
*For any* feed request, the system should check Redis cache first and only query the database on cache miss.
**Validates: Requirements 9.1**

**Property 63: Feed Result Caching**
*For any* generated feed, the result should be cached in Redis with a 5-minute TTL using the appropriate cache key format.
**Validates: Requirements 9.2**

**Property 64: Cache Invalidation on Post Mutation**
*For any* post creation or update, the cached feeds for all relevant users (friends, same city users, event participants) should be invalidated.
**Validates: Requirements 9.3**

**Property 65: Friend Suggestion Caching**
*For any* generated friend suggestions, the results should be cached in Redis with a 1-hour TTL.
**Validates: Requirements 9.6**

**Property 66: Cache Invalidation on Block**
*For any* block action, the cached friend suggestions for both the blocker and blocked user should be invalidated.
**Validates: Requirements 9.7**

**Property 67: Denormalized Engagement Counts**
*For any* post, the likeCount, commentCount, and shareCount fields should always match the actual count of like, comment, and share records for that post.
**Validates: Requirements 9.8**

### Data Integrity and Validation Properties

**Property 68: Event Reference Validation**
*For any* post with an eventId, the referenced event must exist in the database at the time of post creation.
**Validates: Requirements 10.1**

**Property 69: Mention User Validation**
*For any* post with mentions, all mentioned user IDs must exist in the database at the time of post creation.
**Validates: Requirements 10.2**

**Property 70: Parent Comment Validation**
*For any* comment with a parentCommentId, the parent comment must exist in the database at the time of comment creation.
**Validates: Requirements 10.3**

**Property 71: Original Post Validation for Shares**
*For any* share, the original post must exist and not be deleted at the time of share creation.
**Validates: Requirements 10.4**

**Property 72: User Deletion Cascade**
*For any* user account deletion, all posts authored by that user should be marked as deleted or removed from the database.
**Validates: Requirements 10.5**

**Property 73: Event Deletion Reference Cleanup**
*For any* event deletion, all posts referencing that event should have their eventId field set to null, but the posts should remain in the database.
**Validates: Requirements 10.6**

**Property 74: Friendship Uniqueness**
*For any* two users, attempting to create multiple friendship records should result in only one friendship record existing in the database.
**Validates: Requirements 10.7**

**Property 75: Block Relationship Uniqueness**
*For any* two users, attempting to create multiple block records should result in only one block record existing in the database.
**Validates: Requirements 10.8**

**Property 76: Post Author Validation**
*For any* post creation, the authorId must reference an existing user in the database.
**Validates: Requirements 10.9**

**Property 77: Atomic Engagement Counter Updates**
*For any* concurrent engagement operations (likes, comments, shares) on the same post, the final engagement counts should accurately reflect all operations without race conditions.
**Validates: Requirements 10.10**


## Error Handling

### Error Categories

**Validation Errors** (400 Bad Request):
- Invalid post content (empty, exceeds character limit)
- Invalid media format or size
- Invalid privacy level
- Invalid user ID, event ID, or post ID format
- Missing required fields

**Authorization Errors** (403 Forbidden):
- Attempting to update/delete another user's post
- Attempting to update/delete another user's comment
- Attempting to interact with blocked user's content
- Attempting to view private content without permission

**Not Found Errors** (404 Not Found):
- Post not found
- Comment not found
- User not found
- Event not found
- Friendship not found

**Conflict Errors** (409 Conflict):
- Duplicate friendship record
- Duplicate block record
- Attempting to friend request someone who blocked you

**Server Errors** (500 Internal Server Error):
- Database connection failures
- Redis connection failures
- S3 upload failures
- Unexpected exceptions

### Error Response Format

All errors follow a consistent format:

```typescript
{
  success: false,
  error: {
    code: string,        // Machine-readable error code
    message: string,     // Human-readable error message
    details?: any        // Optional additional context
  }
}
```

### Error Handling Strategies

**Graceful Degradation**:
- If Redis is unavailable, skip caching and query database directly
- If S3 upload fails, return error but don't create post
- If Socket.IO emission fails, log error but don't fail the operation

**Retry Logic**:
- Database operations: Retry up to 3 times with exponential backoff
- S3 uploads: Retry up to 2 times
- Redis operations: No retry (fail fast and degrade gracefully)

**Transaction Handling**:
- Post deletion with cascade: Use MongoDB transactions
- Block user with friendship removal: Use MongoDB transactions
- Engagement counter updates: Use atomic operations ($inc)

**Validation Order**:
1. Input format validation (schema validation)
2. Authentication check (valid user token)
3. Authorization check (permission to perform action)
4. Business logic validation (block checks, privacy checks)
5. Database constraint validation (foreign key checks)

## Testing Strategy

### Dual Testing Approach

The Enhanced Social System requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
**Property Tests**: Verify universal properties across all inputs through randomization

Both testing approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing Configuration

**Testing Library**: Use `fast-check` for TypeScript/JavaScript property-based testing

**Test Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `// Feature: enhanced-social-system, Property {number}: {property_text}`

**Example Property Test Structure**:
```typescript
import fc from 'fast-check';

describe('Post Creation Properties', () => {
  it('Property 1: Post Creation with Valid Content', async () => {
    // Feature: enhanced-social-system, Property 1: Post Creation with Valid Content
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 5000 }),
        fc.string(), // userId
        async (content, userId) => {
          const post = await postService.createPost({ content, authorId: userId });
          expect(post.content).toBe(content);
          expect(post.authorId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Testing Focus Areas

**Specific Examples**:
- Creating a post with exactly 5000 characters (boundary)
- Creating a post with exactly 50MB media (boundary)
- Liking a post that doesn't exist
- Commenting on a deleted post

**Edge Cases**:
- Empty content validation
- Unsupported media formats
- Invalid user IDs
- Circular comment replies (if depth limit exists)

**Integration Points**:
- Post creation triggers feed cache invalidation
- Block action removes friendship
- Post deletion cascades to engagement data
- Mention parsing with special characters

**Error Conditions**:
- Database connection failures
- Redis unavailability
- S3 upload failures
- Concurrent engagement updates

### Property-Based Testing Focus Areas

**Universal Properties**:
- All 77 correctness properties defined in this document
- Each property should have exactly one property-based test
- Properties should be tested with randomly generated inputs

**Generator Strategies**:
- Valid posts: Random content (1-5000 chars), random privacy levels, random media
- Valid users: Random user IDs from a pool of test users
- Valid friendships: Random pairs of users
- Valid blocks: Random pairs of users (excluding existing blocks)
- Valid comments: Random content (1-1000 chars), random parent comments
- Valid hashtags: Random strings with # prefix
- Valid mentions: Random @username patterns

**Property Test Placement**:
- Place property tests close to implementation (catch errors early)
- Group properties by feature area (posts, feeds, friends, blocks)
- Run property tests in CI/CD pipeline

### Test Data Management

**Test Database**:
- Use separate MongoDB database for testing
- Seed with realistic test data (users, events, friendships)
- Clean up after each test suite

**Test Redis**:
- Use separate Redis database (db index 1)
- Clear cache before each test

**Test S3**:
- Use separate S3 bucket for testing
- Mock S3 operations for unit tests
- Use real S3 for integration tests

### Coverage Goals

**Code Coverage**: Minimum 80% line coverage
**Property Coverage**: 100% of defined correctness properties must have tests
**Edge Case Coverage**: All boundary conditions and error paths must be tested

### Performance Testing

**Load Testing**:
- Feed generation with 1000+ friends
- Concurrent engagement on same post (100+ users)
- Bulk friend suggestion generation

**Caching Effectiveness**:
- Measure cache hit rates (target: >80% for feeds)
- Measure feed generation time (target: <100ms with cache, <500ms without)

**Database Performance**:
- Verify index usage with explain plans
- Measure query times (target: <50ms for indexed queries)
