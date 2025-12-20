# BoomGhoom API - Postman Collection

This folder contains Postman collections and environment files for testing the BoomGhoom API.

## Files

1. **BoomGhoom_API.postman_collection.json** - Complete API collection with all endpoints
2. **BoomGhoom_Environment.postman_environment.json** - Environment variables for different environments

## How to Import

### Import Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select **BoomGhoom_API.postman_collection.json**
4. Click **Import**

### Import Environment

1. In Postman, click the **Environments** icon (left sidebar)
2. Click **Import**
3. Select **BoomGhoom_Environment.postman_environment.json**
4. Click **Import**
5. Select the environment from the dropdown (top right)

## Setup

### 1. Configure Base URL

- Select the **BoomGhoom Environment** from the dropdown
- Update `base_url` variable:
  - **Local**: `http://localhost:3000`
  - **Development**: `https://dev-api.boomghoom.com`
  - **Production**: `https://api.boomghoom.com`

### 2. Get Access Token

1. Use **Authentication > Login** or **Signup** endpoint
2. The access token will be automatically saved to `access_token` variable (via test script)
3. All subsequent requests will use this token automatically

### 3. Update Variables

After making requests, you can manually update:
- `user_id` - Your user ID
- `event_id` - Event ID for testing
- `chat_id` - Chat ID for testing

## Collection Structure

### Authentication
- Signup
- Login (auto-saves tokens)
- Google Auth
- Apple Auth
- Refresh Token
- Logout
- Change Password
- Update Phone

### Users
- Get My Profile
- Update Profile
- Update Location
- Update Avatar
- Update Bank Details
- Get Stats
- Get Finance Summary
- Search Users
- KYC endpoints

### Events
- List Events (with filters)
- Get Nearby Events
- Get Upcoming/Featured Events
- Get Event by ID/Deep Link
- Create Event
- Publish/Update/Cancel/Complete Event
- Join/Leave Event
- Approve/Reject Join Requests
- Bulk Invite
- Get My Events

### Finance
- Get Finance Summary
- Get Transactions
- Get Pending Dues
- Create Payment Order
- Clear Dues with Commission
- Get Commissions
- Get Withdrawals
- Request Withdrawal
- Payment Webhook

### Social
- Friend Requests (Send/Accept/Reject)
- Get Friends
- Block/Remove Friend
- Get Notifications
- Mark Notifications Read
- Rate User
- Get User Ratings
- Create Report

### Chat
- Get Chats
- Get/Create Direct Chat
- Get Event Chat
- Get Messages
- Send Message
- Mark as Read
- Delete Message
- Mute/Unmute Chat

## Testing Flow

### 1. Authentication Flow
```
Signup → Login → (Token saved automatically)
```

### 2. Complete User Setup
```
Update Profile → Update Location → Initiate KYC → Submit Selfie → Submit Document
```

### 3. Create and Manage Event
```
Create Event → Publish Event → Join Event → Approve Join Request → Complete Event
```

### 4. Finance Flow
```
Get Finance Summary → Get Pending Dues → Create Payment Order → Clear Dues
```

### 5. Social Flow
```
Send Friend Request → Accept Friend Request → Rate User → Get Notifications
```

## Notes

- All protected endpoints require `Authorization: Bearer {{access_token}}` header
- The Login endpoint automatically saves tokens via test script
- Replace placeholder values (like `user_id_here`, `event_id_here`) with actual IDs
- Use query parameters for filtering and pagination
- Check response status codes:
  - `200` - Success
  - `201` - Created
  - `400` - Bad Request
  - `401` - Unauthorized
  - `403` - Forbidden
  - `404` - Not Found
  - `422` - Validation Error
  - `500` - Server Error

## Troubleshooting

### Token Expired
- Use **Refresh Token** endpoint to get new tokens
- Or login again

### 401 Unauthorized
- Check if token is set in environment
- Verify token is not expired
- Ensure Authorization header is present

### 422 Validation Error
- Check request body format
- Verify all required fields are present
- Check data types match expected format

## Support

For API documentation, see:
- `README.md` in project root
- `ARCHITECTURE.md` for system design
- API source code in `src/api/` directory

