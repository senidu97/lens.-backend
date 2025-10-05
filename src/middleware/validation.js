const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User validation rules
const validateUserRegistration = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  body('firstName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters')
    .trim(),
  
  body('lastName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters')
    .trim(),
  
  handleValidationErrors
];

const validateUserLogin = [
  body('identifier')
    .notEmpty()
    .withMessage('Email or username is required')
    .trim(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

const validateUserUpdate = [
  body('firstName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters')
    .trim(),
  
  body('lastName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters')
    .trim(),
  
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters')
    .trim(),
  
  body('website')
    .optional()
    .isURL()
    .withMessage('Website must be a valid URL'),
  
  body('location')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Location cannot exceed 100 characters')
    .trim(),
  
  handleValidationErrors
];

const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Portfolio validation rules
const validatePortfolio = [
  body('title')
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters')
    .trim(),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters')
    .trim(),
  
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean value'),
  
  body('category')
    .optional()
    .isIn([
      'portrait', 'landscape', 'street', 'wedding', 'fashion',
      'nature', 'architecture', 'abstract', 'documentary',
      'sports', 'food', 'travel', 'other'
    ])
    .withMessage('Invalid category'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('tags.*')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Each tag cannot exceed 50 characters')
    .trim(),
  
  handleValidationErrors
];

const validatePortfolioUpdate = [
  body('title')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters')
    .trim(),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters')
    .trim(),
  
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean value'),
  
  body('category')
    .optional()
    .isIn([
      'portrait', 'landscape', 'street', 'wedding', 'fashion',
      'nature', 'architecture', 'abstract', 'documentary',
      'sports', 'food', 'travel', 'other'
    ])
    .withMessage('Invalid category'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('tags.*')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Each tag cannot exceed 50 characters')
    .trim(),
  
  handleValidationErrors
];

// Photo validation rules
const validatePhoto = [
  body('title')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters')
    .trim(),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
    .trim(),
  
  body('category')
    .optional()
    .isIn([
      'portrait', 'landscape', 'street', 'wedding', 'fashion',
      'nature', 'architecture', 'abstract', 'documentary',
      'sports', 'food', 'travel', 'other'
    ])
    .withMessage('Invalid category'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('tags.*')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Each tag cannot exceed 50 characters')
    .trim(),
  
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean value'),
  
  body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('isFeatured must be a boolean value'),
  
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order must be a non-negative integer'),
  
  handleValidationErrors
];

// Parameter validation
const validateObjectId = (paramName) => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName} ID`),
  
  handleValidationErrors
];

// Query validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

const validateSearch = [
  query('q')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Search query cannot exceed 100 characters')
    .trim(),
  
  query('category')
    .optional()
    .isIn([
      'portrait', 'landscape', 'street', 'wedding', 'fashion',
      'nature', 'architecture', 'abstract', 'documentary',
      'sports', 'food', 'travel', 'other'
    ])
    .withMessage('Invalid category'),
  
  query('tags')
    .optional()
    .isString()
    .withMessage('Tags must be a string'),
  
  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'popular', 'trending'])
    .withMessage('Invalid sort option'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  validatePasswordChange,
  validatePortfolio,
  validatePortfolioUpdate,
  validatePhoto,
  validateObjectId,
  validatePagination,
  validateSearch
};
