const express = require('express');
const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const Photo = require('../models/Photo');
const { protect, optionalAuth } = require('../middleware/auth');
const { validateObjectId, validatePagination, validateSearch } = require('../middleware/validation');

const router = express.Router();

// @desc    Get user profile by username
// @route   GET /api/users/:username
// @access  Public
router.get('/:username', optionalAuth, async (req, res, next) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username }).select('-password -refreshTokens');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if profile is public or user is viewing their own profile
    if (!user.preferences.publicProfile && (!req.user || req.user._id.toString() !== user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Profile is private'
      });
    }

    // Get user's public portfolios
    const portfolios = await Portfolio.find({
      user: user._id,
      isPublic: true
    }).select('title slug description coverPhoto createdAt');

    // Get user's public photos count
    const photoCount = await Photo.countDocuments({
      user: user._id,
      isPublic: true
    });

    // Get featured photos
    const featuredPhotos = await Photo.find({
      user: user._id,
      isPublic: true,
      isFeatured: true
    })
      .select('url thumbnail title category')
      .limit(6)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        user: {
          ...user.toObject(),
          stats: {
            ...user.stats,
            publicPhotos: photoCount
          }
        },
        portfolios,
        featuredPhotos
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get user's portfolios
// @route   GET /api/users/:username/portfolios
// @access  Public
router.get('/:username/portfolios', optionalAuth, validatePagination, async (req, res, next) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if profile is public or user is viewing their own profile
    if (!user.preferences.publicProfile && (!req.user || req.user._id.toString() !== user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Profile is private'
      });
    }

    const portfolios = await Portfolio.find({
      user: user._id,
      isPublic: true
    })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Portfolio.countDocuments({
      user: user._id,
      isPublic: true
    });

    res.json({
      success: true,
      data: {
        portfolios,
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

// @desc    Get user's photos
// @route   GET /api/users/:username/photos
// @access  Public
router.get('/:username/photos', optionalAuth, validatePagination, validateSearch, async (req, res, next) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20, q: query, category, tags, sort = 'newest' } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if profile is public or user is viewing their own profile
    if (!user.preferences.publicProfile && (!req.user || req.user._id.toString() !== user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Profile is private'
      });
    }

    // Build sort object
    let sortObj = {};
    switch (sort) {
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'oldest':
        sortObj = { createdAt: 1 };
        break;
      case 'popular':
        sortObj = { 'analytics.views': -1 };
        break;
      case 'trending':
        sortObj = { 'analytics.views': -1, createdAt: -1 };
        break;
      default:
        sortObj = { createdAt: -1 };
    }

    // Parse tags if provided
    const tagArray = tags ? tags.split(',').map(tag => tag.trim()) : [];

    const photos = await Photo.search(query, {
      category,
      tags: tagArray,
      user: user._id,
      isPublic: true,
      limit: parseInt(limit),
      skip,
      sort: sortObj
    });

    const total = await Photo.countDocuments({
      user: user._id,
      isPublic: true,
      ...(query && {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      }),
      ...(category && { category }),
      ...(tagArray.length > 0 && { tags: { $in: tagArray } })
    });

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

// @desc    Get current user's profile
// @route   GET /api/users/me/profile
// @access  Private
router.get('/me/profile', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -refreshTokens')
      .populate('portfolios', 'title slug isPublic createdAt');

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update current user's profile
// @route   PUT /api/users/me/profile
// @access  Private
router.put('/me/profile', protect, [
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
  
  body('preferences.publicProfile')
    .optional()
    .isBoolean()
    .withMessage('Public profile must be a boolean value'),
  
  body('preferences.emailNotifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications must be a boolean value'),
  
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark', 'system'])
    .withMessage('Theme must be light, dark, or system'),
  
  require('../middleware/validation').handleValidationErrors
], async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      bio,
      website,
      location,
      preferences
    } = req.body;

    const updateData = {
      firstName,
      lastName,
      bio,
      website,
      location
    };

    // Update preferences if provided
    if (preferences) {
      updateData.preferences = {
        ...req.user.preferences,
        ...preferences
      };
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).select('-password -refreshTokens');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get user statistics
// @route   GET /api/users/me/stats
// @access  Private
router.get('/me/stats', protect, async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get portfolio count
    const portfolioCount = await Portfolio.countDocuments({ user: userId });

    // Get photo count
    const photoCount = await Photo.countDocuments({ user: userId });

    // Get public photo count
    const publicPhotoCount = await Photo.countDocuments({ 
      user: userId, 
      isPublic: true 
    });

    // Get total views across all portfolios
    const totalPortfolioViews = await Portfolio.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, totalViews: { $sum: '$analytics.totalViews' } } }
    ]);

    // Get total views across all photos
    const totalPhotoViews = await Photo.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, totalViews: { $sum: '$analytics.views' } } }
    ]);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPhotos = await Photo.countDocuments({
      user: userId,
      createdAt: { $gte: thirtyDaysAgo }
    });

    const recentPortfolios = await Portfolio.countDocuments({
      user: userId,
      createdAt: { $gte: thirtyDaysAgo }
    });

    const stats = {
      portfolios: {
        total: portfolioCount,
        recent: recentPortfolios
      },
      photos: {
        total: photoCount,
        public: publicPhotoCount,
        recent: recentPhotos
      },
      views: {
        portfolios: totalPortfolioViews[0]?.totalViews || 0,
        photos: totalPhotoViews[0]?.totalViews || 0
      },
      subscription: req.user.subscription,
      memberSince: req.user.createdAt
    };

    res.json({
      success: true,
      data: {
        stats
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Search users
// @route   GET /api/users/search
// @access  Public
router.get('/search', validatePagination, [
  query('q')
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ max: 100 })
    .withMessage('Search query cannot exceed 100 characters')
    .trim(),
  
  require('../middleware/validation').handleValidationErrors
], async (req, res, next) => {
  try {
    const { q: query, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const users = await User.find({
      $and: [
        { preferences: { publicProfile: true } },
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { firstName: { $regex: query, $options: 'i' } },
            { lastName: { $regex: query, $options: 'i' } },
            { bio: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    })
      .select('username firstName lastName bio avatar stats')
      .sort({ 'stats.totalViews': -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await User.countDocuments({
      $and: [
        { preferences: { publicProfile: true } },
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { firstName: { $regex: query, $options: 'i' } },
            { lastName: { $regex: query, $options: 'i' } },
            { bio: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    });

    res.json({
      success: true,
      data: {
        users,
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

// @desc    Follow/Unfollow user
// @route   POST /api/users/:username/follow
// @access  Private
router.post('/:username/follow', protect, async (req, res, next) => {
  try {
    const { username } = req.params;

    if (username === req.user.username) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself'
      });
    }

    const userToFollow = await User.findOne({ username });

    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already following
    const isFollowing = req.user.following && req.user.following.includes(userToFollow._id);

    if (isFollowing) {
      // Unfollow
      await User.findByIdAndUpdate(
        req.user._id,
        { $pull: { following: userToFollow._id } }
      );
      
      await User.findByIdAndUpdate(
        userToFollow._id,
        { $pull: { followers: req.user._id } }
      );

      res.json({
        success: true,
        message: 'User unfollowed successfully',
        data: {
          following: false
        }
      });
    } else {
      // Follow
      await User.findByIdAndUpdate(
        req.user._id,
        { $addToSet: { following: userToFollow._id } }
      );
      
      await User.findByIdAndUpdate(
        userToFollow._id,
        { $addToSet: { followers: req.user._id } }
      );

      res.json({
        success: true,
        message: 'User followed successfully',
        data: {
          following: true
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

// @desc    Get user's followers
// @route   GET /api/users/:username/followers
// @access  Public
router.get('/:username/followers', optionalAuth, validatePagination, async (req, res, next) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if profile is public or user is viewing their own profile
    if (!user.preferences.publicProfile && (!req.user || req.user._id.toString() !== user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Profile is private'
      });
    }

    const followers = await User.find({
      _id: { $in: user.followers || [] }
    })
      .select('username firstName lastName avatar bio')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = user.followers ? user.followers.length : 0;

    res.json({
      success: true,
      data: {
        followers,
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

// @desc    Get user's following
// @route   GET /api/users/:username/following
// @access  Public
router.get('/:username/following', optionalAuth, validatePagination, async (req, res, next) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if profile is public or user is viewing their own profile
    if (!user.preferences.publicProfile && (!req.user || req.user._id.toString() !== user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Profile is private'
      });
    }

    const following = await User.find({
      _id: { $in: user.following || [] }
    })
      .select('username firstName lastName avatar bio')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = user.following ? user.following.length : 0;

    res.json({
      success: true,
      data: {
        following,
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

module.exports = router;
