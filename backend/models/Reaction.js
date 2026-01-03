const cassandra = require('../config/database');
const { TimeUuid } = require('cassandra-driver').types;

class Reaction {
  static async add(chatId, messageId, userId, reaction) {
    const query = 'INSERT INTO message_reactions (chat_id, message_id, user_id, reaction, created_at) VALUES (?, ?, ?, ?, ?)';
    await cassandra.execute(query, [chatId, messageId, userId, reaction, new Date()], { prepare: true });
    return { chatId, messageId, userId, reaction };
  }

  static async remove(chatId, messageId, userId) {
    const query = 'DELETE FROM message_reactions WHERE chat_id = ? AND message_id = ? AND user_id = ?';
    await cassandra.execute(query, [chatId, messageId, userId], { prepare: true });
  }

  static async getByMessage(chatId, messageId) {
    const query = 'SELECT * FROM message_reactions WHERE chat_id = ? AND message_id = ?';
    const result = await cassandra.execute(query, [chatId, messageId], { prepare: true });
    return result.rows;
  }

  static async toggle(chatId, messageId, userId, reaction) {
    // Check if user already reacted
    const existing = await this.getByMessage(chatId, messageId);
    const userReaction = existing.find(r => r.user_id === userId);
    
    if (userReaction) {
      if (userReaction.reaction === reaction) {
        // Remove reaction if same
        await this.remove(chatId, messageId, userId);
        return null;
      } else {
        // Update reaction
        await this.remove(chatId, messageId, userId);
      }
    }
    
    // Add new reaction
    return await this.add(chatId, messageId, userId, reaction);
  }
}

module.exports = Reaction;

