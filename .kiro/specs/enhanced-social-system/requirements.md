# Requirements Document: Enhanced Social System

## Introduction

The Enhanced Social System extends BoomGhoom's existing social features to create a comprehensive Facebook-like social platform. This system introduces posts and feeds, improves the friend system to work independently of events, fixes the block system to allow blocking any user, and adds intelligent friend suggestions. The system must integrate seamlessly with existing event and chat systems while maintaining clean architecture and scalability.

## Glossary

- **Post**: A content item created by a user containing text, media (images/videos), or event shares
- **Feed**: A chronologically ordered collection of posts personalized for a user
- **Home_Feed**: Feed showing posts from friends and followed users
- **Discover_Feed**: Feed showing popular posts from users in the same city
- **Event_Feed**: Feed showing posts from event participants
- **Engagement**: User interactions with posts (likes, comments, shares)
- **Comment**: A text response to a post, which can have nested replies
- **Share**: Reposting another user's post to one's own feed
- **Mention**: Tagging another user in a post or comment using @username
- **Hashtag**: A topic tag in a post using #topic format
- **Privacy_Level**: Visibility setting for posts (public, friends_only, private)
- **Friend_Suggestion**: A recommended user to connect with based on various factors
- **Block_Relationship**: A one-way restriction preventing interaction between users
- **Post_Service**: Service handling post creation, updates, and retrieval
- **Feed_Service**: Service handling feed generation and ranking
- **Recommendation_Service**: Service generating friend suggestions
- **Social_Service**: Service handling friendships and blocking

## Requirements

### Requirement 1: Post Creation and Management

**User Story:** As a user, I want to create and manage posts with various content types, so that I can share my experiences and thoughts with others.

#### Acceptance Criteria

1. WHEN a user creates a post with valid text content, THE Post_Service SHALL create a new post and return the post object
2. WHEN a user creates a post with media files (images or videos), THE Post_Service SHALL upload files to S3 and store URLs in the post
3. WHEN a user creates a post with an event share, THE Post_Service SHALL validate the event exists and link it to the post
4. WHEN a user sets a privacy level on a post, THE Post_Service SHALL store the privacy setting (public, friends_only, or private)
5. WHEN a user updates their own post, THE Post_Service SHALL modify the post content and update the timestamp
6. WHEN a user deletes their own post, THE Post_Service SHALL remove the post and all associated engagement data
7. WHEN a user attempts to update or delete another user's post, THE Post_Service SHALL reject the request with an authorization error
8. WHEN a post is created, THE Post_Service SHALL validate that text content does not exceed 5000 characters
9. WHEN a post with media is created, THE Post_Service SHALL validate that media files are in supported formats (JPEG, PNG, GIF, MP4, MOV)
10. WHEN a post with media is created, THE Post_Service SHALL validate that total media size does not exceed 50MB

### Requirement 2: Post Engagement

**User Story:** As a user, I want to engage with posts through likes, comments, and shares, so that I can interact with content from others.

#### Acceptance Criteria

1. WHEN a user likes a post, THE Post_Service SHALL record the like and increment the post's like count
2. WHEN a user unlikes a post they previously liked, THE Post_Service SHALL remove the like and decrement the post's like count
3. WHEN a user attempts to like a post multiple times, THE Post_Service SHALL treat it as idempotent (no duplicate likes)
4. WHEN a user comments on a post, THE Post_Service SHALL create a comment and increment the post's comment count
5. WHEN a user replies to a comment, THE Post_Service SHALL create a nested comment linked to the parent comment
6. WHEN a user deletes their own comment, THE Post_Service SHALL remove the comment and decrement the post's comment count
7. WHEN a user shares a post, THE Post_Service SHALL create a new post referencing the original post
8. WHEN a user shares a post, THE Post_Service SHALL increment the original post's share count
9. WHEN a comment is created, THE Post_Service SHALL validate that comment text does not exceed 1000 characters
10. IF a post is deleted, THEN THE Post_Service SHALL cascade delete all associated likes, comments, and shares

### Requirement 3: Mentions and Hashtags

**User Story:** As a user, I want to mention other users and use hashtags in posts, so that I can tag relevant people and topics.

#### Acceptance Criteria

