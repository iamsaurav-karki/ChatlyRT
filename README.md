# ChatlyRT - Multi-User Real-Time Chat System

A scalable, production-ready multi-user real-time chat application built with modern technologies. Features include real-time messaging, file attachments, message reactions, user profiles, online presence tracking, and message deletion (for you/everyone).

## 📋 Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture Overview](#architecture-overview)
- [Setup Guide](#setup-guide)
- [Tech Stack Deep Dive](#tech-stack-deep-dive)
- [Data Flow & Functionality](#data-flow--functionality)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

## ✨ Features

- **Real-time Messaging**: Instant message delivery via WebSockets
- **User Authentication**: JWT-based secure authentication
- **Online Presence**: Real-time online/offline status tracking
- **File Attachments**: Send images and files (PDF, DOC, etc.)
- **Message Reactions**: React to messages with emojis
- **User Profiles**: Customizable profiles with avatars and bios
- **Message Deletion**: Delete messages for yourself or everyone
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Persistent Storage**: All messages and files are permanently stored
- **Scalable Architecture**: Built for horizontal scaling

## 🛠️ Technology Stack

### Frontend
- **React 18**: Modern UI library for building interactive interfaces
- **Socket.IO Client**: Real-time bidirectional communication
- **Axios**: HTTP client for REST API calls
- **CSS3**: Responsive design with media queries

### Backend
- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework
- **Socket.IO**: WebSocket server for real-time communication
- **JWT**: JSON Web Tokens for authentication
- **Multer**: File upload handling

### Database & Storage
- **Apache Cassandra**: Distributed NoSQL database for message persistence
- **Redis**: In-memory data store for online presence tracking

### Message Queue
- **Apache Kafka**: Distributed event streaming platform
- **Zookeeper**: Coordination service for Kafka

### Infrastructure
- **Docker**: Containerization platform
- **Docker Compose**: Multi-container orchestration

## 🏗️ Architecture Overview

```
┌─────────────┐
│   Browser    │
│  (React)     │
└──────┬───────┘
       │ HTTP/WebSocket
       ↓
┌─────────────────────────────────┐
│      Backend (Node.js)          │
│  ┌──────────┐  ┌─────────────┐  │
│  │ Express  │  │ Socket.IO  │  │
│  │   API    │  │  Server     │  │
│  └────┬─────┘  └──────┬──────┘  │
│       │               │          │
│       ↓               ↓          │
│  ┌──────────┐   ┌──────────┐   │
│  │  Kafka   │   │  Redis    │   │
│  │ Producer │   │ (Presence)│   │
│  └────┬─────┘   └───────────┘   │
└───────┼──────────────────────────┘
        │
        ↓
┌─────────────────────────────────┐
│      Message Queue (Kafka)      │
└───────┬─────────────────────────┘
        │
        ↓
┌─────────────────────────────────┐
│    Kafka Consumer (Backend)     │
└───────┬─────────────────────────┘
        │
        ↓
┌─────────────────────────────────┐
│   Cassandra (Message Storage)    │
└─────────────────────────────────┘
```

## 🚀 Setup Guide

### Prerequisites

- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)
- **cqlsh** (included in Cassandra Docker image)

### Step 1: Clone and Navigate

```bash
cd /path/to/Chatly
```

### Step 2: Start All Services

Start all infrastructure and application services:

```bash
docker-compose up -d
```

This command starts:
- **Cassandra** (port 9042): Database for message storage
- **Zookeeper** (port 2181): Coordination service for Kafka
- **Kafka** (ports 9092-9093): Message queue
- **Redis** (port 6379): Online presence cache
- **Backend** (port 3001): Node.js API server
- **Frontend** (port 3000): React application

Wait 30-60 seconds for all services to initialize.

### Step 3: Initialize Database Schema

**IMPORTANT**: The database schema must be manually executed before using the application.

#### Option 1: Interactive cqlsh (Recommended)

1. **Access Cassandra shell:**
   ```bash
   docker exec -it chatly_cassandra cqlsh
   ```

2. **Copy schema contents:**
   - Open `backend/schema/cassandra-schema.cql` in your editor
   - Copy the entire file contents

3. **Paste and execute:**
   - Paste the copied schema into the cqlsh terminal
   - Commands will execute automatically

4. **Verify schema:**
   ```cql
   DESCRIBE KEYSPACE chatly;
   USE chatly;
   DESCRIBE TABLES;
   ```
   You should see: `users`, `messages`, `message_reactions`

5. **Exit cqlsh:**
   ```cql
   exit;
   ```

#### Option 2: Direct File Execution

```bash
# Copy schema file to container
docker cp backend/schema/cassandra-schema.cql chatly_cassandra:/tmp/schema.cql

# Execute schema file
docker exec -it chatly_cassandra cqlsh -f /tmp/schema.cql
```

### Step 4: Verify Services

Check all services are running:

```bash
docker-compose ps
```

All services should show "Up" status.

### Step 5: Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

### Step 6: Create Users and Test

1. **Register First User:**
   - Go to http://localhost:3000
   - Click "Register"
   - Enter: username, email, password
   - After registration, you'll be redirected to login
   - Login with your credentials

2. **Register Second User:**
   - Open an incognito/private window
   - Register another user with a different email
   - Login with the second user

3. **Start Chatting:**
   - Both users should see each other in the user list
   - Click on a user to start a chat
   - Send messages - they appear in real-time!

## 🔧 Tech Stack Deep Dive

### 1. React (Frontend Framework)

**Purpose**: Builds the user interface and manages client-side state.

**How it works**:
- Component-based architecture
- State management with React Hooks (`useState`, `useEffect`)
- Real-time UI updates when messages arrive via Socket.IO
- Responsive design with CSS media queries

**Key Components**:
- `Login.js`: Authentication UI (register/login forms)
- `Chat.js`: Main chat interface (user list, messages, input)
- `Profile.js`: User profile management
- `NewChat.js`: User search and chat initiation
- `ReactionPicker.js`: Emoji reaction selector

**Flow**:
```
User Action → React Component → API Call/Socket Event → State Update → UI Re-render
```

### 2. Socket.IO (Real-Time Communication)

**Purpose**: Enables bidirectional real-time communication between client and server.

**How it works**:
- WebSocket protocol with fallback to HTTP long-polling
- Event-based communication
- Automatic reconnection on disconnect
- Room-based message routing

**Client Side** (`frontend/src/services/socket.js`):
- Connects to backend WebSocket server
- Authenticates with JWT token
- Listens for events: `receiveMessage`, `userOnline`, `userOffline`, `messageDeleted`, `messageReaction`
- Emits events: `sendMessage`, `deleteMessage`

**Server Side** (`backend/services/socketService.js`):
- Handles WebSocket connections
- Authenticates clients via JWT middleware
- Broadcasts messages to sender and receiver
- Manages online presence via Redis
- Processes message deletion requests

**Flow**:
```
Client emits 'sendMessage' 
  → Server receives message
  → Server saves to database
  → Server emits 'receiveMessage' to sender & receiver
  → Clients update UI in real-time
```

### 3. Apache Kafka (Message Queue)

**Purpose**: Decouples message sending from persistence, enabling scalability and reliability.

**How it works**:
- Producer publishes messages to topics
- Consumer subscribes to topics and processes messages
- Messages are persisted in Kafka logs
- Supports multiple consumers for different purposes

**Producer** (`backend/services/socketService.js`):
- Publishes messages to `chat-messages` topic
- Includes message metadata (sender, receiver, content, attachments)
- Uses chat_id as message key for partitioning

**Consumer** (`backend/services/kafkaConsumer.js`):
- Subscribes to `chat-messages` topic
- Processes messages asynchronously
- Saves messages to Cassandra database
- Handles duplicate prevention (skips already-saved messages)

**Flow**:
```
Message sent → Kafka Producer → Kafka Topic → Kafka Consumer → Cassandra
```

**Benefits**:
- **Scalability**: Multiple consumers can process messages in parallel
- **Reliability**: Messages are persisted even if consumer fails
- **Decoupling**: Sender doesn't wait for database write
- **Future Extensibility**: Easy to add analytics, notifications, etc.

### 4. Apache Cassandra (Database)

**Purpose**: Stores all persistent data (users, messages, reactions) with high availability and scalability.

**How it works**:
- Distributed NoSQL database
- Partition-based data distribution
- TimeUUID for chronological ordering
- Set data type for collections

**Schema** (`backend/schema/cassandra-schema.cql`):

**Users Table**:
```cql
CREATE TABLE users (
  user_id uuid PRIMARY KEY,
  username text,
  email text,
  password text,
  bio text,
  avatar_url text,
  created_at timestamp,
  updated_at timestamp
);
```

**Messages Table**:
```cql
CREATE TABLE messages (
  chat_id text,
  message_id timeuuid,
  sender_id text,
  receiver_id text,
  content text,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  created_at timestamp,
  deleted_for set<text>,
  deleted_for_everyone boolean,
  PRIMARY KEY (chat_id, message_id)
) WITH CLUSTERING ORDER BY (message_id ASC);
```

**Key Design Decisions**:
- **chat_id**: Composite of sorted user IDs (`userId1_userId2`) for efficient querying
- **message_id**: TimeUUID ensures chronological ordering
- **Partition Key**: `chat_id` groups messages by conversation
- **Clustering Key**: `message_id` orders messages within a chat

**Flow**:
```
Kafka Consumer → Message.create() → Cassandra INSERT → Message persisted
```

### 5. Redis (Online Presence)

**Purpose**: Tracks which users are currently online for real-time status updates.

**How it works**:
- In-memory key-value store
- Fast read/write operations
- Automatic expiration (optional)
- Pub/Sub for broadcasting

**Data Structure**:
```
Key: online_users:{userId}
Value: socketId
```

**Operations**:
- **User connects**: `SET online_users:{userId} {socketId}`
- **User disconnects**: `DEL online_users:{userId}`
- **Check online**: `GET online_users:{userId}`
- **List all online**: `KEYS online_users:*`

**Flow**:
```
User connects → Redis SET → Broadcast 'userOnline'
User disconnects → Redis DEL → Broadcast 'userOffline'
```

**Implementation** (`backend/services/socketService.js`):
- On connection: Store socket ID in Redis
- On disconnect: Remove from Redis
- Broadcast online/offline events to all clients
- Send initial online users list to newly connected clients

### 6. JWT Authentication

**Purpose**: Secure, stateless user authentication.

**How it works**:
- Server generates token after successful login
- Token contains user ID and expiration
- Client includes token in API requests and Socket.IO auth
- Server validates token on each request

**Token Structure**:
```json
{
  "userId": "uuid",
  "iat": timestamp,
  "exp": timestamp
}
```

**Flow**:
```
User Login → Verify Credentials → Generate JWT → Send to Client
Client → Include JWT in Requests → Server Validates → Process Request
```

**Implementation**:
- **Backend** (`backend/utils/auth.js`): Token generation and verification
- **Middleware** (`backend/middleware/auth.js`): Validates token on protected routes
- **Socket.IO** (`backend/services/socketService.js`): Validates token on connection

### 7. Express.js (REST API)

**Purpose**: Provides HTTP endpoints for authentication, user management, and message retrieval.

**Routes** (`backend/routes/`):
- **auth.js**: `/api/auth/register`, `/api/auth/login`
- **users.js**: `/api/users` (get all users)
- **messages.js**: `/api/messages/:userId` (get chat history)
- **profile.js**: `/api/profile/me` (get/update profile)
- **reactions.js**: `/api/reactions/:userId/:messageId` (toggle/get reactions)
- **upload.js**: `/api/upload/message` (file upload)

**Flow**:
```
Client Request → Express Router → Auth Middleware → Route Handler → Database → Response
```

## 📊 Data Flow & Functionality

### Message Sending Flow

```
1. User types message in React UI
   ↓
2. handleSendMessage() in Chat.js
   ↓
3. Socket.IO emits 'sendMessage' event
   ↓
4. Backend socketService.js receives event
   ↓
5. Message.create() saves to Cassandra (gets real messageId)
   ↓
6. Kafka Producer publishes to 'chat-messages' topic
   ↓
7. Socket.IO emits 'receiveMessage' to sender (confirmation)
   ↓
8. Socket.IO emits 'receiveMessage' to receiver (if online)
   ↓
9. Kafka Consumer processes message (skips if already saved)
   ↓
10. React components update UI in real-time
```

### Message Receiving Flow

```
1. Socket.IO 'receiveMessage' event arrives
   ↓
2. Chat.js receives event in socket.on('receiveMessage')
   ↓
3. Normalize message data (ensure message_id is set)
   ↓
4. Check for duplicates (by message_id)
   ↓
5. Add to messages state (if not duplicate)
   ↓
6. Load reactions for the message
   ↓
7. React re-renders UI with new message
   ↓
8. Auto-scroll to bottom
```

### Online Presence Flow

```
1. User opens application
   ↓
2. Socket.IO connects with JWT token
   ↓
3. Backend authenticates and stores in Redis: online_users:{userId} = socketId
   ↓
4. Backend fetches all online users from Redis
   ↓
5. Backend emits 'onlineUsersList' to new client
   ↓
6. Backend broadcasts 'userOnline' to all clients
   ↓
7. Frontend updates onlineUsers state
   ↓
8. UI shows green dot next to online users
   ↓
9. User disconnects → Redis DEL → Broadcast 'userOffline'
```

### File Upload Flow

```
1. User selects file (image/document)
   ↓
2. handleFileUpload() in Chat.js
   ↓
3. POST /api/upload/message with FormData
   ↓
4. Multer middleware saves file to /uploads directory
   ↓
5. Backend returns file URL, type, and name
   ↓
6. Socket.IO emits 'sendMessage' with attachment data
   ↓
7. Message saved to Cassandra with attachment_url
   ↓
8. File served via /api/uploads/{filename} endpoint
   ↓
9. UI displays image inline or file download link
```

### Message Reaction Flow

```
1. User double-clicks message (👍) or clicks + button
   ↓
2. handleReaction() in Chat.js
   ↓
3. POST /api/reactions/:userId/:messageId
   ↓
4. Backend Reaction.toggle() adds/removes reaction
   ↓
5. Backend emits 'messageReaction' event via Socket.IO
   ↓
6. All clients update message reactions in real-time
   ↓
7. UI shows reaction emoji with count
```

### Message Deletion Flow

```
1. User right-clicks message
   ↓
2. Context menu appears ("Delete for you" / "Delete for everyone")
   ↓
3. handleDeleteMessage() in Chat.js
   ↓
4. Optimistically remove from UI
   ↓
5. Socket.IO emits 'deleteMessage' event
   ↓
6. Backend Message.deleteForMe() or deleteForEveryone()
   ↓
7. Backend updates Cassandra (adds to deleted_for set or clears content)
   ↓
8. Backend emits 'messageDeleted' to affected users
   ↓
9. All clients remove message from UI in real-time
```

### Profile Update Flow

```
1. User clicks profile button (⚙️)
   ↓
2. Profile modal opens
   ↓
3. User updates username, bio, or avatar
   ↓
4. PUT /api/profile/me with FormData (if avatar)
   ↓
5. Backend User.updateProfile() updates Cassandra
   ↓
6. Backend returns updated profile
   ↓
7. Frontend updates user state and UI
   ↓
8. Avatar displayed in sidebar and chat headers
```

## 📡 API Documentation

### Authentication

**POST /api/auth/register**
- Register a new user
- Body: `{ username, email, password }`
- Response: `{ message: "User registered successfully" }`

**POST /api/auth/login**
- Login user
- Body: `{ email, password }`
- Response: `{ token, userId, username }`

### Users

**GET /api/users**
- Get all users (excluding current user)
- Headers: `Authorization: Bearer {token}`
- Response: `[{ user_id, username, email, avatar_url, ... }]`

### Messages

**GET /api/messages/:userId**
- Get chat history with specified user
- Headers: `Authorization: Bearer {token}`
- Response: `[{ message_id, sender_id, receiver_id, content, created_at, ... }]`

**DELETE /api/messages/:userId/:messageId/me**
- Delete message for yourself
- Headers: `Authorization: Bearer {token}`
- Response: `{ success: true }`

**DELETE /api/messages/:userId/:messageId/everyone**
- Delete message for everyone (sender only)
- Headers: `Authorization: Bearer {token}`
- Response: `{ success: true }`

### Profile

**GET /api/profile/me**
- Get current user's profile
- Headers: `Authorization: Bearer {token}`
- Response: `{ user_id, username, email, bio, avatar_url, ... }`

**PUT /api/profile/me**
- Update current user's profile
- Headers: `Authorization: Bearer {token}`
- Body: `FormData` with `username`, `bio`, `avatar` (optional file)
- Response: `{ user_id, username, email, bio, avatar_url, ... }`

### Reactions

**POST /api/reactions/:userId/:messageId**
- Toggle reaction on message
- Headers: `Authorization: Bearer {token}`
- Body: `{ reaction: "👍" }`
- Response: `{ reactions: [...] }`

**GET /api/reactions/:userId/:messageId**
- Get all reactions for a message
- Headers: `Authorization: Bearer {token}`
- Response: `[{ user_id, reaction, created_at }, ...]`

### Upload

**POST /api/upload/message**
- Upload file for message attachment
- Headers: `Authorization: Bearer {token}`
- Body: `FormData` with `file`
- Response: `{ url: "/api/uploads/{filename}", type: "image/jpeg", name: "filename.jpg" }`

## 🐛 Troubleshooting

### Backend won't start

**Symptoms**: Backend container exits or shows errors

**Solutions**:
1. Wait for Cassandra to be fully ready:
   ```bash
   docker logs chatly_cassandra | grep "Starting listening for CQL clients"
   ```
2. Check if schema is initialized:
   ```bash
   docker exec -it chatly_cassandra cqlsh -e "DESCRIBE KEYSPACE chatly;"
   ```
3. Verify Kafka and Zookeeper are running:
   ```bash
   docker-compose ps
   ```
4. Check backend logs:
   ```bash
   docker logs chatly_backend
   ```

### Messages not appearing

**Symptoms**: Messages sent but not visible

**Solutions**:
1. Check Kafka consumer is running:
   ```bash
   docker logs chatly_backend | grep "Kafka consumer"
   ```
2. Verify messages in database:
   ```bash
   docker exec -it chatly_cassandra cqlsh -e "USE chatly; SELECT * FROM messages LIMIT 5;"
   ```
3. Check Socket.IO connection in browser console
4. Verify JWT token is valid

### Duplicate messages

**Symptoms**: Same message appears multiple times

**Solutions**:
1. Check if Kafka consumer is skipping already-saved messages:
   ```bash
   docker logs chatly_backend | grep "already saved"
   ```
2. Clear browser cache and refresh
3. Check for duplicate message_ids in database

### Socket connection fails

**Symptoms**: "Connection failed" or "Authentication error"

**Solutions**:
1. Check CORS settings in `backend/server.js`
2. Verify token is being sent:
   - Check browser Network tab → WS connection
   - Verify `auth: { token }` in Socket.IO connection
3. Check backend logs for authentication errors:
   ```bash
   docker logs chatly_backend | grep "Authentication"
   ```

### Files not uploading

**Symptoms**: File upload fails or files not displaying

**Solutions**:
1. Check uploads directory exists and is writable:
   ```bash
   docker exec chatly_backend ls -la /app/uploads
   ```
2. Verify file size limits in `backend/middleware/upload.js`
3. Check backend logs for upload errors:
   ```bash
   docker logs chatly_backend | grep "upload"
   ```

### Online status not updating

**Symptoms**: Users show as offline when they're online

**Solutions**:
1. Check Redis is running:
   ```bash
   docker exec -it chatly_redis redis-cli KEYS "online_users:*"
   ```
2. Verify Socket.IO connection is established
3. Check browser console for connection errors

## 📝 View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker logs -f chatly_backend
docker logs -f chatly_frontend
docker logs -f chatly_cassandra
docker logs -f chatly_kafka
docker logs -f chatly_redis
```

## 🛑 Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove all data (volumes)
docker-compose down -v
```

## 🔄 Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend
```

## 📦 Project Structure

```
Chatly/
├── docker-compose.yml          # Docker orchestration
├── README.md                   # This file
├── .gitignore                  # Git ignore rules
│
├── backend/                    # Node.js Backend
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js              # Main server entry
│   │
│   ├── config/                # Configuration
│   │   ├── database.js        # Cassandra client
│   │   ├── kafka.js           # Kafka producer/consumer
│   │   └── redis.js           # Redis client
│   │
│   ├── models/                # Data models
│   │   ├── User.js            # User operations
│   │   ├── Message.js         # Message operations
│   │   └── Reaction.js        # Reaction operations
│   │
│   ├── routes/                # Express routes
│   │   ├── auth.js            # Authentication
│   │   ├── users.js           # User management
│   │   ├── messages.js        # Message operations
│   │   ├── profile.js         # Profile management
│   │   ├── reactions.js       # Reaction operations
│   │   └── upload.js          # File uploads
│   │
│   ├── services/              # Business logic
│   │   ├── socketService.js   # Socket.IO handlers
│   │   └── kafkaConsumer.js   # Kafka consumer
│   │
│   ├── middleware/            # Express middleware
│   │   ├── auth.js            # JWT authentication
│   │   └── upload.js          # File upload handling
│   │
│   ├── utils/                 # Utilities
│   │   ├── auth.js            # JWT & password hashing
│   │   └── chat.js            # Chat utilities
│   │
│   ├── schema/                # Database schema
│   │   └── cassandra-schema.cql
│   │
│   └── uploads/               # Uploaded files (volume)
│
└── frontend/                  # React Frontend
    ├── Dockerfile
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js           # React entry
        ├── App.js             # Main app
        ├── components/        # React components
        │   ├── Login.js       # Auth UI
        │   ├── Chat.js        # Chat interface
        │   ├── Profile.js     # Profile management
        │   ├── NewChat.js     # User search
        │   └── ReactionPicker.js
        └── services/          # API & Socket
            ├── api.js         # REST client
            └── socket.js      # Socket.IO client
```

## 🔐 Security Considerations

- **JWT Tokens**: Stored in localStorage (consider httpOnly cookies for production)
- **Password Hashing**: Uses bcrypt with salt rounds
- **CORS**: Configured for development (restrict in production)
- **File Uploads**: Size limits and type validation
- **Input Validation**: Should be added for production use

## 🚀 Production Deployment

For production deployment, consider:

1. **Environment Variables**: Move secrets to environment variables
2. **HTTPS**: Use SSL/TLS certificates
3. **Database Replication**: Configure Cassandra replication
4. **Kafka Clustering**: Set up Kafka cluster for high availability
5. **Redis Persistence**: Configure Redis persistence
6. **Load Balancing**: Add load balancer for multiple backend instances
7. **Monitoring**: Add logging and monitoring (e.g., Prometheus, Grafana)
8. **Backup Strategy**: Regular database backups

## 📄 License

This project is open source and available for educational purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built with  using React, Node.js, Cassandra, Kafka, and Redis**
