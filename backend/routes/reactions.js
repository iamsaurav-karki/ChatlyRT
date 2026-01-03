const express = require('express');
const router = express.Router();
const Reaction = require('../models/Reaction');
const { authenticate } = require('../middleware/auth');
const { generateChatId } = require('../utils/chat');

// Toggle reaction on a message
router.post('/:userId/:messageId', authenticate, async (req, res) => {
  try {
    const { userId, messageId } = req.params;
    const { reaction } = req.body;
    const currentUserId = req.userId;

    if (!reaction) {
      return res.status(400).json({ error: 'Reaction is required' });
    }

    const chatId = generateChatId(currentUserId, userId);
    const result = await Reaction.toggle(chatId, messageId, currentUserId, reaction);
    
    // Get all reactions for this message
    const allReactions = await Reaction.getByMessage(chatId, messageId);
    
    res.json({ 
      success: true, 
      reactions: allReactions,
      userReaction: result ? reaction : null
    });
  } catch (error) {
    console.error('Toggle reaction error:', error);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

// Get reactions for a message
router.get('/:userId/:messageId', authenticate, async (req, res) => {
  try {
    const { userId, messageId } = req.params;
    const currentUserId = req.userId;

    const chatId = generateChatId(currentUserId, userId);
    const reactions = await Reaction.getByMessage(chatId, messageId);
    
    res.json(reactions);
  } catch (error) {
    console.error('Get reactions error:', error);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

module.exports = router;

