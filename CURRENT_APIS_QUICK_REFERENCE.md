# BoomGhoom API - Quick Reference Guide

## 🔐 Authentication APIs
```bash
POST   /api/auth/register              # Register new user
POST   /api/auth/login                 # Login with phone/email
POST   /api/auth/verify-otp            # Verify OTP
POST   /api/auth/refresh-token         # Refresh access token
POST   /api/auth/logout                # Logout user
```

## 👤 User APIs
```bash
GET    /api/users/me                   # Get current user profile
PATCH  /api/users/me                   # Update profile
GET    /api/users/:id                  # Get user by ID
GET    /api/users/search               # Search users
POST   /api/users/kyc                  # Submit KYC
```

## 🎉 Event APIs
```bash
# Event Management
POST   /api/events                     # Create event
POST   /api/events/create-with-publish # Create & publish event
POST   /api/events/:id/publish         # Publish draft event
GET    /api/events                     # List events (with filters)
GET    /api/events/:id                 # Get event details
PATCH  /api/events/:id                 # Update event
POST   /api/events/:id/cancel          # Cancel event
POST   /api/events/:id/complete        # Complete event

# Event Participation
POST   /api/events/:id/join            # Request to join event
POST   /api/events/:id/approve/:userId # Approve join request
POST   /api/events/:id/reject/:userId  # Reject join request
POST   /api/events/:id/leave           # Request to leave event
POST   /api/events/:id/approve-leave/:userId  # Approve leave request
POST   /api/events/:id/reject-leave/:userId   # Reject leave request
POST   /api/events/:id/kickout/:userId # Kickout participant (NEW)

# Event Discovery
GET    /api/events/upcoming            # Get upcoming events
GET    /api/events/featured            # Get featured events
GET    /api/events/me/joined           # My joined events
GET    /api/events/me/created          # My created events
GET    /api/events/me/previous-participants # Previous participants

# Event Invites
POST   /api/events/:id/bulk-invite     # Bulk invite users
POST   /api/events/:id/share           # Record event share
```

## 👥 Social APIs

### Friend Management
```bash
POST   /api/social/friends/request     # Send friend request
POST   /api/social/friends/:id/accept  # Accept friend request
POST   /api/social/friends/:id/reject  # Reject friend request
POST   /api/social/friends/:id/block   # Block user
DELETE /api/social/friends/:id         # Remove friend
GET    /api/social/friends             # Get friends list
GET    /api/social/friends/requests    # Get pending requests
```

### Blocked Users (NEW)
```bash
GET    /api/social/blocked-users       # Get blocked users list
GET    /api/social/block/check/:id     # Check if user is blocked
```

### Notifications
```bash
GET    /api/social/notifications       # Get notifications
GET    /api/social/notifications/unread-count # Get unread count
POST   /api/social/notifications/:id/read     # Mark as read
POST   /api/social/notifications/read-all     # Mark all as read
```

### Ratings & Reviews
```bash
POST   /api/social/ratings             # Rate a user
GET    /api/social/ratings/user/:id    # Get user ratings
```

### Reports
```bash
POST   /api/social/reports             # Report user/event/message
```

## 💬 Chat APIs
```bash
GET    /api/chat                       # Get user chats
GET    /api/chat/:id/messages          # Get chat messages
POST   /api/chat/:id/messages          # Send message
POST   /api/chat/:id/read              # Mark messages as read
POST   /api/chat/group                 # Create group chat
POST   /api/chat/:id/participants      # Add participants
DELETE /api/chat/:id/participants/:userId # Remove participant
```

## 💰 Finance APIs
```bash
GET    /api/finance/balance            # Get user balance
GET    /api/finance/transactions       # Get transactions
GET    /api/finance/commissions        # Get commissions
GET    /api/finance/withdrawals        # Get withdrawals
POST   /api/finance/withdraw           # Request withdrawal
POST   /api/finance/dues/clear         # Clear dues
```

## 📤 Upload APIs
```bash
POST   /api/upload/image               # Upload image to S3
POST   /api/upload/video               # Upload video to S3
POST   /api/upload/document            # Upload document to S3
```

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

## 🔑 Authentication

All protected routes require Bearer token:
```bash
Authorization: Bearer <access_token>
```

---

## 📝 Common Query Parameters

```bash
?page=1              # Page number (default: 1)
?limit=20            # Items per page (default: 20, max: 100)
?sort=createdAt      # Sort field
?order=desc          # Sort order (asc/desc)
?search=query        # Search query
?city=Mumbai         # Filter by city
?category=sports     # Filter by category
```

---

## 🎯 Event Filters

```bash
?type=user_created|sponsored
?status=draft|upcoming|ongoing|completed|cancelled
?category=sports|music|food|travel|...
?genderAllowed=male|female|other
?priceRange[min]=0&priceRange[max]=1000
?dateRange[from]=2024-01-01&dateRange[to]=2024-12-31
?latitude=19.076&longitude=72.8777&maxDistance=10000
```

---

## 🚀 Quick Start Examples

### 1. Register & Login
```bash
# Register
POST /api/auth/register
{
  "phoneNumber": "+919876543210",
  "fullName": "John Doe",
  "gender": "male",
  "dateOfBirth": "1995-01-01"
}

# Verify OTP
POST /api/auth/verify-otp
{
  "phoneNumber": "+919876543210",
  "otp": "123456"
}
```

### 2. Create Event
```bash
POST /api/events/create-with-publish
{
  "title": "Weekend Football Match",
  "category": "sports",
  "type": "user_created",
  "startTime": "2024-02-01T10:00:00Z",
  "endTime": "2024-02-01T12:00:00Z",
  "location": {
    "venueName": "Juhu Beach",
    "address": "Juhu Beach, Mumbai",
    "city": "Mumbai",
    "latitude": 19.0990,
    "longitude": 72.8258
  },
  "eligibility": {
    "memberLimit": 20,
    "minAge": 18,
    "maxAge": 40,
    "genderAllowed": ["male", "female"]
  },
  "pricing": {
    "isFree": false
  }
}
```

### 3. Join Event
```bash
POST /api/events/:eventId/join
```

### 4. Send Friend Request
```bash
POST /api/social/friends/request
{
  "toUserId": "507f191e810c19729de860ea",
  "eventId": "507f1f77bcf86cd799439011",
  "message": "Hey! Let's connect"
}
```

### 5. Get Feed (Coming Soon)
```bash
GET /api/feed?page=1&limit=20&type=home
```

---

## 📱 Postman Collection

Import the Postman collection from:
```
postman/BoomGhoom_API.postman_collection.json
```

Environment variables:
```
{{baseUrl}} = http://localhost:3000
{{accessToken}} = <your_access_token>
```

---

## 🔗 Related Documentation

- [Social System Architecture](./SOCIAL_SYSTEM_ARCHITECTURE.md)
- [Blocked Users API](./BLOCKED_USERS_API_DOCUMENTATION.md)
- [Kickout API](./KICKOUT_API_QUICK_REFERENCE.md)
- [API Integration Guide](./API_INTEGRATION_GUIDE.md)

---

**Last Updated**: January 2024
**API Version**: 1.0.0
