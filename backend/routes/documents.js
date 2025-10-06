const express = require('express');
const { check } = require('express-validator');
const { 
  uploadDocument,
  getMyDocuments,
  getSharedDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  shareDocument,
  updateSharing,
  removeSharing
} = require('../controllers/documents');
const { protect } = require('../middleware/auth');
const { upload, handleFileUploadError } = require('../middleware/fileUpload');

const router = express.Router();

// Protect all routes
router.use(protect);

// Upload document
router.post(
  '/',
  upload.single('document'),
  handleFileUploadError,
  [
    check('title', 'Title is required').not().isEmpty(),
    check('description', 'Description is required').not().isEmpty(),
    check('documentType', 'Document type is required').not().isEmpty()
  ],
  uploadDocument
);

// Get my documents
router.get('/', getMyDocuments);

// Get documents shared with me
router.get('/shared', getSharedDocuments);

// Get single document
router.get('/:id', getDocument);

// Update document
router.put(
  '/:id',
  [
    check('title', 'Title is required').not().isEmpty(),
    check('description', 'Description is required').not().isEmpty(),
    check('documentType', 'Document type is required').not().isEmpty()
  ],
  updateDocument
);

// Delete document
router.delete('/:id', deleteDocument);

// Share document with user
router.post(
  '/:id/share',
  [
    check('email', 'Valid email is required').isEmail(),
    check('accessLevel', 'Access level must be either view or edit').isIn(['view', 'edit'])
  ],
  shareDocument
);

// Update sharing permissions
router.put(
  '/:id/share/:userId',
  [
    check('accessLevel', 'Access level must be either view or edit').isIn(['view', 'edit'])
  ],
  updateSharing
);

// Remove sharing
router.delete('/:id/share/:userId', removeSharing);

module.exports = router;