1. WHEN a post contains @username mentions, THE Post_Service SHALL parse and extract all mentioned usernames
2. WHEN a post contains valid mentions, THE Post_Service SHALL validate that mentioned users exist
3. WHEN a post with mentions is created, THE Post_Service SHALL create notifications for all mentioned users
4. WHEN a post contains #hashtag tags, THE Post_Service SHALL parse and extract all hashtags
5. WHEN a post with hashtags is created, THE Post_Service SHALL store hashtags in lowercase for consistent searching
6. WHEN a user searches for a hashtag, THE Post_Service SHALL return all posts containing that hashtag
7. IF a mentioned user has blocked the post author, THEN THE Post_Service SHALL not create a notification for that user

### Requirement 4: Feed Generation and Ranking

**User Story:** As a user, I want to see personalized feeds of relevant posts, so that I can discover content that interests me.

#### Acceptance Criteria

1. WHEN a user requests their home feed, THE Feed_Service SHALL return posts from friends ordered by relevance score
2. WHEN calculating relevance score, THE Feed_Service SHALL consider post recency, engagement count, and author relationship
3. WHEN a user requests the discover feed, THE Feed_Service SHALL return popular posts from users in the same city
4. WHEN a user requests the event feed, THE Feed_Service SHALL return posts from participants of events the user has joined
5. WHEN generating any feed, THE Feed_Service SHALL exclude posts from blocked users
6. WHEN generating any feed, THE Feed_Service SHALL respect post privacy settings (only show posts user has permission to see)
7. WHEN a user requests feed pagination, THE Feed_Service SHALL return posts in batches of 20 with cursor-based pagination
8. WHEN a post is created, THE Feed_Service SHALL invalidate cached feeds for relevant users
9. WHEN calculating discover feed ranking, THE Feed_Service SHALL prioritize posts with high engagement from the last 7 days
10. WHEN generating home feed, THE Feed_Service SHALL include posts from the last 30 days maximum

### Requirement 5: Enhanced Friend System

**User Story:** As a user, I want to send friend requests to any user and receive intelligent friend suggestions, so that I can build my social network.

#### Acceptance Criteria

1. WHEN a user sends a friend request to any valid user ID, THE Social_Service SHALL create a pending friendship record
2. WHEN a user sends a friend request to a user who has blocked them, THE Social_Service SHALL reject the request
3. WHEN a user accepts a friend request, THE Social_Service SHALL update the friendship status to accepted
4. WHEN a user rejects a friend request, THE Social_Service SHALL remove the friendship record
5. WHEN a user requests friend suggestions, THE Recommendation_Service SHALL return users based on mutual friends
6. WHEN calculating friend suggestions, THE Recommendation_Service SHALL consider users from same events
7. WHEN calculating friend suggestions, THE Recommendation_Service SHALL consider users within 50km proximity
8. WHEN calculating friend suggestions, THE Recommendation_Service SHALL exclude already-friends and blocked users
9. WHEN a user searches for users, THE Social_Service SHALL return matching users by name or location
10. WHEN generating friend suggestions, THE Recommendation_Service SHALL rank suggestions by relevance score (mutual friends count, shared events, proximity)

### Requirement 6: Improved Block System

**User Story:** As a user, I want to block any user directly by their user ID, so that I can prevent unwanted interactions.

#### Acceptance Criteria

1. WHEN a user blocks another user by user ID, THE Social_Service SHALL create a block relationship
2. WHEN a user blocks another user, THE Social_Service SHALL remove any existing friendship between them
3. WHEN a blocked user attempts to send a friend request to the blocker, THE Social_Service SHALL reject the request
4. WHEN a blocked user attempts to view the blocker's posts, THE Feed_Service SHALL exclude those posts from results
5. WHEN a blocker views feeds, THE Feed_Service SHALL exclude posts from blocked users
6. WHEN a user unblocks another user, THE Social_Service SHALL remove the block relationship
7. WHEN a user requests their blocked users list, THE Social_Service SHALL return all users they have blocked
8. WHEN a blocked user attempts to comment on the blocker's post, THE Post_Service SHALL reject the comment
9. WHEN a blocked user attempts to like the blocker's post, THE Post_Service SHALL reject the like
10. WHEN checking block status, THE Social_Service SHALL verify blocks in both directions (A blocks B or B blocks A)

