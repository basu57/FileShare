const User = require('../models/User');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`Profile update validation errors: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name } = req.body;

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name },
      { new: true, runValidators: true }
    );

    logger.info(`User profile updated: ${user._id}`);
    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    logger.error(`Update profile error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Update user password
 * @route   PUT /api/users/password
 * @access  Private
 */
exports.updatePassword = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`Password update validation errors: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { currentPassword, newPassword } = req.body;
    
    // Log received data (without exposing passwords)
    logger.info(`Password update attempt for user: ${req.user._id}`);

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      logger.warn(`User not found for password update: ${req.user._id}`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if current password matches
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      logger.warn(`Invalid current password for user: ${user._id}`);
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Make sure the new password is different from the current one
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      logger.warn(`New password is same as current password for user: ${user._id}`);
      return res.status(400).json({ success: false, message: 'New password must be different from current password' });
    }

    // Update password
    user.password = newPassword;
    
    try {
      await user.save();
      logger.info(`Password updated successfully for user: ${user._id}`);
      return res.status(200).json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (saveError) {
      logger.error(`Error saving user after password update: ${saveError.message}`);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to save new password',
        error: saveError.message
      });
    }
  } catch (error) {
    logger.error(`Update password error: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error during password update', 
      error: error.message 
    });
  }
}; 