const express = require('express');
const Portfolio = require('../models/Portfolio');
const Photo = require('../models/Photo');
const { protect, optionalAuth, checkOwnership } = require('../middleware/auth');
const { generatePresignedViewUrl } = require('../utils/r2');
const { 
  validatePortfolio, 
  validatePortfolioUpdate, 
  validateObjectId, 
  validatePagination, 
  validateSearch 
} = require('../middleware/validation');

const router = express.Router();

// @desc    Get all public portfolios
// @route   GET /api/portfolios
// @access  Public
router.get('/', optionalAuth, validatePagination, validateSearch, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      q: query,
      category,
      tags,
      sort = 'newest',
      user: userId
    } = req.query;

    const skip = (page - 1) * limit;

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
        sortObj = { 'analytics.totalViews': -1 };
        break;
      case 'trending':
        sortObj = { 'analytics.totalViews': -1, createdAt: -1 };
        break;
      default:
        sortObj = { createdAt: -1 };
    }

    // Parse tags if provided
    const tagArray = tags ? tags.split(',').map(tag => tag.trim()) : [];

    const portfolios = await Portfolio.search(query, {
      category,
      tags: tagArray,
      user: userId,
      isPublic: true,
      limit: parseInt(limit),
      skip,
      sort: sortObj
    });

    const total = await Portfolio.countDocuments({
      isPublic: true,
      ...(query && {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      }),
      ...(category && { category }),
      ...(tagArray.length > 0 && { tags: { $in: tagArray } }),
      ...(userId && { user: userId })
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

// @desc    Debug route - Test portfolios response structure
// @route   GET /api/portfolios/debug/test
// @access  Private
router.get('/debug/test', protect, async (req, res, next) => {
  try {
    const portfolios = await Portfolio.find({ user: req.user._id })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(5);

    // Populate photos for each portfolio
    for (let portfolio of portfolios) {
      const photos = await Photo.findByPortfolio(portfolio._id, {
        isPublic: portfolio.isPublic ? true : null,
        limit: 10
      });
      portfolio.photos = photos;
    }

    // Return a simplified response for testing
    const testResponse = {
      success: true,
      data: {
        portfolios: portfolios.map(p => ({
          id: p._id,
          title: p.title,
          slug: p.slug,
          isDefault: p.isDefault,
          photosCount: p.photos ? p.photos.length : 0,
          photos: p.photos ? p.photos.map(photo => ({
            id: photo._id,
            title: photo.title,
            url: photo.url,
            thumbnail: photo.thumbnail,
            isPublic: photo.isPublic
          })) : []
        }))
      }
    };

    console.log('DEBUG TEST RESPONSE:', JSON.stringify(testResponse, null, 2));
    res.json(testResponse);
  } catch (error) {
    next(error);
  }
});

// @desc    Get user's portfolios
// @route   GET /api/portfolios/my
// @access  Private
router.get('/my', protect, validatePagination, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, includePhotos = true } = req.query;
    const skip = (page - 1) * limit;

    const portfolios = await Portfolio.find({ user: req.user._id })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // If includePhotos is true, populate photos for each portfolio
    if (includePhotos === 'true' || includePhotos === true) {
      // Convert portfolios to plain objects to allow adding custom properties
      const portfoliosWithPhotos = [];
      
      for (let portfolio of portfolios) {
        const photos = await Photo.findByPortfolio(portfolio._id, {
          isPublic: null, // Get all photos regardless of public status for portfolio owner
          limit: 50, // Limit photos per portfolio for list view
          sort: { order: 1, createdAt: -1 }
        });
        
        // Convert portfolio to plain object and add photos with presigned URLs
        const portfolioObj = portfolio.toObject();
        
        // Generate presigned URLs for each photo
        const photosWithPresignedUrls = await Promise.all(photos.map(async (photo) => {
          try {
            const presignedUrl = await generatePresignedViewUrl(photo.publicId, 3600); // 1 hour
            return {
              ...photo.toObject(),
              url: presignedUrl, // Replace the direct URL with presigned URL
              originalUrl: photo.url // Keep original URL for reference
            };
          } catch (error) {
            console.error(`Error generating presigned URL for photo ${photo._id}:`, error);
            return photo.toObject(); // Fallback to original photo if presigned URL fails
          }
        }));
        
        portfolioObj.photos = photosWithPresignedUrls;
        
        portfoliosWithPhotos.push(portfolioObj);
      }
      
      // Replace the original portfolios array with the one that has photos
      portfolios.length = 0;
      portfolios.push(...portfoliosWithPhotos);
    }

    const total = await Portfolio.countDocuments({ user: req.user._id });

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

// @desc    Get or create default portfolio
// @route   GET /api/portfolios/default
// @access  Private
router.get('/default', protect, async (req, res, next) => {
  try {
    // First, try to find an existing default portfolio
    let portfolio = await Portfolio.findOne({ 
      user: req.user._id, 
      isDefault: true 
    });

    // If no default portfolio exists, create one
    if (!portfolio) {
      const existingCount = await Portfolio.countDocuments({ user: req.user._id });
      
      if (existingCount === 0) {
        // Create the first portfolio as default
        portfolio = await Portfolio.create({
          user: req.user._id,
          title: `${req.user.username}'s Portfolio`,
          description: 'My photography portfolio',
          slug: `${req.user.username}-portfolio-${Date.now()}`,
          isDefault: true,
          isPublic: true,
          category: 'other'
        });
      } else {
        // Set the first existing portfolio as default
        portfolio = await Portfolio.findOne({ user: req.user._id }).sort('createdAt');
        if (portfolio) {
          portfolio.isDefault = true;
          await portfolio.save();
        }
      }
    }

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'No portfolio found'
      });
    }

    await portfolio.populate('user', 'username avatar');

    res.json({
      success: true,
      data: {
        portfolio
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get portfolio by slug
// @route   GET /api/portfolios/:slug
// @access  Public
router.get('/:slug', optionalAuth, async (req, res, next) => {
  try {
    const { slug } = req.params;

    const portfolio = await Portfolio.findBySlug(slug);

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      });
    }

    // Check if user can access portfolio
    if (!portfolio.canAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Increment view count if not the owner
    if (!req.user || req.user._id.toString() !== portfolio.user._id.toString()) {
      await portfolio.incrementView();
    }

    // Get photos in portfolio
    const photos = await Photo.findByPortfolio(portfolio._id, {
      isPublic: portfolio.isPublic ? true : null,
      limit: 100
    });

    res.json({
      success: true,
      data: {
        portfolio: {
          ...portfolio.toObject(),
          photos
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Create new portfolio
// @route   POST /api/portfolios
// @access  Private
router.post('/', protect, validatePortfolio, async (req, res, next) => {
  try {
    const {
      title,
      description,
      isPublic = true,
      category,
      tags = [],
      layout,
      theme,
      settings
    } = req.body;

    // Check if user can create more portfolios
    const portfolioCount = await Portfolio.countDocuments({ user: req.user._id });
    const planLimits = { free: 3, pro: Infinity };
    
    if (portfolioCount >= planLimits[req.user.subscription.plan]) {
      return res.status(403).json({
        success: false,
        message: `You have reached the portfolio limit for your ${req.user.subscription.plan} plan`
      });
    }

    const portfolio = await Portfolio.create({
      user: req.user._id,
      title,
      description,
      isPublic,
      category,
      tags,
      layout,
      theme,
      settings
    });

    await portfolio.populate('user', 'username avatar');

    res.status(201).json({
      success: true,
      message: 'Portfolio created successfully',
      data: {
        portfolio
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update portfolio
// @route   PUT /api/portfolios/:id
// @access  Private
router.put('/:id', protect, validateObjectId('id'), validatePortfolioUpdate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const portfolio = await Portfolio.findById(id);

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      });
    }

    // Check ownership
    if (portfolio.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this portfolio'
      });
    }

    const updatedPortfolio = await Portfolio.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).populate('user', 'username avatar');

    res.json({
      success: true,
      message: 'Portfolio updated successfully',
      data: {
        portfolio: updatedPortfolio
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete portfolio
// @route   DELETE /api/portfolios/:id
// @access  Private
router.delete('/:id', protect, validateObjectId('id'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const portfolio = await Portfolio.findById(id);

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      });
    }

    // Check ownership
    if (portfolio.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this portfolio'
      });
    }

    await portfolio.deleteOne();

    res.json({
      success: true,
      message: 'Portfolio deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Set default portfolio
// @route   PUT /api/portfolios/:id/default
// @access  Private
router.put('/:id/default', protect, validateObjectId('id'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const portfolio = await Portfolio.findById(id);

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      });
    }

    // Check ownership
    if (portfolio.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to set this portfolio as default'
      });
    }

    // Set as default (pre-save middleware will handle the rest)
    portfolio.isDefault = true;
    await portfolio.save();

    res.json({
      success: true,
      message: 'Default portfolio updated successfully',
      data: {
        portfolio
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get portfolio analytics
// @route   GET /api/portfolios/:id/analytics
// @access  Private
router.get('/:id/analytics', protect, validateObjectId('id'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const portfolio = await Portfolio.findById(id);

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      });
    }

    // Check ownership
    if (portfolio.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view analytics for this portfolio'
      });
    }

    // Get photo count
    const photoCount = await Photo.countDocuments({ portfolio: id });

    // Get recent views (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // This would require a separate analytics collection in a real app
    // For now, we'll return basic stats
    const analytics = {
      totalViews: portfolio.analytics.totalViews,
      uniqueViews: portfolio.analytics.uniqueViews,
      photoCount,
      lastViewed: portfolio.analytics.lastViewed,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt
    };

    res.json({
      success: true,
      data: {
        analytics
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Duplicate portfolio
// @route   POST /api/portfolios/:id/duplicate
// @access  Private
router.post('/:id/duplicate', protect, validateObjectId('id'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const originalPortfolio = await Portfolio.findById(id);

    if (!originalPortfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      });
    }

    // Check if user can access portfolio
    if (!originalPortfolio.canAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to duplicate this portfolio'
      });
    }

    // Check if user can create more portfolios
    const portfolioCount = await Portfolio.countDocuments({ user: req.user._id });
    const planLimits = { free: 3, pro: Infinity };
    
    if (portfolioCount >= planLimits[req.user.subscription.plan]) {
      return res.status(403).json({
        success: false,
        message: `You have reached the portfolio limit for your ${req.user.subscription.plan} plan`
      });
    }

    // Create duplicate
    const duplicateData = {
      ...originalPortfolio.toObject(),
      _id: undefined,
      user: req.user._id,
      title: `${originalPortfolio.title} (Copy)`,
      slug: `${originalPortfolio.slug}-copy-${Date.now()}`,
      isDefault: false,
      analytics: {
        totalViews: 0,
        uniqueViews: 0
      },
      createdAt: undefined,
      updatedAt: undefined
    };

    const duplicatePortfolio = await Portfolio.create(duplicateData);

    // Duplicate photos
    const originalPhotos = await Photo.find({ portfolio: id });
    const duplicatePhotos = originalPhotos.map(photo => ({
      ...photo.toObject(),
      _id: undefined,
      user: req.user._id,
      portfolio: duplicatePortfolio._id,
      analytics: {
        views: 0,
        likes: 0,
        downloads: 0,
        shares: 0
      },
      createdAt: undefined,
      updatedAt: undefined
    }));

    await Photo.insertMany(duplicatePhotos);

    await duplicatePortfolio.populate('user', 'username avatar');

    res.status(201).json({
      success: true,
      message: 'Portfolio duplicated successfully',
      data: {
        portfolio: duplicatePortfolio
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
