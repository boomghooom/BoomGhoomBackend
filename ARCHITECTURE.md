# BoomGhoom Backend Architecture

## Overview

This backend follows Clean Architecture principles with clear separation of concerns. It's designed as a modular monolith that can easily be split into microservices in the future.

## Directory Structure

```
src/
├── api/                    # API Layer
│   ├── controllers/        # Request handlers (thin - delegate to services)
│   ├── routes/             # Route definitions
│   ├── middleware/         # Express middleware
│   └── validators/         # Zod validation schemas
│
├── application/            # Application Layer
│   └── services/           # Business logic (use cases)
│
├── domain/                 # Domain Layer
│   ├── entities/           # Domain models (TypeScript interfaces)
│   └── repositories/       # Repository interfaces
│
├── infrastructure/         # Infrastructure Layer
│   ├── database/
│   │   ├── models/         # Mongoose models
│   │   └── repositories/   # Repository implementations
│   ├── cache/              # Redis cache
│   ├── storage/            # S3 file storage
│   ├── payment/            # Payment gateway abstraction
│   └── queue/              # Job queues (future)
│
├── shared/                 # Shared Utilities
│   ├── constants/          # Application constants
│   ├── errors/             # Custom error classes
│   └── utils/              # Utility functions
│
├── socket/                 # WebSocket Layer
│   └── index.ts            # Socket.IO handlers
│
├── config/                 # Configuration
│   ├── index.ts            # Environment config
│   ├── database.ts         # MongoDB config
│   └── redis.ts            # Redis config
│
└── index.ts                # Application entry point
```

## Key Design Patterns

### 1. Repository Pattern
- Abstracts data access logic
- Each entity has a repository interface in `domain/repositories`
- Implementation in `infrastructure/database/repositories`
- Enables easy mocking for tests and future database swaps

### 2. Service Pattern
- Business logic lives in services
- Controllers are thin - only handle HTTP concerns
- Services are transaction-aware
- Each service has a single responsibility

### 3. Dependency Injection (Manual)
- Services and repositories are singletons exported at module level
- Easy to swap implementations for testing
- Can be migrated to proper DI container if needed

### 4. Error Handling
- Custom `AppError` class with error codes
- Centralized error middleware
- Operational vs Programming errors separation
- Consistent error response format

## Data Flow

```
Request → Route → Controller → Service → Repository → Database
                              ↓
                        Business Logic
                              ↓
Response ← Controller ← Service ← Repository ← Database
```

## Key Business Rules

### Due System
1. First group activity join: ₹25 due added
2. Cannot join another group until dues cleared
3. Sponsored events don't add dues
4. Dues can be cleared via:
   - UPI/Card payment
   - Using earned commissions
   - Referral rewards

### Commission System
1. Admin earns 80% of total dues generated
2. Commission states: pending → available → withdrawn
3. Commission becomes available when:
   - Event is completed
   - All participants (except admin) have cleared dues
4. Minimum withdrawal: ₹1000

### Leave Policy
1. 60-minute window to request leave after joining
2. Requires admin approval
3. After window: dues remain mandatory

## API Versioning

All routes are prefixed with `/api/v1/`. For breaking changes:
1. Create new version folder (`v2/`)
2. Support both versions during migration
3. Deprecate old version with sunset date

## Authentication

- JWT-based with access + refresh tokens
- Access token: 15 minutes
- Refresh token: 7 days
- OAuth support: Google, Apple
- Tokens stored in Redis for invalidation

## Real-time Features

Socket.IO handles:
- Real-time chat messaging
- Typing indicators
- Online status
- Notifications push

## Caching Strategy

Redis used for:
- Session management
- Rate limiting
- Frequently accessed data (user profiles, events)
- Online user tracking
- OTP storage

## Future Microservices Split

The modular structure enables easy extraction:

| Service | Modules to Extract |
|---------|-------------------|
| Auth Service | auth, user profile |
| Event Service | events, participation |
| Finance Service | dues, commissions, payments |
| Social Service | friends, notifications, ratings |
| Chat Service | chats, messages |
| KYC Service | KYC verification |

Each service would:
1. Have its own database/schema
2. Communicate via message queue (RabbitMQ/Redis)
3. Expose APIs through API Gateway
4. Share authentication via JWT validation

## Performance Considerations

1. Database indexes on frequently queried fields
2. Geo-spatial indexes for location queries
3. Pagination on all list endpoints
4. Redis caching with appropriate TTLs
5. Connection pooling for MongoDB
6. Compression enabled for responses

## Security

1. Helmet.js for HTTP headers
2. Rate limiting per endpoint
3. Input validation with Zod
4. SQL injection N/A (MongoDB)
5. XSS protection via input sanitization
6. CORS configuration
7. Secure password hashing (bcrypt)

## Monitoring (To Add)

1. Health check endpoint
2. Prometheus metrics
3. Structured logging with Winston
4. Error tracking (Sentry)
5. APM (New Relic/Datadog)