### Requirement 7: Privacy and Permissions

**User Story:** As a user, I want my posts to respect privacy settings, so that I can control who sees my content.

#### Acceptance Criteria

1. WHEN a post has privacy level "public", THE Feed_Service SHALL show it to all users in relevant feeds
2. WHEN a post has privacy level "friends_only", THE Feed_Service SHALL show it only to the author's friends
3. WHEN a post has privacy level "private", THE Feed_Service SHALL show it only to the author
4. WHEN a non-friend views a user's profile, THE Feed_Service SHALL show only public posts
5. WHEN a friend views a user's profile, THE Feed_Service SHALL show public and friends_only posts
6. WHEN a user views their own profile, THE Feed_Service SHALL show all posts regardless of privacy level
7. WHEN a post is shared, THE Feed_Service SHALL respect the original post's privacy settings
8. IF a user loses friend status with the post author, THEN THE Feed_Service SHALL stop showing friends_only posts from that author

### Requirement 8: Notifications and Real-time Updates

**User Story:** As a user, I want to receive notifications for social interactions, so that I stay informed about engagement with my content.

#### Acceptance Criteria

1. WHEN a user's post receives a like, THE Post_Service SHALL create a notification for the post author
2. WHEN a user's post receives a comment, THE Post_Service SHALL create a notification for the post author
3. WHEN a user is mentioned in a post, THE Post_Service SHALL create a notification for the mentioned user
4. WHEN a user receives a friend request, THE Social_Service SHALL create a notification for the recipient
5. WHEN a friend request is accepted, THE Social_Service SHALL create a notification for the requester
6. WHEN a notification is created, THE Post_Service SHALL emit a real-time event via Socket.IO
7. WHEN a post receives engagement, THE Post_Service SHALL emit a real-time update to connected clients
8. WHEN aggregating notifications, THE Post_Service SHALL group similar notifications (e.g., "John and 5 others liked your post")

### Requirement 9: Performance and Caching

**User Story:** As a system administrator, I want the social system to perform efficiently at scale, so that users have a fast experience.

#### Acceptance Criteria

1. WHEN a user requests their home feed, THE Feed_Service SHALL check Redis cache before querying the database
2. WHEN a feed is generated, THE Feed_Service SHALL cache the result in Redis with 5-minute TTL
3. WHEN a post is created or updated, THE Feed_Service SHALL invalidate relevant cached feeds
4. WHEN querying posts, THE Post_Service SHALL use database indexes on authorId, createdAt, and privacy fields
5. WHEN querying friendships, THE Social_Service SHALL use database indexes on user1Id, user2Id, and status fields
6. WHEN calculating friend suggestions, THE Recommendation_Service SHALL cache results in Redis with 1-hour TTL
7. WHEN a user blocks another user, THE Social_Service SHALL invalidate cached friend suggestions
8. WHEN retrieving post engagement counts, THE Post_Service SHALL use cached aggregated counts rather than counting documents

### Requirement 10: Data Integrity and Validation

**User Story:** As a system administrator, I want the social system to maintain data integrity, so that the system remains consistent and reliable.

#### Acceptance Criteria

1. WHEN a post references an event, THE Post_Service SHALL validate that the event exists in the database
2. WHEN a user is mentioned, THE Post_Service SHALL validate that the user exists in the database
3. WHEN a comment references a parent comment, THE Post_Service SHALL validate that the parent comment exists
4. WHEN a share references an original post, THE Post_Service SHALL validate that the original post exists and is not deleted
5. IF a user account is deleted, THEN THE Post_Service SHALL mark all their posts as deleted or remove them
6. IF an event is deleted, THEN THE Post_Service SHALL remove event references from posts but keep the posts
7. WHEN creating a friendship, THE Social_Service SHALL prevent duplicate friendship records
8. WHEN creating a block relationship, THE Social_Service SHALL prevent duplicate block records
9. WHEN a post is created, THE Post_Service SHALL validate that the author user ID exists
10. WHEN engagement is recorded, THE Post_Service SHALL use atomic operations to prevent race conditions on counters
