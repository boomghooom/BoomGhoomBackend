# BoomGhoom Backend

Production-ready backend API for BoomGhoom - India's Social Events & Group Activities Platform.

## Architecture

```
src/
├── api/                    # API Layer (Controllers, Routes, Middleware)
│   ├── controllers/        # Request handlers
│   ├── routes/             # Route definitions
│   ├── middleware/         # Express middleware
│   └── validators/         # Request validation schemas
│
├── application/            # Application Layer (Use Cases)
│   └── services/           # Business logic services
│
├── domain/                 # Domain Layer (Core Business)
│   ├── entities/           # Domain models/interfaces
│   ├── repositories/       # Repository interfaces
│   └── events/             # Domain events
│
├── infrastructure/         # Infrastructure Layer
│   ├── database/           # Database configuration & models
│   │   ├── models/         # Mongoose models
│   │   └── repositories/   # Repository implementations
│   ├── cache/              # Redis cache implementation
│   ├── storage/            # File storage (S3)
│   ├── payment/            # Payment gateway abstraction
│   ├── messaging/          # SMS, Push notifications
│   └── queue/              # Job queue (Bull)
│
├── shared/                 # Shared utilities
│   ├── constants/          # Application constants
│   ├── errors/             # Custom error classes
│   ├── utils/              # Utility functions
│   └── types/              # Shared TypeScript types
│
├── socket/                 # WebSocket handlers
│   ├── handlers/           # Socket event handlers
│   └── middleware/         # Socket middleware
│
└── config/                 # Configuration
```

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Cache**: Redis
- **Real-time**: Socket.IO
- **Queue**: BullMQ
- **Payment**: Razorpay/Cashfree abstraction
- **Storage**: AWS S3 compatible

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- MongoDB >= 6.0
- Redis >= 7.0

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp env.example.txt .env

# Fill in your environment variables
# Edit .env with your configuration

# Run in development
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## API Documentation

### Authentication
- `POST /api/v1/auth/signup` - Register new user
- `POST /api/v1/auth/login` - Login with phone/password
- `POST /api/v1/auth/google` - Google OAuth
- `POST /api/v1/auth/apple` - Apple OAuth
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout

### Users
- `GET /api/v1/users/me` - Get current user
- `PATCH /api/v1/users/me` - Update profile
- `GET /api/v1/users/:id` - Get user by ID

### KYC
- `POST /api/v1/kyc/initiate` - Start KYC
- `POST /api/v1/kyc/selfie` - Upload selfie
- `POST /api/v1/kyc/document` - Upload document (optional)
- `GET /api/v1/kyc/status` - Get KYC status

### Events
- `GET /api/v1/events` - List events
- `GET /api/v1/events/nearby` - Nearby events
- `GET /api/v1/events/:id` - Event details
- `POST /api/v1/events` - Create event (requires KYC)
- `PATCH /api/v1/events/:id` - Update event
- `DELETE /api/v1/events/:id` - Cancel event

### Event Participation
- `POST /api/v1/events/:id/join` - Request to join
- `POST /api/v1/events/:id/leave` - Request to leave
- `POST /api/v1/events/:id/approve/:userId` - Approve join request
- `POST /api/v1/events/:id/reject/:userId` - Reject join request

### Finance
- `GET /api/v1/finance/summary` - Financial summary
- `GET /api/v1/finance/transactions` - Transaction history
- `POST /api/v1/finance/dues/pay` - Pay dues
- `POST /api/v1/finance/withdraw` - Withdraw commission

### Social
- `GET /api/v1/friends` - List friends
- `POST /api/v1/friends/request` - Send friend request
- `POST /api/v1/friends/accept/:id` - Accept request
- `POST /api/v1/friends/reject/:id` - Reject request

### Chat
- `GET /api/v1/chats` - List chats
- `GET /api/v1/chats/:id/messages` - Get messages

## WebSocket Events

### Client Events
- `chat:join` - Join chat room
- `chat:message` - Send message
- `chat:typing` - Typing indicator

### Server Events
- `chat:message` - New message
- `chat:typing` - User typing
- `notification` - Push notification

## Business Rules

### Due System
- First group activity join: ₹25 due added
- Must clear dues before joining another group
- Sponsored events don't add dues

### Commission System
- Admin earns 80% of total dues generated
- Commission available only after event completion
- Minimum withdrawal: ₹1000

### Leave Policy
- 60-minute window to request leave
- Requires admin approval
- After window: due remains mandatory

## License

UNLICENSED - Proprietary

