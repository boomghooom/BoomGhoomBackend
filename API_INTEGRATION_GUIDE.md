# BoomGhoom API Integration Guide

## Table of Contents
1. [Overview](#overview)
2. [Base Configuration](#base-configuration)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
5. [Request/Response Formats](#requestresponse-formats)
6. [Error Handling](#error-handling)
7. [Code Examples](#code-examples)
8. [Best Practices](#best-practices)
9. [Common Integration Patterns](#common-integration-patterns)

---

## Overview

This guide provides comprehensive documentation for integrating the BoomGhoom backend API into mobile applications (React Native, Flutter, iOS, Android).

### Base URLs

- **Development**: `http://localhost:3000/api/v1`
- **Staging**: `https://staging-api.boomghoom.com/api/v1`
- **Production**: `https://api.boomghoom.com/api/v1`

### API Version

Current version: **v1**

All endpoints are prefixed with `/api/v1`

---

## Base Configuration

### Headers

All API requests should include:

```http
Content-Type: application/json
Accept: application/json
```

For authenticated requests, include:

```http
Authorization: Bearer {access_token}
```

### Response Format

All responses follow this structure:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }
  }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## Authentication

### 1. Signup

**Endpoint:** `POST /auth/signup`

**Request:**
```json
{
  "phoneNumber": "9876543210",
  "fullName": "John Doe",
  "password": "password123",
  "email": "john@example.com",
  "referralCode": "ABC12345"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900
    }
  }
}
```

### 2. Login

**Endpoint:** `POST /auth/login`

**Request:**
```json
{
  "phoneNumber": "9876543210",
  "password": "password123"
}
```

**Response:** Same as signup

### 3. Google OAuth

**Endpoint:** `POST /auth/google`

**Request:**
```json
{
  "idToken": "google_id_token_from_client"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "tokens": { ... },
    "isNewUser": true
  }
}
```

### 4. Apple OAuth

**Endpoint:** `POST /auth/apple`

**Request:**
```json
{
  "identityToken": "apple_identity_token",
  "authorizationCode": "apple_auth_code",
  "fullName": {
    "givenName": "John",
    "familyName": "Doe"
  }
}
```

### 5. Refresh Token

**Endpoint:** `POST /auth/refresh`

**Request:**
```json
{
  "refreshToken": "your_refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token",
    "expiresIn": 900
  }
}
```

### 6. Logout

**Endpoint:** `POST /auth/logout`

**Headers:** `Authorization: Bearer {access_token}`

**Request:**
```json
{
  "refreshToken": "refresh_token_to_invalidate"
}
```

### Token Management

- **Access Token**: Valid for 15 minutes
- **Refresh Token**: Valid for 7 days
- Store tokens securely (Keychain/Keystore)
- Refresh token automatically before expiry
- Handle token refresh on 401 responses

---

## API Endpoints

### Users

#### Get My Profile
```
GET /users/me
Headers: Authorization: Bearer {token}
```

#### Update Profile
```
PATCH /users/me
Headers: Authorization: Bearer {token}
Body: {
  "fullName": "John Doe",
  "displayName": "Johnny",
  "bio": "Event enthusiast",
  "gender": "male",
  "dateOfBirth": "1990-01-01"
}
```

#### Update Location
```
PATCH /users/me/location
Headers: Authorization: Bearer {token}
Body: {
  "latitude": 19.0760,
  "longitude": 72.8777,
  "city": "Mumbai",
  "state": "Maharashtra",
  "country": "India"
}
```

#### Update Avatar
```
PATCH /users/me/avatar
Headers: Authorization: Bearer {token}
Body: {
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

#### Get Public Profile
```
GET /users/{userId}
Headers: Authorization: Bearer {token} (optional)
```

#### Search Users
```
GET /users/search?q=john
Headers: Authorization: Bearer {token}
```

#### KYC - Initiate
```
POST /users/me/kyc/initiate
Headers: Authorization: Bearer {token}
```

#### KYC - Submit Selfie
```
POST /users/me/kyc/selfie
Headers: Authorization: Bearer {token}
Body: {
  "selfieUrl": "https://example.com/selfie.jpg"
}
```

#### KYC - Submit Document
```
POST /users/me/kyc/document
Headers: Authorization: Bearer {token}
Body: {
  "documentUrl": "https://example.com/aadhaar.jpg",
  "documentType": "aadhaar" // aadhaar | pan | driving_license | passport
}
```

#### KYC - Get Status
```
GET /users/me/kyc/status
Headers: Authorization: Bearer {token}
```

### Events

#### List Events
```
GET /events?page=1&limit=20&city=Mumbai&category=sports&type=user_created
Query Parameters:
  - page: number (default: 1)
  - limit: number (default: 20, max: 100)
  - city: string
  - category: sports | music | food | travel | games | movies | art | tech | fitness | nightlife | outdoor | learning | networking | other
  - type: sponsored | user_created
  - status: draft | upcoming | ongoing | completed | cancelled
  - latitude: number (for nearby search)
  - longitude: number (for nearby search)
  - maxDistance: number (in km, for nearby search)
  - dateFrom: ISO date string
  - dateTo: ISO date string
  - isFree: boolean
  - sortBy: startTime | distance | createdAt | participantCount
  - sortOrder: asc | desc
```

#### Get Nearby Events
```
GET /events?latitude=19.0760&longitude=72.8777&maxDistance=10&page=1&limit=20
```

#### Get Upcoming Events
```
GET /events/upcoming?city=Mumbai&limit=10
```

#### Get Featured Events
```
GET /events/featured?city=Mumbai&limit=10
```

#### Get Event by ID
```
GET /events/{eventId}
```

#### Get Event by Deep Link
```
GET /events/link/{deepLinkId}
```

#### Create Event
```
POST /events
Headers: Authorization: Bearer {token}
Body: {
  "type": "user_created",
  "category": "sports",
  "title": "Weekend Football Match",
  "description": "Join us for an exciting football match...",
  "location": {
    "latitude": 19.0760,
    "longitude": 72.8777,
    "address": "123 Sports Complex, Bandra",
    "venueName": "Bandra Sports Complex",
    "city": "Mumbai",
    "state": "Maharashtra"
  },
  "startTime": "2024-12-25T10:00:00Z",
  "endTime": "2024-12-25T12:00:00Z",
  "imageUrls": ["https://example.com/event1.jpg"],
  "coverImageUrl": "https://example.com/cover.jpg",
  "eligibility": {
    "genderAllowed": ["male", "female"],
    "minAge": 18,
    "maxAge": 50,
    "maxDistance": 20,
    "memberLimit": 20,
    "requiresApproval": true
  },
  "pricing": {
    "isFree": true,
    "price": 0,
    "currency": "INR",
    "includesGST": true
  },
  "rules": ["No smoking", "Wear proper sports gear"]
}
```

**Note:** Requires KYC approval for `user_created` events

#### Publish Event
```
POST /events/{eventId}/publish
Headers: Authorization: Bearer {token}
```

#### Update Event
```
PATCH /events/{eventId}
Headers: Authorization: Bearer {token}
Body: {
  "title": "Updated Title",
  "description": "Updated description"
}
```

#### Cancel Event
```
POST /events/{eventId}/cancel
Headers: Authorization: Bearer {token}
Body: {
  "reason": "Due to bad weather conditions"
}
```

#### Complete Event
```
POST /events/{eventId}/complete
Headers: Authorization: Bearer {token}
```

#### Join Event
```
POST /events/{eventId}/join
Headers: Authorization: Bearer {token}
```

**Note:** 
- Requires no pending dues for user-created events
- May require admin approval

#### Approve Join Request
```
POST /events/{eventId}/approve/{userId}
Headers: Authorization: Bearer {token}
```

#### Reject Join Request
```
POST /events/{eventId}/reject/{userId}
Headers: Authorization: Bearer {token}
Body: {
  "reason": "Event is full"
}
```

#### Request to Leave
```
POST /events/{eventId}/leave
Headers: Authorization: Bearer {token}
```

**Note:** Must be within 60 minutes of joining

#### Approve Leave Request
```
POST /events/{eventId}/approve-leave/{userId}
Headers: Authorization: Bearer {token}
```

#### Get My Events
```
GET /events/me/joined?page=1&limit=20
Headers: Authorization: Bearer {token}
```

#### Get Created Events
```
GET /events/me/created?page=1&limit=20
Headers: Authorization: Bearer {token}
```

#### Get Previous Participants
```
GET /events/me/previous-participants
Headers: Authorization: Bearer {token}
```

#### Bulk Invite
```
POST /events/{eventId}/bulk-invite
Headers: Authorization: Bearer {token}
Body: {
  "recipientIds": ["user_id_1", "user_id_2"],
  "message": "Join my new event!"
}
```

#### Record Share
```
POST /events/{eventId}/share
Headers: Authorization: Bearer {token}
```

### Finance

#### Get Finance Summary
```
GET /finance/summary
Headers: Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dues": 2500,
    "pendingCommission": 50000,
    "availableCommission": 100000,
    "totalEarned": 150000,
    "totalWithdrawn": 50000,
    "canWithdraw": true,
    "minWithdrawalAmount": 100000
  }
}
```

**Note:** All amounts are in **paise** (divide by 100 for rupees)

#### Get Transactions
```
GET /finance/transactions?page=1&limit=20&type=due_cleared
Query Parameters:
  - page: number
  - limit: number
  - type: due_added | due_cleared | commission_earned | commission_available | withdrawal_requested | withdrawal_completed | withdrawal_failed | referral_reward
  - status: pending | completed | failed
  - eventId: string
  - dateFrom: ISO date string
  - dateTo: ISO date string
```

#### Get Pending Dues
```
GET /finance/dues
Headers: Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dues": [
      {
        "_id": "due_id",
        "eventId": "event_id",
        "eventTitle": "Event Name",
        "amount": 2500,
        "status": "pending",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "total": 2500
  }
}
```

#### Create Payment Order
```
POST /finance/dues/pay
Headers: Authorization: Bearer {token}
Body: {
  "purpose": "clear_dues",
  "amount": 2500,
  "dueIds": ["due_id_1", "due_id_2"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "order_id",
    "gatewayOrderId": "order_razorpay_123",
    "amount": 2950,
    "status": "created",
    "expiresAt": "2024-01-01T00:30:00Z"
  }
}
```

**Note:** Amount includes gateway fees and GST

#### Clear Dues with Commission
```
POST /finance/dues/clear-with-commission
Headers: Authorization: Bearer {token}
Body: {
  "dueIds": ["due_id_1", "due_id_2"]
}
```

#### Get Commissions
```
GET /finance/commissions?page=1&limit=20
Headers: Authorization: Bearer {token}
```

#### Get Withdrawals
```
GET /finance/withdrawals?page=1&limit=20
Headers: Authorization: Bearer {token}
```

#### Request Withdrawal
```
POST /finance/withdraw
Headers: Authorization: Bearer {token}
```

**Requirements:**
- Minimum ₹1000 available commission
- Bank details must be verified

### Social

#### Send Friend Request
```
POST /social/friends/request
Headers: Authorization: Bearer {token}
Body: {
  "toUserId": "user_id",
  "eventId": "event_id",
  "message": "Let's be friends!"
}
```

#### Accept Friend Request
```
POST /social/friends/{friendshipId}/accept
Headers: Authorization: Bearer {token}
```

#### Reject Friend Request
```
POST /social/friends/{friendshipId}/reject
Headers: Authorization: Bearer {token}
```

#### Get Friends
```
GET /social/friends?page=1&limit=20
Headers: Authorization: Bearer {token}
```

#### Get Pending Requests
```
GET /social/friends/requests?page=1&limit=20
Headers: Authorization: Bearer {token}
```

#### Block User
```
POST /social/friends/{friendshipId}/block
Headers: Authorization: Bearer {token}
```

#### Remove Friend
```
DELETE /social/friends/{friendshipId}
Headers: Authorization: Bearer {token}
```

#### Get Notifications
```
GET /social/notifications?page=1&limit=20
Headers: Authorization: Bearer {token}
```

#### Get Unread Count
```
GET /social/notifications/unread-count
Headers: Authorization: Bearer {token}
```

#### Mark Notification Read
```
POST /social/notifications/{notificationId}/read
Headers: Authorization: Bearer {token}
```

#### Mark All Notifications Read
```
POST /social/notifications/read-all
Headers: Authorization: Bearer {token}
```

#### Rate User
```
POST /social/ratings
Headers: Authorization: Bearer {token}
Body: {
  "toUserId": "user_id",
  "eventId": "event_id",
  "rating": 5,
  "review": "Great participant!",
  "isAnonymous": false
}
```

**Note:** Can only rate after event completion

#### Get User Ratings
```
GET /social/ratings/user/{userId}?page=1&limit=20
Headers: Authorization: Bearer {token}
```

#### Create Report
```
POST /social/reports
Headers: Authorization: Bearer {token}
Body: {
  "targetType": "event", // event | user | message
  "targetId": "target_id",
  "reason": "spam", // spam | inappropriate_content | harassment | fake_event | scam | other
  "description": "Additional details"
}
```

### Chat

#### Get Chats
```
GET /chats?page=1&limit=20
Headers: Authorization: Bearer {token}
```

#### Get or Create Direct Chat
```
POST /chats/direct
Headers: Authorization: Bearer {token}
Body: {
  "userId": "other_user_id"
}
```

**Note:** Users must be friends

#### Get Event Chat
```
GET /chats/event/{eventId}
Headers: Authorization: Bearer {token}
```

#### Get Chat by ID
```
GET /chats/{chatId}
Headers: Authorization: Bearer {token}
```

#### Get Messages
```
GET /chats/{chatId}/messages?page=1&limit=50
Headers: Authorization: Bearer {token}
```

#### Send Message
```
POST /chats/{chatId}/messages
Headers: Authorization: Bearer {token}
Body: {
  "type": "text", // text | image | event_share
  "content": "Hello! How are you?",
  "imageUrl": "https://example.com/image.jpg",
  "eventId": "event_id",
  "replyToMessageId": "message_id"
}
```

#### Mark Messages as Read
```
POST /chats/{chatId}/read
Headers: Authorization: Bearer {token}
```

#### Delete Message
```
DELETE /chats/{chatId}/messages/{messageId}
Headers: Authorization: Bearer {token}
```

#### Mute Chat
```
POST /chats/{chatId}/mute
Headers: Authorization: Bearer {token}
Body: {
  "duration": 3600 // seconds, optional
}
```

#### Unmute Chat
```
POST /chats/{chatId}/unmute
Headers: Authorization: Bearer {token}
```

---

## Request/Response Formats

### Date Format

All dates use **ISO 8601** format:
```
2024-12-25T10:00:00Z
```

### Amount Format

All monetary amounts are in **paise** (smallest currency unit):
- ₹25.00 = `2500` paise
- ₹1000.00 = `100000` paise

Convert for display:
```javascript
const rupees = paise / 100;
```

### Phone Number Format

Indian phone numbers (10 digits):
- Format: `9876543210`
- No country code prefix
- Must start with 6-9

### Pagination

All list endpoints support pagination:

```
GET /endpoint?page=1&limit=20
```

Response includes pagination metadata:
```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## Error Handling

### Error Codes

| Code | Description |
|------|-------------|
| `BAD_REQUEST` | Invalid request parameters |
| `UNAUTHORIZED` | Missing or invalid token |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Request validation failed |
| `CONFLICT` | Resource conflict (e.g., already exists) |
| `KYC_REQUIRED` | KYC verification required |
| `DUES_PENDING` | Pending dues must be cleared |
| `EVENT_FULL` | Event has reached member limit |
| `NOT_ELIGIBLE` | User doesn't meet event eligibility |
| `LEAVE_WINDOW_EXPIRED` | Leave request window expired |
| `INSUFFICIENT_BALANCE` | Insufficient commission balance |
| `WITHDRAWAL_LIMIT_NOT_MET` | Minimum withdrawal amount not met |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

### Error Response Example

```json
{
  "success": false,
  "error": {
    "code": "DUES_PENDING",
    "message": "Please clear your pending dues of ₹25.00 before joining",
    "details": {
      "pendingAmount": 2500
    }
  }
}
```

### Handling Errors

1. **401 Unauthorized**: Refresh token or redirect to login
2. **403 Forbidden**: Show appropriate message to user
3. **422 Validation Error**: Display field-specific errors
4. **429 Too Many Requests**: Implement exponential backoff
5. **500 Server Error**: Show generic error, log for debugging

---

## Code Examples

### React Native / JavaScript

#### API Client Setup

```javascript
// api/client.js
const BASE_URL = 'https://api.boomghoom.com/api/v1';

class ApiClient {
  constructor() {
    this.baseURL = BASE_URL;
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(data.error, response.status);
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError({ message: 'Network error' }, 0);
    }
  }

  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  async post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

class ApiError extends Error {
  constructor(error, statusCode) {
    super(error.message || 'An error occurred');
    this.code = error.code;
    this.statusCode = statusCode;
    this.details = error.details;
  }
}

export const apiClient = new ApiClient();
```

#### Authentication Example

```javascript
// api/auth.js
import { apiClient } from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const authAPI = {
  async signup(phoneNumber, fullName, password, email, referralCode) {
    const response = await apiClient.post('/auth/signup', {
      phoneNumber,
      fullName,
      password,
      email,
      referralCode,
    });

    if (response.success) {
      const { accessToken, refreshToken } = response.data.tokens;
      await AsyncStorage.setItem('access_token', accessToken);
      await AsyncStorage.setItem('refresh_token', refreshToken);
      apiClient.setToken(accessToken);
    }

    return response;
  },

  async login(phoneNumber, password) {
    const response = await apiClient.post('/auth/login', {
      phoneNumber,
      password,
    });

    if (response.success) {
      const { accessToken, refreshToken } = response.data.tokens;
      await AsyncStorage.setItem('access_token', accessToken);
      await AsyncStorage.setItem('refresh_token', refreshToken);
      apiClient.setToken(accessToken);
    }

    return response;
  },

  async refreshToken() {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    const response = await apiClient.post('/auth/refresh', { refreshToken });

    if (response.success) {
      const { accessToken, refreshToken: newRefreshToken } = response.data;
      await AsyncStorage.setItem('access_token', accessToken);
      await AsyncStorage.setItem('refresh_token', newRefreshToken);
      apiClient.setToken(accessToken);
    }

    return response;
  },

  async logout() {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    await apiClient.post('/auth/logout', { refreshToken });
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    apiClient.setToken(null);
  },
};
```

#### Event API Example

```javascript
// api/events.js
import { apiClient } from './client';

export const eventsAPI = {
  async list(filters = {}) {
    return apiClient.get('/events', filters);
  },

  async getById(eventId) {
    return apiClient.get(`/events/${eventId}`);
  },

  async create(eventData) {
    return apiClient.post('/events', eventData);
  },

  async join(eventId) {
    return apiClient.post(`/events/${eventId}/join`);
  },

  async leave(eventId) {
    return apiClient.post(`/events/${eventId}/leave`);
  },

  async getMyEvents(page = 1, limit = 20) {
    return apiClient.get('/events/me/joined', { page, limit });
  },
};
```

### Flutter / Dart

#### API Client Setup

```dart
// lib/api/client.dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  static const String baseURL = 'https://api.boomghoom.com/api/v1';
  String? token;

  void setToken(String? token) {
    this.token = token;
  }

  Future<Map<String, dynamic>> request(
    String endpoint, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final url = Uri.parse('$baseURL$endpoint');
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }

    http.Response response;

    switch (method) {
      case 'GET':
        response = await http.get(url, headers: headers);
        break;
      case 'POST':
        response = await http.post(
          url,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
        break;
      case 'PATCH':
        response = await http.patch(
          url,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
        break;
      case 'DELETE':
        response = await http.delete(url, headers: headers);
        break;
      default:
        throw Exception('Unsupported HTTP method');
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode >= 400) {
      throw ApiError.fromJson(data['error'], response.statusCode);
    }

    return data;
  }
}

class ApiError implements Exception {
  final String code;
  final String message;
  final int statusCode;
  final dynamic details;

  ApiError({
    required this.code,
    required this.message,
    required this.statusCode,
    this.details,
  });

  factory ApiError.fromJson(Map<String, dynamic> error, int statusCode) {
    return ApiError(
      code: error['code'] ?? 'UNKNOWN_ERROR',
      message: error['message'] ?? 'An error occurred',
      statusCode: statusCode,
      details: error['details'],
    );
  }

  @override
  String toString() => message;
}
```

#### Authentication Example

```dart
// lib/api/auth_api.dart
import 'package:shared_preferences/shared_preferences.dart';
import 'client.dart';

class AuthAPI {
  final ApiClient client = ApiClient();

  Future<Map<String, dynamic>> signup({
    required String phoneNumber,
    required String fullName,
    required String password,
    String? email,
    String? referralCode,
  }) async {
    final response = await client.request(
      '/auth/signup',
      method: 'POST',
      body: {
        'phoneNumber': phoneNumber,
        'fullName': fullName,
        'password': password,
        if (email != null) 'email': email,
        if (referralCode != null) 'referralCode': referralCode,
      },
    );

    if (response['success'] == true) {
      final tokens = response['data']['tokens'];
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('access_token', tokens['accessToken']);
      await prefs.setString('refresh_token', tokens['refreshToken']);
      client.setToken(tokens['accessToken']);
    }

    return response;
  }

  Future<Map<String, dynamic>> login({
    required String phoneNumber,
    required String password,
  }) async {
    final response = await client.request(
      '/auth/login',
      method: 'POST',
      body: {
        'phoneNumber': phoneNumber,
        'password': password,
      },
    );

    if (response['success'] == true) {
      final tokens = response['data']['tokens'];
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('access_token', tokens['accessToken']);
      await prefs.setString('refresh_token', tokens['refreshToken']);
      client.setToken(tokens['accessToken']);
    }

    return response;
  }
}
```

---

## Best Practices

### 1. Token Management

- Store tokens securely (Keychain/Keystore)
- Refresh token before expiry (check `expiresIn`)
- Handle token refresh on 401 errors
- Clear tokens on logout

### 2. Error Handling

- Implement global error handler
- Show user-friendly error messages
- Log errors for debugging
- Handle network errors gracefully

### 3. Caching

- Cache user profile data
- Cache event lists with TTL
- Implement offline support where possible
- Use ETags for conditional requests

### 4. Performance

- Implement request debouncing for search
- Use pagination for large lists
- Lazy load images
- Optimize API calls (batch when possible)

### 5. Security

- Never store passwords in plain text
- Use HTTPS only
- Validate input on client side
- Sanitize user inputs

### 6. Rate Limiting

- Implement exponential backoff
- Respect rate limit headers
- Queue requests when rate limited
- Show appropriate messages to users

---

## Common Integration Patterns

### 1. Authentication Flow

```
1. User opens app
2. Check for stored token
3. If token exists:
   - Validate token
   - If expired, refresh token
   - If refresh fails, redirect to login
4. If no token:
   - Show login/signup screen
5. After login:
   - Store tokens
   - Fetch user profile
   - Navigate to home
```

### 2. Event Discovery Flow

```
1. Get user location
2. Fetch nearby events
3. Display on map/list
4. User filters/searches
5. Fetch filtered results
6. User selects event
7. Fetch event details
8. Show event detail screen
```

### 3. Join Event Flow

```
1. User clicks "Join Event"
2. Check if user has pending dues
3. If yes:
   - Show dues screen
   - User clears dues
4. Send join request
5. If requires approval:
   - Show pending status
   - Wait for admin approval
6. If auto-approved:
   - Show success
   - Add to my events
```

### 4. Payment Flow

```
1. User has pending dues
2. User clicks "Pay Dues"
3. Create payment order
4. Get gateway order ID
5. Initialize payment gateway SDK
6. User completes payment
7. Receive payment callback
8. Verify payment
9. Update dues status
10. Show success message
```

### 5. Chat Flow

```
1. User opens chat list
2. Fetch user chats
3. User selects chat
4. Connect to WebSocket
5. Fetch message history
6. Display messages
7. User sends message
8. Emit via WebSocket
9. Receive real-time updates
```

---

## WebSocket Integration

### Connection

```javascript
import io from 'socket.io-client';

const socket = io('https://api.boomghoom.com', {
  auth: {
    token: accessToken,
  },
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
```

### Join Chat Room

```javascript
socket.emit('chat:join', chatId);
```

### Send Message

```javascript
socket.emit('chat:message', {
  chatId: 'chat_id',
  type: 'text',
  content: 'Hello!',
});
```

### Receive Messages

```javascript
socket.on('chat:message', (data) => {
  const { chatId, message } = data;
  // Update UI with new message
});
```

### Typing Indicator

```javascript
// Send typing status
socket.emit('chat:typing', {
  chatId: 'chat_id',
  isTyping: true,
});

// Receive typing status
socket.on('chat:typing', (data) => {
  const { userId, userName, isTyping } = data;
  // Show/hide typing indicator
});
```

---

## Testing

### Test Credentials

For development/testing:
- Phone: `9876543210`
- Password: `password123`

### Test Scenarios

1. **Authentication**
   - Signup → Login → Logout
   - Token refresh
   - Invalid credentials

2. **Events**
   - Create event
   - Join event
   - Leave event
   - Complete event

3. **Finance**
   - View dues
   - Clear dues
   - Request withdrawal

4. **Social**
   - Send friend request
   - Accept/reject request
   - Rate user

5. **Chat**
   - Create chat
   - Send message
   - Receive message

---

## Support

For issues or questions:
- Check API documentation
- Review error codes
- Contact backend team
- Check server logs

---

**Last Updated:** December 2024
**API Version:** v1

