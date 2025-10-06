const Document = require('../models/Document');
const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const fs = require('fs');

/**
 * @desc    Upload a new document
 * @route   POST /api/documents
 * @access  Private
 */
exports.uploadDocument = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`Document upload validation errors: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Check if file exists
    if (!req.file) {
      logger.warn(`Document upload attempt without file by user: ${req.user._id}`);
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }

    const { title, description, documentType } = req.body;
    
    // Log file information for debugging
    logger.info(`File received: ${JSON.stringify({
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    })}`);

    try {
      // Upload file to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'secure-doc-share',
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true
      });

      logger.info(`File uploaded to Cloudinary: ${result.public_id}`);

      // Create document in database
      const document = await Document.create({
        title,
        description,
        documentType,
        fileUrl: result.secure_url,
        publicId: result.public_id,
        owner: req.user._id
      });

      logger.info(`New document created: ${document._id} by user: ${req.user._id}`);
      
      // Optionally delete the file from local storage
      fs.unlink(req.file.path, (err) => {
        if (err) {
          logger.warn(`Failed to delete local file: ${req.file.path}`);
        }
      });

      res.status(201).json({
        success: true,
        data: document
      });
    } catch (cloudinaryError) {
      logger.error(`Cloudinary upload error: ${cloudinaryError.message}`);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to upload file to cloud storage', 
        error: cloudinaryError.message 
      });
    }
  } catch (error) {
    logger.error(`Document upload error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get all documents for current user
 * @route   GET /api/documents
 * @access  Private
 */
