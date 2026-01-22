# Implementation Tasks: Enhanced Social System

## Overview

This document outlines the implementation tasks for the Enhanced Social System. Tasks are organized into 8 phases spanning approximately 7 weeks. Each phase builds upon the previous one, with clear dependencies and acceptance criteria.

**Total Estimated Effort**: 7 weeks (1 developer)

---

## Phase 1: Foundation & Block System Fix (Week 1)

### Task 1.1: Create Domain Entities
**Effort**: 2 hours

**Description**: Create TypeScript interfaces for new domain entities.

**Files to Create**:
- `src/domain/entities/Post.ts`
- `src/domain/entities/Feed.ts`

**Implementation**:
```typescript
// src/domain/entities/Post.ts
export interface IPost {
  _id: string;
  authorId: string;
  content: string;
  mediaUrls: string[];
  mediaTypes: ('image' | 'video')[];
  eventId?: string;
  mentions: string[];
  hashtags: string[];
  privacy: 'public' | 'friends_only' | 'private';
  likeCount: number;
  commentCount: number;
  shareCount: number;
  originalPostId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface IComment {
  _id: string;
  postId: string;
  authorId: string;
  content: string;
  parentCommentId?: string;
  mentions: string[];
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface ILike {
  _id: string;
  userId: string;
  targetId: string;
  targetType: 'post' | 'comment';
  createdAt: Date;
}

// DTOs
export interface ICreatePostDTO {
  authorId: string;
  content: string;
  mediaUrls?: string[];
  mediaTypes?: ('image' | 'video')[];
  eventId?: string;
  privacy?: 'public' | 'friends_only' | 'private';
}

export interface IUpdatePostDTO {
  content?: string;
  privacy?: 'public' | 'friends_only' | 'private';
}

export interface ICreateCommentDTO {
  postId: string;
  authorId: string;
  content: string;
  parentCommentId?: string;
}
```

**Acceptance Criteria**:
- All interfaces defined with correct types
- DTOs created for create/update operations
- Exported from domain/entities/index.ts

**Dependencies**: None

---

### Task 1.2: Create Blocks Collection Model
**Effort**: 3 hours

**Description**: Create MongoDB model for the new blocks collection to replace friendship-based blocking.

**Files to Create**:
- `src/infrastructure/database/models/Block.model.ts`

**Files to Modify**:
- `src/infrastructure/database/models/index.ts`

**Implementation**:
```typescript
// src/infrastructure/database/models/Block.model.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBlockDocument extends Document {
  blockerId: mongoose.Types.ObjectId;
  blockedUserId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const BlockSchema = new Schema<IBlockDocument>(
  {
    blockerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blockedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Unique index to prevent duplicate blocks
BlockSchema.index({ blockerId: 1, blockedUserId: 1 }, { unique: true });

// Index for checking if user is blocked
BlockSchema.index({ blockedUserId: 1 });

export const BlockModel = mongoose.model<IBlockDocument>('Block', BlockSchema);
```

**Acceptance Criteria**:
- Block model created with correct schema
- Unique index on blockerId + blockedUserId
- Indexes for efficient queries
- Model exported from index.ts

**Dependencies**: None

---

### Task 1.3: Create Block Repository
**Effort**: 4 hours

**Description**: Create repository for block operations.

**Files to Create**:
- `src/infrastructure/database/repositories/BlockRepository.ts`

**Files to Modify**:
- `src/infrastructure/database/repositories/index.ts`

**Implementation**:
```typescript
// src/infrastructure/database/repositories/BlockRepository.ts
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

  async getBlockerUsers(
    userId: string
  ): Promise<string[]> {
    const blocks = await this.model.find({
      blockedUserId: new Types.ObjectId(userId),
    });
    return blocks.map((b) => b.blockerId.toString());
  }
}

export const blockRepository = new BlockRepository();
```

**Acceptance Criteria**:
- blockUser method with upsert (idempotent)
- unblockUser method
- isBlocked checks both directions
- getBlockedUsers with pagination
- getBlockerUsers for feed filtering
- Repository exported from index.ts

**Dependencies**: Task 1.2

---

### Task 1.4: Update SocialService for Direct User Blocking
**Effort**: 4 hours

**Files to Modify**:
- src/application/services/SocialService.ts
- src/api/controllers/social.controller.ts
- src/api/routes/social.routes.ts

