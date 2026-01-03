const cassandra = require('../config/database');
const { TimeUuid } = require('cassandra-driver').types;
const { generateChatId } = require('../utils/chat');

class Message {
  static async create(senderId, receiverId, content, attachmentUrl = null, attachmentType = null, attachmentName = null) {
    const chatId = generateChatId(senderId, receiverId);
    const messageId = TimeUuid.now();
    const timestamp = new Date();

    const query = 'INSERT INTO messages (chat_id, message_id, sender_id, receiver_id, content, attachment_url, attachment_type, attachment_name, deleted_for, deleted_for_everyone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    // Use empty array for Set type - Cassandra will convert it to an empty Set
    await cassandra.execute(query, [chatId, messageId, senderId, receiverId, content, attachmentUrl, attachmentType, attachmentName, [], false, timestamp], { prepare: true });

    return {
      chatId,
      messageId: messageId.toString(),
      senderId,
      receiverId,
      content,
      attachmentUrl,
      attachmentType,
      attachmentName,
      timestamp
    };
  }

  static async getChatHistory(userId1, userId2) {
    const chatId = generateChatId(userId1, userId2);
    const query = 'SELECT * FROM messages WHERE chat_id = ? ORDER BY message_id ASC';
    const result = await cassandra.execute(query, [chatId], { prepare: true });
    // Filter out messages deleted for the requesting user
    const filtered = result.rows.filter(msg => {
      // If deleted for everyone, don't show
      if (msg.deleted_for_everyone === true) {
        return false;
      }
      
      // If deleted_for is null or undefined, message is visible (most common case)
      const deletedFor = msg.deleted_for;
      if (deletedFor === null || deletedFor === undefined) {
        return true;
      }
      
      // Handle Set type (Cassandra Set) - check if empty first
      if (deletedFor instanceof Set) {
        return deletedFor.size === 0 || !deletedFor.has(userId1);
      }
      
      // Handle Array type - check if empty first
      if (Array.isArray(deletedFor)) {
        return deletedFor.length === 0 || !deletedFor.includes(userId1);
      }
      
      // Safety fallback: if we can't determine, show the message
      return true;
    });
    
    return filtered;
  }

  static async getChatHistoryByChatId(chatId) {
    const query = 'SELECT * FROM messages WHERE chat_id = ? ORDER BY message_id ASC';
    const result = await cassandra.execute(query, [chatId], { prepare: true });
    return result.rows;
  }

  static async deleteForMe(chatId, messageId, userId) {
    const { TimeUuid } = require('cassandra-driver').types;
    const query = 'UPDATE messages SET deleted_for = deleted_for + {?} WHERE chat_id = ? AND message_id = ?';
    await cassandra.execute(query, [userId, chatId, TimeUuid.fromString(messageId)], { prepare: true });
    return true;
  }

  static async deleteForEveryone(chatId, messageId) {
    const { TimeUuid } = require('cassandra-driver').types;
    const query = 'UPDATE messages SET deleted_for_everyone = ?, content = ?, attachment_url = ?, attachment_type = ?, attachment_name = ? WHERE chat_id = ? AND message_id = ?';
    // Clear content and attachments when deleted for everyone
    await cassandra.execute(query, [true, '', null, null, null, chatId, TimeUuid.fromString(messageId)], { prepare: true });
    return true;
  }

  static async findById(chatId, messageId) {
    const { TimeUuid } = require('cassandra-driver').types;
    const query = 'SELECT * FROM messages WHERE chat_id = ? AND message_id = ?';
    const result = await cassandra.execute(query, [chatId, TimeUuid.fromString(messageId)], { prepare: true });
    return result.rows[0] || null;
  }
}

module.exports = Message;

