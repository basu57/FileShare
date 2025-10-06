const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    logger.info(`Created uploads directory: ${uploadsDir}`);
  } catch (err) {
    logger.error(`Failed to create uploads directory: ${err.message}`);
  }
}

// Configure storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    logger.info(`Storing file in ${uploadsDir}`);
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    // Create a unique filename to avoid overwriting
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `${uniqueSuffix}${path.extname(file.originalname)}`;
    logger.info(`File will be saved as: ${filename}`);
    cb(null, filename);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedFileTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
  const extname = path.extname(file.originalname).toLowerCase();
  
  logger.info(`File upload attempt: ${file.originalname}, type: ${file.mimetype}`);
  
  if (allowedFileTypes.includes(extname)) {
    logger.info(`File type accepted: ${extname}`);
    cb(null, true);
  } else {
    const error = new Error(`File type not supported. Allowed types: ${allowedFileTypes.join(', ')}`);
    logger.warn(`File type rejected: ${extname}. Error: ${error.message}`);
    cb(error, false);
  }
};

// File size limit - 10MB
const limits = {
  fileSize: 10 * 1024 * 1024
};

// Export multer middleware
const upload = multer({
  storage,
  fileFilter,
  limits
});

// Middleware to handle file upload errors
const handleFileUploadError = (err, req, res, next) => {
  if (err) {
    logger.error(`File upload error: ${err.message}`);
    
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 10MB'
        });
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Unexpected field name in upload'
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }
  
  // If no error, proceed
  next();
};

module.exports = {
  upload,
  handleFileUploadError
}; 