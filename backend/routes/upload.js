const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Lazy load upload middleware
const getUploadMiddleware = () => {
  try {
    return require('../middleware/upload');
  } catch (error) {
    console.error('Upload middleware not available:', error.message);
    try {
      const multer = require('multer');
      return multer({ storage: multer.memoryStorage() });
    } catch (multerError) {
      console.error('Multer not available:', multerError.message);
      return {
        single: () => (req, res, next) => next()
      };
    }
  }
};
const path = require('path');

// Upload file for messages
router.post('/message', authenticate, (req, res, next) => {
  const upload = getUploadMiddleware();
  upload.single('file')(req, res, next);
}, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/api/uploads/${req.file.filename}`;
    // Store MIME type for better file handling and persistence
    const fileType = req.file.mimetype;

    res.json({
      url: fileUrl,
      type: fileType, // Full MIME type (e.g., 'image/jpeg', 'application/pdf')
      name: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

module.exports = router;

