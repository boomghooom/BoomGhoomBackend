# User Profile Relationship Status Feature

## Overview
User profile API ab relationship status return karta hai, just like event participants API.

## API Endpoint
```
GET /api/users/:id
Authorization: Bearer <token> (required)
```

## Response Structure

```json
{
  "_id": "69547717fc6d8a1d8d0b9d09",
  "fullName": "Abhilekh Singh",
  "displayName": "abhilekh_s",
  "avatarUrl": "https://...",
  "gender": "male",
  "bio": "Hello world!",
  "location": {
    "type": "Point",
    "coordinates": [72.8777, 19.076],
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India"
  },
  "kyc": {
    "status": "approved"
  },
  "stats": {
    "eventsJoined": 10,
    "eventsCreated": 5,
    "friendsCount": 25,
    "averageRating": 4.5
  },
  "isOnline": true,
  "lastActiveAt": "2024-01-28T12:00:00Z",
  "createdAt": "2024-01-01T00:00:00Z",
  "relationshipStatus": "none"
}
```

## Relationship Status Values

| Value | Description | Frontend Action |
|-------|-------------|-----------------|
| `'self'` | Viewing own profile | Show "Edit Profile" button |
| `'friend'` | Already friends | Show "Friends ✓" badge, "Message" button |
| `'blocked'` | User is blocked | Hide friend request button |
| `'request_sent'` | Friend request sent | Show "Request Sent" (disabled) |
| `'request_received'` | Friend request received | Show "Accept Request" (clickable) |
| `'none'` | No relationship | Show "Send Friend Request" (clickable) |

## Frontend Implementation

### React/React Native Example

```tsx
function UserProfileScreen({ userId }) {
  const { data: profile } = useQuery(['user', userId], () => 
    api.get(`/users/${userId}`)
  );

  const renderActionButton = () => {
    switch (profile.relationshipStatus) {
      case 'self':
        return <Button onPress={handleEditProfile}>Edit Profile</Button>;
      
      case 'friend':
        return (
          <View>
            <Badge>Friends ✓</Badge>
            <Button onPress={handleMessage}>Message</Button>
          </View>
        );
      
      case 'blocked':
        return <Text>User Blocked</Text>;
      
      case 'request_sent':
        return <Button disabled>Request Sent</Button>;
      
      case 'request_received':
        return (
          <View>
            <Button onPress={handleAccept}>Accept Request</Button>
            <Button onPress={handleReject}>Reject</Button>
          </View>
        );
      
      case 'none':
        return <Button onPress={handleSendRequest}>Send Friend Request</Button>;
      
      default:
        return null;
    }
  };

  return (
    <View>
      <Avatar source={{ uri: profile.avatarUrl }} />
      <Text>{profile.fullName}</Text>
      <Text>{profile.bio}</Text>
      {renderActionButton()}
    </View>
  );
}
```

### Simple Helper Functions

```typescript
function getProfileActionButton(status: string) {
  const actions = {
    'self': { text: 'Edit Profile', action: 'edit', disabled: false },
    'friend': { text: 'Friends ✓', action: 'message', disabled: false },
    'blocked': { text: 'Blocked', action: null, disabled: true },
    'request_sent': { text: 'Request Sent', action: null, disabled: true },
    'request_received': { text: 'Accept Request', action: 'accept', disabled: false },
    'none': { text: 'Send Friend Request', action: 'send', disabled: false },
  };
  
  return actions[status] || { text: '', action: null, disabled: true };
}
```

## Use Cases

### 1. Viewing Own Profile
```json
{ "relationshipStatus": "self" }
```
**Action:** Show "Edit Profile" button

### 2. Viewing Friend's Profile
```json
{ "relationshipStatus": "friend" }
```
**Action:** Show "Friends ✓" badge and "Message" button

### 3. Viewing Blocked User
```json
{ "relationshipStatus": "blocked" }
```
**Action:** Show "Blocked" status, hide action buttons

### 4. Request Already Sent
```json
{ "relationshipStatus": "request_sent" }
```
**Action:** Show "Request Sent" (disabled)

### 5. Request Received
```json
{ "relationshipStatus": "request_received" }
```
**Action:** Show "Accept Request" and "Reject" buttons

### 6. No Relationship
```json
{ "relationshipStatus": "none" }
```
**Action:** Show "Send Friend Request" button

## API Call Examples

### Get User Profile
```bash
curl -X GET "http://localhost:3000/api/users/69547717fc6d8a1d8d0b9d09" \
  -H "Authorization: Bearer your_token_here"
```

### Response
```json
{
  "_id": "69547717fc6d8a1d8d0b9d09",
  "fullName": "Abhilekh Singh",
  "relationshipStatus": "none"
}
```

## Integration with Other Features

### Combined with Event Participants
```typescript
// Event participant clicked
function handleParticipantClick(participant) {
  // Navigate to user profile
  navigation.navigate('UserProfile', { 
    userId: participant.userId._id 
  });
  
  // User profile API will return relationshipStatus
  // Same UI logic applies
}
```

### Search Results
```typescript
// After searching users
function UserSearchResult({ user }) {
  // Fetch full profile to get relationship status
  const { data: profile } = useQuery(['user', user._id], () =>
    api.get(`/users/${user._id}`)
  );
  
  return (
    <View>
      <Text>{user.fullName}</Text>
      {profile?.relationshipStatus && (
        <ActionButton status={profile.relationshipStatus} />
      )}
    </View>
  );
}
```

## Backend Implementation

### Files Modified
1. **src/domain/entities/User.ts**
   - Added `RelationshipStatus` type
   - Updated `IUserSummary` interface

2. **src/application/services/UserService.ts**
   - Updated `getPublicProfile()` to accept optional `requestingUserId`
   - Added relationship status calculation

3. **src/api/controllers/user.controller.ts**
   - Updated `getProfile()` to pass `req.userId` to service

### Logic Flow
1. User requests profile: `GET /api/users/:id`
2. Controller passes `req.userId` to service
3. Service checks:
   - If viewing own profile → `'self'`
   - If blocked → `'blocked'`
   - If friends → `'friend'`
   - If pending request → `'request_sent'` or `'request_received'`
   - Default → `'none'`
4. Returns profile with `relationshipStatus`

## Testing

### Test Cases
- [x] View own profile → `'self'`
- [x] View friend's profile → `'friend'`
- [x] View blocked user → `'blocked'`
- [x] View user with sent request → `'request_sent'`
- [x] View user with received request → `'request_received'`
- [x] View user with no relationship → `'none'`

## Benefits

✅ **Consistent:** Same format as event participants API
✅ **Simple:** Single string value, easy to use
✅ **Complete:** Covers all relationship states
✅ **Real-time:** Fresh status on each request
✅ **Type-safe:** TypeScript union type

## Notes
- Requires authentication (uses `authenticate` middleware)
- Relationship status calculated on each request (not cached)
- Bidirectional block check (either user blocking shows as `'blocked'`)
- Priority: self > blocked > friend > pending > none
