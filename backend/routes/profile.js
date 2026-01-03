const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const path = require('path');

// Lazy load upload middleware to avoid startup errors
const getUploadMiddleware = () => {
  try {
    return require('../middleware/upload');
  } catch (error) {
    console.error('Upload middleware not available:', error.message);
    // Return a dummy multer instance that does nothing
    try {
      const multer = require('multer');
      return multer({ storage: multer.memoryStorage() });
    } catch (multerError) {
      console.error('Multer not available:', multerError.message);
      // Return a no-op middleware
      return {
        single: () => (req, res, next) => next()
      };
    }
  }
};

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update profile
router.put('/me', authenticate, (req, res, next) => {
  const upload = getUploadMiddleware();
  upload.single('avatar')(req, res, next);
}, async (req, res) => {
  try {
    const updates = {};
    
    if (req.body.username) updates.username = req.body.username;
    if (req.body.bio !== undefined) updates.bio = req.body.bio;
    
    // Handle avatar upload
    if (req.file) {
      updates.avatar_url = `/api/uploads/${req.file.filename}`;
    }
    
    const updatedUser = await User.updateProfile(req.userId, updates);
    res.json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;

