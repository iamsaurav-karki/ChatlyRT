const redis = require('../config/redis');
const { producer } = require('../config/kafka');
const Message = require('../models/Message');
const { generateChatId } = require('../utils/chat');

const setupSocketIO = (io) => {
  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const { verifyToken } = require('../utils/auth');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return next(new Error('Authentication error: Invalid token'));
    }

    socket.userId = decoded.userId;
    next();
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId}`);

    // Store user's socket ID in Redis
    try {
      await redis.set(`online_users:${userId}`, socket.id);
      
      // Get all currently online users from Redis
      const allKeys = await redis.keys('online_users:*');
      const onlineUserIds = allKeys
        .map(key => key.replace('online_users:', ''))
        .filter(id => id !== userId); // Exclude self
      
      // Send current online users to the newly connected client
      socket.emit('onlineUsersList', { userIds: onlineUserIds });
      
      // Notify all clients that this user is online
      io.emit('userOnline', { userId });
    } catch (error) {
      console.error('Redis error:', error);
    }

    // Handle sending messages
    socket.on('sendMessage', async (data) => {
      try {
        const { receiverId, content, attachmentUrl, attachmentType, attachmentName } = data;

        if (!receiverId || (!content && !attachmentUrl)) {
          socket.emit('error', { message: 'Missing receiverId or content/attachment' });
          return;
        }

        const chatId = generateChatId(userId, receiverId);
        const timestamp = new Date().toISOString();

        // Create message payload
        const messagePayload = {
          chatId,
          senderId: userId,
          receiverId,
          content: content || '',
          attachmentUrl: attachmentUrl || null,
          attachmentType: attachmentType || null,
          attachmentName: attachmentName || null,
          timestamp
        };

        // Save message directly to get the real messageId immediately
        const savedMessage = await Message.create(
          userId,
          receiverId,
          content || '',
          attachmentUrl || null,
          attachmentType || null,
          attachmentName || null
        );

        // NOTE: We're saving directly to Cassandra, so Kafka consumer will skip duplicate saves
        // Publishing to Kafka is kept for future scalability (e.g., analytics, notifications)
        // The Kafka consumer checks for duplicates before saving
        await producer.send({
          topic: 'chat-messages',
          messages: [{
            key: chatId,
            value: JSON.stringify({
              ...messagePayload,
              messageId: savedMessage.messageId, // Include the real messageId
              alreadySaved: true // Flag to indicate it's already in DB
            })
          }]
        });

        // Check if receiver is online
        let receiverSocketId = null;
        try {
          receiverSocketId = await redis.get(`online_users:${receiverId}`);
        } catch (error) {
          console.error('Redis error:', error);
        }

        // Emit to sender with REAL messageId from database
        socket.emit('receiveMessage', {
          ...messagePayload,
          message_id: savedMessage.messageId,
          messageId: savedMessage.messageId,
          sender_id: savedMessage.senderId,
          receiver_id: savedMessage.receiverId,
          created_at: savedMessage.timestamp
        });

        // Emit to receiver if online with REAL messageId
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('receiveMessage', {
            ...messagePayload,
            message_id: savedMessage.messageId,
            messageId: savedMessage.messageId,
            sender_id: savedMessage.senderId,
            receiver_id: savedMessage.receiverId,
            created_at: savedMessage.timestamp
          });
        }

        console.log(`Message sent from ${userId} to ${receiverId}`);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle message deletion
    socket.on('deleteMessage', async (data) => {
      try {
        const { receiverId, messageId, deleteForEveryone } = data;
        const chatId = generateChatId(userId, receiverId);

        if (deleteForEveryone) {
          // Verify user is the sender
          const message = await Message.findById(chatId, messageId);
          if (!message || message.sender_id !== userId) {
            socket.emit('error', { message: 'Only the sender can delete for everyone' });
            return;
          }
          await Message.deleteForEveryone(chatId, messageId);
          
          // Notify both users immediately
          socket.emit('messageDeleted', { chatId, messageId, deleteForEveryone: true });
          
          // Also notify receiver if online
          try {
            const receiverSocketId = await redis.get(`online_users:${receiverId}`);
            if (receiverSocketId) {
              io.to(receiverSocketId).emit('messageDeleted', { chatId, messageId, deleteForEveryone: true });
            }
          } catch (error) {
            console.error('Redis error:', error);
          }
        } else {
          // Delete for me only
          await Message.deleteForMe(chatId, messageId, userId);
          // Only notify the user who deleted
          socket.emit('messageDeleted', { chatId, messageId, deleteForEveryone: false });
        }
      } catch (error) {
        console.error('Error deleting message:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId}`);
      
      // Remove from Redis
      try {
        await redis.del(`online_users:${userId}`);
        // Notify all clients that user is offline
        io.emit('userOffline', { userId });
      } catch (error) {
        console.error('Redis error:', error);
      }
    });
  });
};

module.exports = setupSocketIO;