**Changes**:
1. Add new methods to SocialService:
   - blockUserByUserId(blockerId, blockedUserId)
   - unblockUser(blockerId, blockedUserId)
   - isUserBlockedBidirectional(userId1, userId2)

2. Keep old blockUser(friendshipId, userId) for backward compatibility

3. Update controller to add new endpoints:
   - POST /api/social/block (body: { userId })
   - DELETE /api/social/block/:userId
   - GET /api/social/blocked (updated to use new repository)

**Acceptance Criteria**:
- New block methods use BlockRepository
- Old friendship-based blocking still works
- Bidirectional block checking
- Friend requests blocked if either user blocked the other

**Dependencies**: Task 1.3

---

### Task 1.5: Add Friend Request Validation
**Effort**: 2 hours

**Files to Modify**:
- src/application/services/SocialService.ts

**Changes**:
Update sendFriendRequest to:
1. Check if either user has blocked the other
2. Allow requests to ANY user (not just event participants)
3. Keep event context as optional

**Acceptance Criteria**:
- Cannot send request if blocked
- Can send request to any valid user
- Event context still recorded if provided

**Dependencies**: Task 1.4

---

## Phase 2: Posts System (Week 2)

### Task 2.1: Create Post Models
**Effort**: 4 hours

**Files to Create**:
- src/infrastructure/database/models/Post.model.ts
- src/infrastructure/database/models/PostComment.model.ts
- src/infrastructure/database/models/PostLike.model.ts

**Acceptance Criteria**:
- All models with correct schemas
- Proper indexes for performance
- Validation rules
- Exported from index.ts

**Dependencies**: Task 1.1

---

### Task 2.2: Create Post Repository
**Effort**: 6 hours

**Files to Create**:
- src/infrastructure/database/repositories/PostRepository.ts

**Methods to Implement**:
- createPost, updatePost, deletePost
- findById, findByAuthor, findByHashtag
- incrementEngagement, decrementEngagement
- findForFeed (with filters)

**Dependencies**: Task 2.1

---

### Task 2.3: Create PostService
**Effort**: 8 hours

**Files to Create**:
- src/application/services/PostService.ts

**Methods to Implement**:
- createPost (with mention/hashtag parsing)
- updatePost (with permission check)
- deletePost (with cascade)
- getPost (with privacy check)
- getUserPosts (with privacy filtering)

**Dependencies**: Task 2.2

---

### Task 2.4: Create Post API
**Effort**: 6 hours

**Files to Create**:
- src/api/controllers/post.controller.ts
- src/api/routes/post.routes.ts
- src/api/validators/post.validator.ts

**Endpoints**:
- POST /api/posts
- GET /api/posts/:postId
- PUT /api/posts/:postId
- DELETE /api/posts/:postId
- GET /api/posts/user/:userId

**Dependencies**: Task 2.3

---

## Phase 3: Engagement Features (Week 3)

### Task 3.1: Implement Likes
**Effort**: 4 hours

**Files to Modify**:
- src/application/services/PostService.ts
- src/api/controllers/post.controller.ts
- src/api/routes/post.routes.ts

**Methods**: likePost, unlikePost, getPostLikes

**Endpoints**:
- POST /api/posts/:postId/like
- DELETE /api/posts/:postId/like
- GET /api/posts/:postId/likes

**Dependencies**: Task 2.4

---

### Task 3.2: Implement Comments
**Effort**: 6 hours

**Methods**: createComment, deleteComment, getPostComments

**Endpoints**:
- POST /api/posts/:postId/comments
- DELETE /api/comments/:commentId
- GET /api/posts/:postId/comments

**Dependencies**: Task 3.1

---

### Task 3.3: Implement Shares
**Effort**: 4 hours

**Methods**: sharePost

**Endpoints**:
- POST /api/posts/:postId/share

**Dependencies**: Task 3.2

---

### Task 3.4: Add Engagement Notifications
**Effort**: 4 hours

**Files to Modify**:
- src/application/services/PostService.ts

**Notifications for**:
- Post likes
- Post comments
- Mentions
- Shares

**Dependencies**: Task 3.3

---

## Phase 4: Mentions & Hashtags (Week 3-4)

### Task 4.1: Implement Mention Parsing
**Effort**: 4 hours

**Create utility**: src/shared/utils/mentionParser.ts

**Features**:
- Parse @username patterns
- Validate mentioned users exist
- Extract user IDs

