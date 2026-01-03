const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Create user (without token)
    const user = await User.create(username, email, password);
    
    // Return success message without token - user must login
    res.status(201).json({ 
      message: 'Registration successful! Please login to continue.',
      email: user.email 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.login(email, password);
    res.json(user);
  } catch (error) {
    console.error('Login error:', error);
    // Return generic error message for security (don't reveal if email exists)
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

module.exports = router;

