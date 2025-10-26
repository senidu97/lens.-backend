const express = require('express');
const { body } = require('express-validator');
const Photo = require('../models/Photo');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { requireAdmin, requireSuperAdmin, canReviewPhotos, canManageAdmins } = require('../middleware/adminAuth');
const { validateObjectId, validatePagination } = require('../middleware/validation');
const { generatePresignedViewUrl } = require('../utils/r2');

const router = express.Router();

// @desc    Get photos pending approval
// @route   GET /api/admin/photos/pending
// @access  Admin
router.get('/photos/pending', protect, canReviewPhotos, validatePagination, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const photos = await Photo.findPendingApproval({
      limit: parseInt(limit),
      skip,
      sort: { createdAt: -1 }
    });

    const total = await Photo.countDocuments({ approvalStatus: 'pending' });

    res.json({
      success: true,
      data: {
        photos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get recent submissions
// @route   GET /api/admin/photos/recent-submissions
// @access  Admin
router.get('/photos/recent-submissions', protect, canReviewPhotos, async (req, res, next) => {
  try {
    const recentPhotos = await Photo.find({ approvalStatus: 'pending' })
      .populate('user', 'username avatar email')
      .populate('portfolio', 'title slug')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: recentPhotos
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get photos by approval status
// @route   GET /api/admin/photos/status/:status
// @access  Admin
router.get('/photos/status/:status', protect, canReviewPhotos, validatePagination, async (req, res, next) => {
  try {
    const { status } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid approval status'
      });
    }

    const photos = await Photo.findByApprovalStatus(status, {
      limit: parseInt(limit),
      skip,
      sort: { createdAt: -1 }
    });

    const total = await Photo.countDocuments({ approvalStatus: status });

    res.json({
      success: true,
      data: {
        photos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get photo details for review
// @route   GET /api/admin/photos/:id
// @access  Admin
router.get('/photos/:id', protect, canReviewPhotos, validateObjectId('id'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const photo = await Photo.findById(id)
      .populate('user', 'username avatar email firstName lastName')
      .populate('portfolio', 'title slug description')
      .populate('adminReview.reviewedBy', 'username');

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    res.json({
      success: true,
      data: {
        photo
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Approve photo
// @route   POST /api/admin/photos/:id/approve
// @access  Admin
router.post('/photos/:id/approve', protect, canReviewPhotos, validateObjectId('id'), [
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters'),
  require('../middleware/validation').handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes = '' } = req.body;

    const photo = await Photo.findById(id);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    if (photo.approvalStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Photo has already been reviewed'
      });
    }

    await photo.approve(req.user._id, notes);

    // Populate the updated photo
    await photo.populate('user', 'username avatar email');
    await photo.populate('portfolio', 'title slug');
    await photo.populate('adminReview.reviewedBy', 'username');

    res.json({
      success: true,
      message: 'Photo approved successfully',
      data: {
        photo
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Reject photo
// @route   POST /api/admin/photos/:id/reject
// @access  Admin
router.post('/photos/:id/reject', protect, canReviewPhotos, validateObjectId('id'), [
  body('reason').notEmpty().isString().isLength({ max: 500 }).withMessage('Rejection reason is required and cannot exceed 500 characters'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters'),
  require('../middleware/validation').handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, notes = '' } = req.body;

    const photo = await Photo.findById(id);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    if (photo.approvalStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Photo has already been reviewed'
      });
    }

    await photo.reject(req.user._id, reason, notes);

    // Populate the updated photo
    await photo.populate('user', 'username avatar email');
    await photo.populate('portfolio', 'title slug');
    await photo.populate('adminReview.reviewedBy', 'username');

    res.json({
      success: true,
      message: 'Photo rejected successfully',
      data: {
        photo
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get approval statistics
// @route   GET /api/admin/photos/stats
// @access  Admin
router.get('/photos/stats', protect, canReviewPhotos, async (req, res, next) => {
  try {
    const stats = await Photo.getApprovalStats();
    
    // Convert array to object for easier frontend consumption
    const statsObj = {
      pending: 0,
      approved: 0,
      rejected: 0
    };

    stats.forEach(stat => {
      statsObj[stat._id] = stat.count;
    });

    // Get additional stats
    const totalPhotos = await Photo.countDocuments();
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalAdmins = await User.countDocuments({ role: { $in: ['admin', 'super_admin'] } });

    res.json({
      success: true,
      data: {
        approvalStats: statsObj,
        totalPhotos,
        totalUsers,
        totalAdmins,
        pendingCount: statsObj.pending
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get all users (admin management)
// @route   GET /api/admin/users
// @access  Admin
router.get('/users', protect, requireAdmin, validatePagination, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    
    // Security: Never show super_admin accounts in user management
    // Regular admins see only users, super admins see users and regular admins
    if (req.user.role === 'admin') {
      query.role = 'user';
    } else if (req.user.role === 'super_admin') {
      // Super admins can see users and regular admins, but NOT other super admins
      query.role = { $in: ['user', 'admin'] };
    }
    
    // Apply additional role filter if specified (but still exclude super_admin)
    if (role && role !== 'super_admin') {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password -refreshTokens')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Get photo statistics for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const photoStats = await Photo.aggregate([
        { $match: { user: user._id } },
        { $group: { 
          _id: '$approvalStatus', 
          count: { $sum: 1 } 
        }}
      ]);

      const stats = {
        totalPhotos: 0,
        pendingPhotos: 0,
        approvedPhotos: 0,
        rejectedPhotos: 0
      };

      photoStats.forEach(stat => {
        stats.totalPhotos += stat.count;
        stats[`${stat._id}Photos`] = stat.count;
      });

      // Get recent photos
      const recentPhotos = await Photo.find({ user: user._id })
        .select('title url thumbnail approvalStatus createdAt')
        .sort({ createdAt: -1 })
        .limit(5);

      return {
        ...user.toObject(),
        stats,
        recentPhotos: recentPhotos.map(photo => ({
          id: photo._id,
          title: photo.title,
          url: photo.url,
          thumbnail: photo.thumbnail,
          status: photo.approvalStatus,
          submittedAt: photo.createdAt
        }))
      };
    }));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get approved photos
// @route   GET /api/admin/photos/approved
// @access  Admin
router.get('/photos/approved', protect, canReviewPhotos, validatePagination, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const photos = await Photo.findByApprovalStatus('approved', {
      limit: parseInt(limit),
      skip,
      sort: { createdAt: -1 }
    });

    const total = await Photo.countDocuments({ approvalStatus: 'approved' });

    res.json({
      success: true,
      data: {
        photos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get rejected photos
// @route   GET /api/admin/photos/rejected
// @access  Admin
router.get('/photos/rejected', protect, canReviewPhotos, validatePagination, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const photos = await Photo.findByApprovalStatus('rejected', {
      limit: parseInt(limit),
      skip,
      sort: { createdAt: -1 }
    });

    const total = await Photo.countDocuments({ approvalStatus: 'rejected' });

    res.json({
      success: true,
      data: {
        photos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete user account
// @route   DELETE /api/admin/users/:id
// @access  Super Admin
router.delete('/users/:id', protect, requireSuperAdmin, validateObjectId('id'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Security: Prevent deletion of super admin accounts entirely
    const user = await User.findById(id);
    if (user && user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super admin accounts cannot be deleted through user management'
      });
    }

    // Delete all photos associated with this user
    await Photo.deleteMany({ user: id });

    // Delete the user
    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'User and all associated photos deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete photo (admin power)
// @route   DELETE /api/admin/photos/:id
// @access  Super Admin
router.delete('/photos/:id', protect, requireSuperAdmin, validateObjectId('id'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const photo = await Photo.findById(id);
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    await Photo.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Create admin user
// @route   POST /api/admin/users
// @access  Super Admin
router.post('/users', protect, canManageAdmins, [
  body('username').notEmpty().isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'super_admin']).withMessage('Role must be admin or super_admin'),
  body('firstName').optional().isString().isLength({ max: 50 }),
  body('lastName').optional().isString().isLength({ max: 50 }),
  require('../middleware/validation').handleValidationErrors
], async (req, res, next) => {
  try {
    const { username, email, password, role, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    const user = await User.create({
      username,
      email,
      password,
      role,
      firstName,
      lastName,
      isVerified: true,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Super Admin
router.put('/users/:id/role', protect, canManageAdmins, validateObjectId('id'), [
  body('role').isIn(['user', 'admin', 'super_admin']).withMessage('Invalid role'),
  require('../middleware/validation').handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Prevent demoting the last super admin
    if (role !== 'super_admin') {
      const superAdminCount = await User.countDocuments({ role: 'super_admin' });
      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot demote the last super admin'
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    ).select('-password -refreshTokens');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Toggle user active status
// @route   PUT /api/admin/users/:id/status
// @access  Super Admin
router.put('/users/:id/status', protect, canManageAdmins, validateObjectId('id'), [
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
  require('../middleware/validation').handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Prevent deactivating the last super admin
    if (!isActive) {
      const user = await User.findById(id);
      if (user && user.role === 'super_admin') {
        const superAdminCount = await User.countDocuments({ role: 'super_admin', isActive: true });
        if (superAdminCount <= 1) {
          return res.status(400).json({
            success: false,
            message: 'Cannot deactivate the last super admin'
          });
        }
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    ).select('-password -refreshTokens');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Admin
router.get('/dashboard', protect, requireAdmin, async (req, res, next) => {
  try {
    const [
      approvalStats,
      totalPhotos,
      totalUsers,
      totalAdmins,
      recentPhotos,
      recentUsers
    ] = await Promise.all([
      Photo.getApprovalStats(),
      Photo.countDocuments(),
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: { $in: ['admin', 'super_admin'] } }),
      Photo.find({})
        .populate('user', 'username')
        .sort({ createdAt: -1 })
        .limit(5),
      User.find({ role: 'user' })
        .select('username email createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    // Convert approval stats to object
    const statsObj = {
      pending: 0,
      approved: 0,
      rejected: 0
    };

    approvalStats.forEach(stat => {
      statsObj[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: {
        stats: {
          photos: {
            total: totalPhotos,
            pending: statsObj.pending,
            approved: statsObj.approved,
            rejected: statsObj.rejected
          },
          users: {
            total: totalUsers,
            admins: totalAdmins
          }
        },
        recent: {
          photos: recentPhotos,
          users: recentUsers
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get photo statistics
// @route   GET /api/admin/stats/photos
// @access  Admin
router.get('/stats/photos', protect, requireAdmin, async (req, res, next) => {
  try {
    const [approvalStats, totalPhotos] = await Promise.all([
      Photo.getApprovalStats(),
      Photo.countDocuments()
    ]);

    // Convert approval stats to object
    const statsObj = {
      totalPhotos: totalPhotos,
      pendingPhotos: 0,
      approvedPhotos: 0,
      rejectedPhotos: 0
    };

    approvalStats.forEach(stat => {
      if (stat._id === 'pending') statsObj.pendingPhotos = stat.count;
      if (stat._id === 'approved') statsObj.approvedPhotos = stat.count;
      if (stat._id === 'rejected') statsObj.rejectedPhotos = stat.count;
    });

    res.json({
      success: true,
      data: statsObj
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get user statistics
// @route   GET /api/admin/stats/users
// @access  Admin
router.get('/stats/users', protect, requireAdmin, async (req, res, next) => {
  try {
    const [totalUsers, totalAdmins] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: { $in: ['admin', 'super_admin'] } })
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalAdmins
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Fix user stats (recalculate photo counts)
// @route   POST /api/admin/fix-stats
// @access  Super Admin
router.post('/fix-stats', protect, requireSuperAdmin, async (req, res, next) => {
  try {
    console.log('Starting user stats fix...');
    
    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to process`);
    
    const results = [];
    
    for (const user of users) {
      // Count actual photos for this user
      const actualPhotoCount = await Photo.countDocuments({ user: user._id });
      
      // Update user stats if there's a discrepancy
      if (user.stats.totalPhotos !== actualPhotoCount) {
        console.log(`User ${user.username}: Stats show ${user.stats.totalPhotos} photos, but actually has ${actualPhotoCount} photos`);
        
        await User.findByIdAndUpdate(user._id, {
          $set: { 'stats.totalPhotos': actualPhotoCount }
        });
        
        results.push({
          username: user.username,
          oldCount: user.stats.totalPhotos,
          newCount: actualPhotoCount,
          fixed: true
        });
        
        console.log(`✅ Updated ${user.username}'s photo count to ${actualPhotoCount}`);
      } else {
        results.push({
          username: user.username,
          oldCount: user.stats.totalPhotos,
          newCount: actualPhotoCount,
          fixed: false
        });
        
        console.log(`✅ ${user.username}: Stats are accurate (${actualPhotoCount} photos)`);
      }
    }
    
    const fixedCount = results.filter(r => r.fixed).length;
    
    res.json({
      success: true,
      message: `User stats fix completed. ${fixedCount} users updated.`,
      data: {
        totalUsers: users.length,
        fixedUsers: fixedCount,
        results
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get presigned URL for photo (admin access)
// @route   GET /api/admin/photos/:id/image
// @access  Admin
router.get('/photos/:id/image', protect, requireAdmin, validateObjectId('id'), async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('Admin requesting image for photo ID:', id);
    
    const photo = await Photo.findById(id);
    if (!photo) {
      console.log('Photo not found for ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    console.log('Photo found:', photo.title, 'PublicId:', photo.publicId);
    
    // Get presigned URL from R2
    const presignedUrl = await generatePresignedViewUrl(photo.publicId);
    console.log('Generated presigned URL:', presignedUrl);
    
    res.json({
      success: true,
      data: {
        url: presignedUrl,
        photo: {
          id: photo._id,
          title: photo.title,
          description: photo.description,
          approvalStatus: photo.approvalStatus
        }
      }
    });
  } catch (error) {
    console.error('Error in admin image route:', error);
    next(error);
  }
});

module.exports = router;
