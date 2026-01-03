-- ChatlyRT Cassandra Schema
-- Keyspace and Tables for Multi-User Real-Time Chat System
-- 
-- This schema supports:
-- - User profiles with avatars and bios
-- - Messages with file/image attachments (PERSISTENT)
-- - Message reactions (emojis)
--
-- IMPORTANT: Execute this schema manually using cqlsh
-- See README.md for instructions
--
-- FILE PERSISTENCE:
-- - All uploaded files/images are saved to disk in the 'uploads' directory
-- - File paths are stored in messages.attachment_url
-- - Files are served via /api/uploads/{filename} endpoint
-- - Files persist across server restarts via Docker volume (backend_uploads)
-- - Message attachments are permanently stored in Cassandra database
--
-- MIGRATION NOTE: If you have an existing database, you may need to add new columns:
--   ALTER TABLE users ADD bio text;
--   ALTER TABLE users ADD avatar_url text;
--   ALTER TABLE users ADD updated_at timestamp;
--   ALTER TABLE messages ADD attachment_url text;
--   ALTER TABLE messages ADD attachment_type text;
--   ALTER TABLE messages ADD attachment_name text;
--   ALTER TABLE messages ADD deleted_for set<text>;
--   ALTER TABLE messages ADD deleted_for_everyone boolean;
-- Then create the message_reactions table as shown below.

-- ============================================
-- Keyspace
-- ============================================
CREATE KEYSPACE IF NOT EXISTS chatly
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

-- Use Keyspace
USE chatly;

-- ============================================
-- Users Table
-- ============================================
-- Stores user account information and profile data
-- Fields:
--   user_id: Unique identifier (UUID)
--   username: Display name
--   email: Login email (indexed)
--   password: Hashed password (bcrypt)
--   bio: User biography/description (optional)
--   avatar_url: URL to profile picture (optional)
--   created_at: Account creation timestamp
--   updated_at: Last profile update timestamp
CREATE TABLE IF NOT EXISTS users (
  user_id uuid PRIMARY KEY,
  username text,
  email text,
  password text,
  bio text,
  avatar_url text,
  created_at timestamp,
  updated_at timestamp
);

-- Email Index for Login
-- Allows efficient lookup by email during authentication
CREATE INDEX IF NOT EXISTS ON users (email);

-- ============================================
-- Messages Table
-- ============================================
-- Stores chat messages with optional file attachments
-- Partition Key: chat_id (format: smallerUserId_biggerUserId)
-- Clustering Key: message_id (timeuuid for chronological ordering)
-- Fields:
--   chat_id: Unique chat identifier (smallerUserId_biggerUserId)
--   message_id: Time-based UUID for ordering
--   sender_id: UUID of message sender
--   receiver_id: UUID of message receiver
--   content: Message text content
--   attachment_url: URL to attached file/image (optional)
--     Format: /api/uploads/{filename}
--     Files are persisted to disk in the uploads directory
--   attachment_type: MIME type of attachment (optional)
--     Examples: 'image/jpeg', 'image/png', 'application/pdf', 'text/plain'
--     Used for proper file handling and display
--   attachment_name: Original filename of attachment (optional)
--     Preserves the original filename for download/display
--   deleted_for: Set of user IDs who deleted this message (for "Delete for you")
--     Empty set means message is visible to all participants
--   deleted_for_everyone: Boolean flag for "Delete for everyone"
--     If true, message is deleted for all users
--   created_at: Message timestamp
CREATE TABLE IF NOT EXISTS messages (
  chat_id text,
  message_id timeuuid,
  sender_id text,
  receiver_id text,
  content text,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  deleted_for set<text>,
  deleted_for_everyone boolean,
  created_at timestamp,
  PRIMARY KEY (chat_id, message_id)
) WITH CLUSTERING ORDER BY (message_id ASC);

-- ============================================
-- Message Reactions Table
-- ============================================
-- Stores emoji reactions to messages
-- Composite Primary Key:
--   Partition: (chat_id, message_id) - groups reactions by message
--   Clustering: user_id - ensures one reaction per user per message
-- Fields:
--   chat_id: Chat identifier (matches messages table)
--   message_id: Message identifier (timeuuid, matches messages table)
--   user_id: UUID of user who reacted
--   reaction: Emoji reaction (e.g., '👍', '❤️', '😂')
--   created_at: Reaction timestamp
-- 
-- Note: Users can toggle reactions (add/remove)
--       Changing reaction removes old one and adds new one
CREATE TABLE IF NOT EXISTS message_reactions (
  chat_id text,
  message_id timeuuid,
  user_id text,
  reaction text,
  created_at timestamp,
  PRIMARY KEY ((chat_id, message_id), user_id)
);