**Dependencies**: Task 2.3

---

### Task 4.2: Implement Hashtag Parsing
**Effort**: 3 hours

**Create utility**: src/shared/utils/hashtagParser.ts

**Features**:
- Parse #hashtag patterns
- Normalize to lowercase
- Extract hashtags

**Dependencies**: Task 4.1

---

### Task 4.3: Add Hashtag Search
**Effort**: 3 hours

**Endpoint**: GET /api/posts/hashtag/:hashtag

**Dependencies**: Task 4.2

---

## Phase 5: Feed System (Week 4-5)

### Task 5.1: Create FeedService
**Effort**: 10 hours

**Files to Create**:
- src/application/services/FeedService.ts

**Methods**:
- getHomeFeed (friends' posts)
- getDiscoverFeed (city posts)
- getEventFeed (event participants)
- calculateRelevanceScore
- applyPrivacyFilters
- applyBlockFilters

**Dependencies**: Task 3.4

---

### Task 5.2: Implement Feed Ranking Algorithm
**Effort**: 6 hours

**Formula**: recency * 0.4 + engagement * 0.3 + relationship * 0.3

**Dependencies**: Task 5.1

---

### Task 5.3: Add Feed Caching
**Effort**: 4 hours

**Redis keys**:
- feed:home:{userId}:{cursor}
- feed:discover:{userId}:{cursor}
- feed:events:{userId}:{cursor}

**TTL**: 5 minutes

**Dependencies**: Task 5.2

---

### Task 5.4: Implement Cache Invalidation
**Effort**: 4 hours

**Invalidate on**:
- Post creation
- Post update
- Post deletion
- Friendship changes

**Dependencies**: Task 5.3

---

### Task 5.5: Create Feed API
**Effort**: 4 hours

**Files to Create**:
- src/api/controllers/feed.controller.ts
- src/api/routes/feed.routes.ts

**Endpoints**:
- GET /api/feed/home
- GET /api/feed/discover
- GET /api/feed/events

**Dependencies**: Task 5.4

---

## Phase 6: Friend Suggestions (Week 5-6)

### Task 6.1: Create RecommendationService
**Effort**: 8 hours

**Files to Create**:
- src/application/services/RecommendationService.ts

**Methods**:
- getFriendSuggestions
- calculateMutualFriends
- calculateSharedEvents
- calculateProximity
- calculateSuggestionScore

**Dependencies**: Task 5.5

---

### Task 6.2: Add Suggestion Caching
**Effort**: 3 hours

**Redis key**: suggestions:{userId}
**TTL**: 1 hour

**Dependencies**: Task 6.1

---

### Task 6.3: Create Suggestions API
**Effort**: 3 hours

**Endpoint**: GET /api/social/suggestions

**Dependencies**: Task 6.2

---

## Phase 7: Privacy & Permissions (Week 6)

### Task 7.1: Implement Privacy Filtering
**Effort**: 6 hours

**Apply to**:
- Feed generation
- Post retrieval
- User profile views

**Dependencies**: Task 6.3

---

### Task 7.2: Add Block Checks
**Effort**: 4 hours

**Check blocks in**:
- Friend requests
- Post engagement
- Comments
- Feed generation

**Dependencies**: Task 7.1

---

## Phase 8: Testing & Documentation (Week 7)

### Task 8.1: Write Unit Tests
**Effort**: 12 hours

**Coverage**: 80% minimum

**Dependencies**: Task 7.2

---

### Task 8.2: Write Property-Based Tests
**Effort**: 16 hours

**Test all 77 properties** from design.md

**Dependencies**: Task 8.1

---

### Task 8.3: Update Documentation
**Effort**: 6 hours

**Update**:
- API documentation
- Postman collection
- README

**Dependencies**: Task 8.2

---

### Task 8.4: Performance Testing
**Effort**: 4 hours

**Test**:
- Feed generation speed
- Cache hit rates
- Database query performance

**Dependencies**: Task 8.3

---

## Summary

**Total Tasks**: 40
**Total Effort**: ~7 weeks (1 developer)

**Critical Path**:
Phase 1  Phase 2  Phase 3  Phase 5  Phase 7  Phase 8

**Can be Parallelized**:
- Phase 4 (Mentions/Hashtags) with Phase 3
- Phase 6 (Suggestions) with Phase 5

