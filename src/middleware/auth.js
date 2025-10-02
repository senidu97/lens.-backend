const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check for token in cookies
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'No user found with this token'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    if (!roles.includes(req.user.subscription.plan)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.subscription.plan} is not authorized to access this route`
      });
    }

    next();
  };
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check for token in cookies
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from token
        const user = await User.findById(decoded.id).select('-password');

        if (user && user.isActive) {
          req.user = user;
        }
      } catch (error) {
        // Token is invalid, but we don't fail the request
        console.log('Invalid token in optional auth:', error.message);
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Check if user owns resource
const checkOwnership = (resourceUserField = 'user') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // Get the resource from req.resource (should be set by previous middleware)
    const resource = req.resource;
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }

    // Check if user owns the resource
    const resourceUserId = resource[resourceUserField];
    
    if (resourceUserId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this resource'
      });
    }

    next();
  };
};

// Check subscription limits
const checkSubscriptionLimits = (limitType) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    const user = req.user;
    const plan = user.subscription.plan;

    // Define limits for each plan
    const limits = {
      free: {
        photos: 30,
        portfolios: 3,
        storage: 100 * 1024 * 1024, // 100MB
        customDomain: false
      },
      pro: {
        photos: Infinity,
        portfolios: Infinity,
        storage: 10 * 1024 * 1024 * 1024, // 10GB
        customDomain: true
      }
    };

    const userLimits = limits[plan];

    if (limitType === 'photos' && user.stats.totalPhotos >= userLimits.photos) {
      return res.status(403).json({
        success: false,
        message: `You have reached the photo limit for your ${plan} plan (${userLimits.photos} photos)`
      });
    }

    if (limitType === 'portfolios') {
      // This would need to be checked against actual portfolio count
      // For now, we'll let it pass and check in the route handler
    }

    if (limitType === 'customDomain' && !userLimits.customDomain) {
      return res.status(403).json({
        success: false,
        message: 'Custom domains are only available for Pro subscribers'
      });
    }

    next();
  };
};

// Rate limiting for specific actions
const createRateLimit = (windowMs, max, message) => {
  return (req, res, next) => {
    // This is a simplified rate limiter
    // In production, you'd want to use a more sophisticated solution
    // like express-rate-limit with Redis
    
    const key = `${req.user._id}_${req.route.path}`;
    const now = Date.now();
    
    if (!req.rateLimitStore) {
      req.rateLimitStore = new Map();
    }
    
    const userLimits = req.rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };
    
    if (now > userLimits.resetTime) {
      userLimits.count = 0;
      userLimits.resetTime = now + windowMs;
    }
    
    if (userLimits.count >= max) {
      return res.status(429).json({
        success: false,
        message: message || 'Too many requests, please try again later'
      });
    }
    
    userLimits.count++;
    req.rateLimitStore.set(key, userLimits);
    
    next();
  };
};

module.exports = {
  protect,
  authorize,
  optionalAuth,
  checkOwnership,
  checkSubscriptionLimits,
  createRateLimit
};
