const User = require('../models/User');

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user has admin role
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Check if user is active
    if (!req.user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check if user is super admin
const requireSuperAdmin = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user has super admin role
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super admin access required'
      });
    }

    // Check if user is active
    if (!req.user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check if user can manage other admins
const canManageAdmins = async (req, res, next) => {
  try {
    // Only super admins can manage other admins
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super admin access required to manage admin accounts'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check if user can review photos
const canReviewPhotos = async (req, res, next) => {
  try {
    // Both admin and super_admin can review photos
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required to review photos'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requireAdmin,
  requireSuperAdmin,
  canManageAdmins,
  canReviewPhotos
};
