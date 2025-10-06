const express = require('express');
const { check } = require('express-validator');
const { 
  register, 
  verifyOTP, 
  resendOTP, 
  login, 
  getMe 
} = require('../controllers/auth');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Register user
router.post(
  '/register',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 })
  ],
  register
);

// Verify OTP
router.post(
  '/verify-otp',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('otp', 'OTP is required').not().isEmpty().isLength({ min: 6, max: 6 })
  ],
  verifyOTP
);

// Resend OTP
router.post(
  '/resend-otp',
  [
    check('email', 'Please include a valid email').isEmail()
  ],
  resendOTP
);

// Login user
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
  ],
  login
);

// Get current user
router.get('/me', protect, getMe);

module.exports = router;
