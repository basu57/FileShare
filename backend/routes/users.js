const express = require('express');
const { check } = require('express-validator');
const { protect } = require('../middleware/auth');
const { updateProfile, updatePassword } = require('../controllers/users');

const router = express.Router();

// Protect all routes
router.use(protect);

// Get user profile
router.get('/profile', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      createdAt: req.user.createdAt
    }
  });
});

// Update user profile
router.put('/profile', 
  [
    check('name', 'Name is required').not().isEmpty()
  ],
  updateProfile
);

// Update password
router.put('/password',
  [
    check('currentPassword', 'Current password is required').not().isEmpty(),
    check('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 })
  ],
  updatePassword
);

module.exports = router;
