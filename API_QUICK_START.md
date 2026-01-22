# 🚀 BoomGhoom Enhanced API - Quick Start Guide

## Postman Collection Import

### Step 1: Import Collection
1. Open Postman
2. Click **"Import"** button (top left)
3. Select file: `postman/BoomGhoom_Enhanced_API.postman_collection.json`
4. Click **"Import"**

### Step 2: Set Variables
Click on collection → Variables tab:
```
baseUrl: http://localhost:3000/api/v1
accessToken: YOUR_TOKEN_HERE
```

### Step 3: Get Access Token
1. Go to **Authentication** folder
2. Run **"Register"** or **"Login"**
3. Copy `accessToken` from response
4. Paste in collection variables

---

## 🆕 New Features Quick Test

### 1. Block User (NEW)
```bash
POST {{baseUrl}}/social/block
Body: { "userId": "USER_ID_TO_BLOCK" }
```

### 2. Create Post (NEW)
```bash
POST {{baseUrl}}/posts
Body: {
  "content": "My first post! #awesome @friend",
  "privacy": "public"
}
```

### 3. Get Home Feed (NEW)
```bash
GET {{baseUrl}}/feed/home?page=1&limit=20
```

### 4. Get Friend Suggestions (NEW)
```bash
GET {{baseUrl}}/feed/suggestions?limit=20
```

### 5. Like Post (NEW)
```bash
POST {{baseUrl}}/posts/:postId/like
```

### 6. Comment on Post (NEW)
```bash
POST {{baseUrl}}/posts/:postId/comments
Body: { "content": "Great post!" }
```

### 7. Search by Hashtag (NEW)
```bash
GET {{baseUrl}}/posts/hashtag/awesome?page=1&limit=20
```

---

## 📋 Complete Endpoint List

### Block Management (NEW)
- `POST /api/social/block` - Block user
- `DELETE /api/social/block/:userId` - Unblock user
- `GET /api/social/blocked-users` - Get blocked list
- `GET /api/social/block/check/:userId` - Check if blocked

### Posts (NEW)
- `POST /api/posts` - Create post
- `GET /api/posts/:postId` - Get post
- `PUT /api/posts/:postId` - Update post
- `DELETE /api/posts/:postId` - Delete post
- `GET /api/posts/user/:userId` - Get user posts

### Engagement (NEW)
- `POST /api/posts/:postId/like` - Like post
- `DELETE /api/posts/:postId/like` - Unlike post
- `POST /api/posts/:postId/comments` - Comment
- `GET /api/posts/:postId/comments` - Get comments
- `DELETE /api/posts/comments/:commentId` - Delete comment
- `POST /api/posts/:postId/share` - Share post

### Search (NEW)
- `GET /api/posts/hashtag/:hashtag` - Search by hashtag

### Feed (NEW)
- `GET /api/feed/home` - Home feed
- `GET /api/feed/discover` - Discover feed
- `GET /api/feed/events` - Event feed
- `GET /api/feed/suggestions` - Friend suggestions

### Friends (UPDATED)
- `POST /api/social/friends/request` - Send request (now to ANY user)
- `POST /api/social/friends/:id/accept` - Accept request
- `GET /api/social/friends` - Get friends list

---

## 🎯 Common Use Cases

### Use Case 1: Create & Share Post
```bash
# 1. Create post
POST /api/posts
{ "content": "Check out my event! #event", "privacy": "public" }

# 2. Get post ID from response
# 3. Share post
POST /api/posts/:postId/share
{ "content": "Amazing event!" }
```

### Use Case 2: Engage with Post
```bash
# 1. Like post
POST /api/posts/:postId/like

# 2. Comment
POST /api/posts/:postId/comments
{ "content": "Great post!" }

# 3. Reply to comment
POST /api/posts/:postId/comments
{ "content": "Thanks!", "parentCommentId": "COMMENT_ID" }
```

### Use Case 3: Discover & Connect
```bash
# 1. Get friend suggestions
GET /api/feed/suggestions?limit=20

# 2. Send friend request
POST /api/social/friends/request
{ "toUserId": "USER_ID" }

# 3. View their posts
GET /api/posts/user/:userId
```

### Use Case 4: Block User
```bash
# 1. Block user
POST /api/social/block
{ "userId": "USER_ID" }

# 2. Verify block
GET /api/social/block/check/:userId

# 3. Unblock later
DELETE /api/social/block/:userId
```

---

## 🔑 Privacy Levels

### public
- Everyone can see
- Appears in discover feed
- Searchable by hashtag

### friends_only
- Only friends can see
- Appears in friends' home feed
- Not in discover feed

### private
- Only you can see
- Not in any feed
- Personal notes

---

## 📊 Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

---

## 🎨 Post Content Examples

### Text Post
```json
{
  "content": "Just had an amazing day! #blessed",
  "privacy": "public"
}
```

### Post with Image
```json
{
  "content": "Check out this view! #travel",
  "mediaUrls": ["https://s3.amazonaws.com/image.jpg"],
  "mediaTypes": ["image"],
  "privacy": "public"
}
```

### Post with Mentions
```json
{
  "content": "Great event with @john and @jane! #fun",
  "privacy": "friends_only"
}
```

### Event Post
```json
{
  "content": "Join us for the weekend match! #sports",
  "eventId": "EVENT_ID",
  "privacy": "public"
}
```

---

## 🔍 Search Examples

### Search by Hashtag
```bash
GET /api/posts/hashtag/travel?page=1&limit=20
```

### Get User Posts
```bash
GET /api/posts/user/:userId?page=1&limit=20
```

### Get Event Posts
```bash
# Use event feed
GET /api/feed/events?page=1&limit=20
```

---

## 💡 Pro Tips

1. **Always set accessToken** in collection variables
2. **Use pagination** for better performance
3. **Cache responses** on client side
4. **Handle errors** gracefully
5. **Test with different privacy levels**
6. **Use hashtags** for discoverability
7. **Mention users** to increase engagement

---

## 🐛 Troubleshooting

### 401 Unauthorized
- Check if accessToken is set
- Token might be expired, login again

### 403 Forbidden
- User might have blocked you
- Check privacy settings
- Verify permissions

### 404 Not Found
- Check if post/user exists
- Verify IDs are correct

### 400 Bad Request
- Check request body format
- Validate required fields
- Check content length limits

---

## 📞 Need Help?

- Check `FINAL_IMPLEMENTATION_SUMMARY.md` for complete details
- See `CHANGELOG_ENHANCED_SOCIAL.md` for all changes
- Review Postman collection for examples

---

**Happy Testing!** 🎉