exports.getMyDocuments = async (req, res) => {
  try {
    // Get documents owned by user
    const documents = await Document.find({ owner: req.user._id })
      .populate('owner', 'name email')
      .populate('sharedWith.user', 'name email');

    // Add isOwner flag (always true for owned documents)
    const result = documents.map(doc => {
      const docObj = doc.toObject();
      docObj.isOwner = true;
      return docObj;
    });

    logger.info(`Retrieved ${documents.length} documents for user: ${req.user._id}`);
    res.status(200).json({
      success: true,
      count: documents.length,
      data: result
    });
  } catch (error) {
    logger.error(`Get documents error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get documents shared with current user
 * @route   GET /api/documents/shared
 * @access  Private
 */
exports.getSharedDocuments = async (req, res) => {
  try {
    // Get documents shared with user
    const documents = await Document.find({
      'sharedWith.user': req.user._id
    })
    .populate('owner', 'name email')
    .populate('sharedWith.user', 'name email');

    // Add isOwner flag (always false for shared documents)
    const result = documents.map(doc => {
      const docObj = doc.toObject();
      docObj.isOwner = false;
      return docObj;
    });

    logger.info(`Retrieved ${documents.length} shared documents for user: ${req.user._id}`);
    res.status(200).json({
      success: true,
      count: documents.length,
      data: result
    });
  } catch (error) {
    logger.error(`Get shared documents error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get a single document
 * @route   GET /api/documents/:id
 * @access  Private
 */
exports.getDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('sharedWith.user', 'name email');

    // Check if document exists
    if (!document) {
      logger.warn(`Document not found: ${req.params.id}`);
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Check if user is owner or document is shared with user
    const isOwner = document.owner._id.toString() === req.user._id.toString();
    const isShared = document.sharedWith.some(share => {
      return share.user && share.user._id && share.user._id.toString() === req.user._id.toString();
    });

    if (!isOwner && !isShared) {
      logger.warn(`Unauthorized document access attempt: ${req.params.id} by user: ${req.user._id}`);
      return res.status(403).json({ success: false, message: 'Not authorized to access this document' });
    }

    // Add a flag to indicate if the current user is the owner
    const result = document.toObject();
    result.isOwner = isOwner;
    
    logger.info(`Document retrieved: ${document._id} by user: ${req.user._id}`);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Get document error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Update document
 * @route   PUT /api/documents/:id
 * @access  Private
 */
exports.updateDocument = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`Document update validation errors: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    let document = await Document.findById(req.params.id);

    // Check if document exists
    if (!document) {
      logger.warn(`Document not found for update: ${req.params.id}`);
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Check if user is owner
    if (document.owner.toString() !== req.user._id.toString()) {
      // Check if user has edit access
      const sharedWithUser = document.sharedWith.find(
        share => share.user.toString() === req.user._id.toString() && share.accessLevel === 'edit'
      );

      if (!sharedWithUser) {
        logger.warn(`Unauthorized document update attempt: ${req.params.id} by user: ${req.user._id}`);
        return res.status(403).json({ success: false, message: 'Not authorized to update this document' });
      }
    }

    // Update document
    const { title, description, documentType } = req.body;
    
    document = await Document.findByIdAndUpdate(
      req.params.id,
      { title, description, documentType, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    logger.info(`Document updated: ${document._id} by user: ${req.user._id}`);
    res.status(200).json({
      success: true,
      data: document
    });
  } catch (error) {
    logger.error(`Update document error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Delete document
 * @route   DELETE /api/documents/:id
 * @access  Private
 */
exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    // Check if document exists
    if (!document) {
      logger.warn(`Document not found for deletion: ${req.params.id}`);
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Check if user is owner
    if (document.owner.toString() !== req.user._id.toString()) {
      logger.warn(`Unauthorized document deletion attempt: ${req.params.id} by user: ${req.user._id}`);
      return res.status(403).json({ success: false, message: 'Not authorized to delete this document' });
    }

    // Delete file from Cloudinary
    await cloudinary.uploader.destroy(document.publicId);
    logger.info(`File deleted from Cloudinary: ${document.publicId}`);

    // Delete document from database
    await document.deleteOne();
    logger.info(`Document deleted: ${req.params.id} by user: ${req.user._id}`);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    logger.error(`Delete document error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Share document with another user
 * @route   POST /api/documents/:id/share
 * @access  Private
 */
exports.shareDocument = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`Document sharing validation errors: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const document = await Document.findById(req.params.id);

    // Check if document exists
    if (!document) {
      logger.warn(`Document not found for sharing: ${req.params.id}`);
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Check if user is owner
    if (document.owner.toString() !== req.user._id.toString()) {
      logger.warn(`Unauthorized document sharing attempt: ${req.params.id} by user: ${req.user._id}`);
      return res.status(403).json({ success: false, message: 'Not authorized to share this document' });
    }

    const { email, accessLevel } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`Share attempt with non-existent email: ${email}`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if sharing with self
    if (user._id.toString() === req.user._id.toString()) {
      logger.warn(`User attempted to share document with themselves: ${req.user._id}`);
      return res.status(400).json({ success: false, message: 'Cannot share document with yourself' });
    }

    // Check if document is already shared with this user
    const alreadyShared = document.sharedWith.find(
      share => share.user && share.user.toString() === user._id.toString()
    );

    if (alreadyShared) {
      logger.warn(`Document already shared with user: ${user._id}`);
      return res.status(400).json({ success: false, message: 'Document already shared with this user' });
    }

    // Add user to sharedWith array
    document.sharedWith.push({
      user: user._id,
      accessLevel,
      sharedAt: Date.now()
    });

    // Save document
    await document.save();

    logger.info(`Document shared: ${document._id} with user: ${user._id}`);
    res.status(200).json({
      success: true,
      message: `Document shared with ${user.name}`,
      data: document
    });
  } catch (error) {
    logger.error(`Share document error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get users a document is shared with
 * @route   GET /api/documents/:id/shared
 * @access  Private
 */
exports.getSharedUsers = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id).populate('owner', 'name email');

    // Check if document exists
    if (!document) {
      logger.warn(`Document not found with id: ${req.params.id}`);
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Check if user is the owner or the document is shared with the user
    const isOwner = document.owner._id.toString() === req.user._id.toString();
    const isShared = document.sharedWith.some(share => share.user.toString() === req.user._id.toString());

    if (!isOwner && !isShared) {
      logger.warn(`User ${req.user._id} attempted to access shared users for document ${req.params.id} they don't have access to`);
      return res.status(403).json({ success: false, message: 'Not authorized to view this document' });
    }

    // Get shared users with their details
    const sharedUsers = [];
    
    for (const share of document.sharedWith) {
      const user = await User.findById(share.user).select('name email');
      if (user) {
        sharedUsers.push({
          user: {
            _id: user._id,
            name: user.name,
            email: user.email
          },
          accessLevel: share.accessLevel,
          sharedAt: share.sharedAt
        });
      }
    }

    logger.info(`Retrieved ${sharedUsers.length} shared users for document: ${req.params.id}`);
    res.status(200).json({
      success: true,
      count: sharedUsers.length,
      data: sharedUsers
    });
  } catch (error) {
    logger.error(`Get shared users error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Update sharing permissions
 * @route   PUT /api/documents/:id/share/:userId
 * @access  Private
 */
exports.updateSharing = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(`Update sharing validation errors: ${JSON.stringify(errors.array())}`);
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const document = await Document.findById(req.params.id);

    // Check if document exists
    if (!document) {
      logger.warn(`Document not found for updating sharing: ${req.params.id}`);
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Check if user is owner
    if (document.owner.toString() !== req.user._id.toString()) {
      logger.warn(`Unauthorized sharing update attempt: ${req.params.id} by user: ${req.user._id}`);
      return res.status(403).json({ success: false, message: 'Not authorized to update sharing for this document' });
    }

    const { accessLevel } = req.body;
    const userId = req.params.userId;

    // Check if document is shared with this user
    const shareIndex = document.sharedWith.findIndex(
      share => share.user && share.user.toString() === userId
    );

    if (shareIndex === -1) {
      logger.warn(`Document not shared with user: ${userId}`);
      return res.status(404).json({ success: false, message: 'Document not shared with this user' });
    }

    // Update access level
    document.sharedWith[shareIndex].accessLevel = accessLevel;

    // Save document
    await document.save();

    logger.info(`Sharing updated: ${document._id} for user: ${userId}`);
    res.status(200).json({
      success: true,
      message: 'Sharing permissions updated',
      data: document
    });
  } catch (error) {
    logger.error(`Update sharing error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Remove sharing
 * @route   DELETE /api/documents/:id/share/:userId
 * @access  Private
 */
exports.removeSharing = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    // Check if document exists
    if (!document) {
      logger.warn(`Document not found for removing sharing: ${req.params.id}`);
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Check if user is owner
    if (document.owner.toString() !== req.user._id.toString()) {
      logger.warn(`Unauthorized sharing removal attempt: ${req.params.id} by user: ${req.user._id}`);
      return res.status(403).json({ success: false, message: 'Not authorized to remove sharing for this document' });
    }

    const userId = req.params.userId;

    // Check if document is shared with this user
    const shareIndex = document.sharedWith.findIndex(
      share => share.user && share.user.toString() === userId
    );

    if (shareIndex === -1) {
      logger.warn(`Document not shared with user: ${userId}`);
      return res.status(404).json({ success: false, message: 'Document not shared with this user' });
    }

    // Remove user from sharedWith array
    document.sharedWith.splice(shareIndex, 1);

    // Save document
    await document.save();

    logger.info(`Sharing removed: ${document._id} for user: ${userId}`);
    res.status(200).json({
      success: true,
      message: 'Sharing removed',
      data: document
    });
  } catch (error) {
    logger.error(`Remove sharing error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
