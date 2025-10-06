const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Middleware to protect routes
 * Verifies JWT token and attaches user to request object
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      logger.warn('No authorization token provided');
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from database
      const user = await User.findById(decoded.id);

      // Check if user exists
      if (!user) {
        logger.warn(`User not found for token ID: ${decoded.id}`);
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      // Check if user is verified
      if (!user.isVerified) {
        logger.warn(`Unverified user attempting to access protected route: ${user._id}`);
        return res.status(401).json({ success: false, message: 'Please verify your email to access this route' });
      }

      // Attach user to request object
      req.user = user;
      logger.info(`Authenticated user: ${user._id}`);
      next();
    } catch (error) {
      logger.error(`Token verification error: ${error.message}`);
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Middleware to check if user is owner of a resource
 * @param {String} model - Model name to check ownership against
 * @param {String} paramName - Parameter name in request params that contains resource ID
 */
exports.checkOwnership = (model, paramName) => async (req, res, next) => {
  try {
    const Model = require(`../models/${model}`);
    const resourceId = req.params[paramName];
    
    // Get resource from database
    const resource = await Model.findById(resourceId);
    
    // Check if resource exists
    if (!resource) {
      logger.warn(`Resource not found: ${model} ${resourceId}`);
      return res.status(404).json({ success: false, message: `${model} not found` });
    }
    
    // Check if user is owner
    if (resource.owner.toString() !== req.user._id.toString()) {
      logger.warn(`Unauthorized access attempt: User ${req.user._id} trying to access ${model} ${resourceId}`);
      return res.status(403).json({ success: false, message: 'Not authorized to access this resource' });
    }
    
    // Attach resource to request object
    req.resource = resource;
    logger.info(`Ownership verified for ${model} ${resourceId}`);
    next();
  } catch (error) {
    logger.error(`Ownership check error: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
