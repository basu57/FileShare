const User = require('../models/User');
const { sendOTPEmail } = require('../utils/emailService');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`Registration validation errors: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn(`Registration attempt with existing email: ${email}`);
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password
    });

    // Generate OTP for email verification
    const otp = user.generateOTP();
    await user.save();

    // Send OTP email
    const emailSent = await sendOTPEmail(email, name, otp);
    if (!emailSent) {
      logger.error(`Failed to send OTP email to: ${email}`);
      return res.status(500).json({ success: false, message: 'Failed to send verification email' });
    }

    logger.info(`New user registered: ${user._id}`);
    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email with the OTP sent to your email address.'
    });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Verify user email with OTP
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
exports.verifyOTP = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`OTP verification validation errors: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, otp } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`OTP verification attempt for non-existent email: ${email}`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user is already verified
    if (user.isVerified) {
      logger.info(`OTP verification attempt for already verified user: ${user._id}`);
      return res.status(400).json({ success: false, message: 'Email already verified' });
    }

    // Check if OTP exists
    if (!user.otp || !user.otp.code) {
      logger.warn(`OTP verification attempt with no OTP generated: ${user._id}`);
      return res.status(400).json({ success: false, message: 'No OTP generated for this user' });
    }

    // Check if OTP is expired
    if (user.otp.expiry < Date.now()) {
      logger.warn(`OTP verification attempt with expired OTP: ${user._id}`);
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    // Check if OTP matches
    if (user.otp.code !== otp) {
      logger.warn(`OTP verification attempt with invalid OTP: ${user._id}`);
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Update user as verified
    user.isVerified = true;
    user.otp = undefined; // Clear OTP
    await user.save();

    logger.info(`User email verified: ${user._id}`);
    
    // Create and send token
    sendTokenResponse(user, 200, res);
  } catch (error) {
    logger.error(`OTP verification error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Resend OTP for email verification
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */
exports.resendOTP = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`Resend OTP validation errors: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`Resend OTP attempt for non-existent email: ${email}`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user is already verified
    if (user.isVerified) {
      logger.info(`Resend OTP attempt for already verified user: ${user._id}`);
      return res.status(400).json({ success: false, message: 'Email already verified' });
    }

    // Generate new OTP
    const otp = user.generateOTP();
    await user.save();

    // Send OTP email
    const emailSent = await sendOTPEmail(email, user.name, otp);
    if (!emailSent) {
      logger.error(`Failed to resend OTP email to: ${email}`);
      return res.status(500).json({ success: false, message: 'Failed to send verification email' });
    }

    logger.info(`OTP resent to user: ${user._id}`);
    res.status(200).json({
      success: true,
      message: 'OTP has been sent to your email address'
    });
  } catch (error) {
    logger.error(`Resend OTP error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`Login validation errors: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email and include password for verification
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      logger.warn(`Login attempt with non-existent email: ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if user is verified
    if (!user.isVerified) {
      logger.warn(`Login attempt for unverified user: ${user._id}`);
      return res.status(401).json({ success: false, message: 'Please verify your email before logging in' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      logger.warn(`Login attempt with invalid password for user: ${user._id}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    logger.info(`User logged in: ${user._id}`);
    
    // Create and send token
    sendTokenResponse(user, 200, res);
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    logger.info(`User profile retrieved: ${user._id}`);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Get user profile error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Helper function to create token and send response
 */
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  // Remove sensitive data
  user.password = undefined;
  user.otp = undefined;

  res.status(statusCode).json({
    success: true,
    token,
    user
  });
};
