const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { authenticate } = require('../middleware/auth');
const { generateChatId } = require('../utils/chat');

router.get('/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    console.log(`[GET /api/messages/${userId}] Requested by user: ${currentUserId}`);
    const messages = await Message.getChatHistory(currentUserId, userId);
    console.log(`[GET /api/messages/${userId}] Returning ${messages.length} messages`);
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Delete message for me (soft delete)
router.delete('/:userId/:messageId/me', authenticate, async (req, res) => {
  try {
    const { userId, messageId } = req.params;
    const currentUserId = req.userId;

    const chatId = generateChatId(currentUserId, userId);
    await Message.deleteForMe(chatId, messageId, currentUserId);

    res.json({ success: true, message: 'Message deleted for you' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Delete message for everyone
router.delete('/:userId/:messageId/everyone', authenticate, async (req, res) => {
  try {
    const { userId, messageId } = req.params;
    const currentUserId = req.userId;

    const chatId = generateChatId(currentUserId, userId);
    
    // Verify user is the sender
    const message = await Message.findById(chatId, messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender_id !== currentUserId) {
      return res.status(403).json({ error: 'Only the sender can delete for everyone' });
    }

    await Message.deleteForEveryone(chatId, messageId);

    res.json({ success: true, message: 'Message deleted for everyone' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;
