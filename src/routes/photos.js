const express = require('express');
const { body } = require('express-validator');
const Photo = require('../models/Photo');
const Portfolio = require('../models/Portfolio');
const { protect, optionalAuth, checkOwnership } = require('../middleware/auth');
const { generatePresignedViewUrl } = require('../utils/r2');
const { 
  validatePhoto, 
  validateObjectId, 
  validatePagination, 
  validateSearch 
} = require('../middleware/validation');

const router = express.Router();

// @desc    Get all public photos
// @route   GET /api/photos
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
      user: userId,
      portfolio: portfolioId
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
      user: userId,
      portfolio: portfolioId,
      isPublic: true,
      limit: parseInt(limit),
      skip,
      sort: sortObj
    });

    const total = await Photo.countDocuments({
      isPublic: true,
      approvalStatus: 'approved',
      ...(query && {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      }),
      ...(category && { category }),
      ...(tagArray.length > 0 && { tags: { $in: tagArray } }),
      ...(userId && { user: userId }),
      ...(portfolioId && { portfolio: portfolioId })
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

// @desc    Get presigned URL for photo viewing
// @route   GET /api/photos/:photoId/presigned-url
// @access  Private
router.get('/:photoId/presigned-url', protect, async (req, res, next) => {
  try {
    const photo = await Photo.findById(req.params.photoId);
    
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Check if user owns the photo or it's public
    if (photo.user.toString() !== req.user._id.toString() && !photo.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Generate presigned URL for the main image
    const mainImageUrl = await generatePresignedViewUrl(photo.publicId, 3600); // 1 hour
    
    let thumbnailUrl = null;
    if (photo.thumbnail && photo.publicId) {
      // Generate thumbnail key from publicId
      // Thumbnail follows the pattern: original_key_thumb.jpg
      const thumbnailKey = photo.publicId.replace('.jpg', '_thumb.jpg').replace('.jpeg', '_thumb.jpg').replace('.png', '_thumb.jpg');
      
      console.log('Original publicId:', photo.publicId);
      console.log('Generated thumbnail key:', thumbnailKey);
      
      try {
        // Generate presigned URL for thumbnail
        thumbnailUrl = await generatePresignedViewUrl(thumbnailKey, 3600);
        console.log('Successfully generated presigned thumbnail URL');
      } catch (error) {
        console.error('Failed to generate thumbnail presigned URL:', error);
        // If thumbnail fails, try to use the main image URL from database
        thumbnailUrl = photo.thumbnail;
      }
    }

    res.json({
      success: true,
      data: {
        photoId: photo._id,
        mainImageUrl,
        thumbnailUrl,
        expiresIn: 3600
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Debug route - Test photo URL accessibility
// @route   GET /api/photos/debug/test-url/:photoId
// @access  Private
router.get('/debug/test-url/:photoId', protect, async (req, res, next) => {
  try {
    const photo = await Photo.findById(req.params.photoId)
      .populate('user', 'username')
      .populate('portfolio', 'title');

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Test if the photo URL is accessible
    const testResult = {
      photo: {
        id: photo._id,
        title: photo.title,
        url: photo.url,
        thumbnail: photo.thumbnail,
        r2Key: photo.publicId,
        isPublic: photo.isPublic,
        createdAt: photo.createdAt
      },
      urlTest: {
        mainUrl: photo.url,
        thumbnailUrl: photo.thumbnail,
        r2Key: photo.publicId,
        environment: process.env.NODE_ENV
      }
    };

    console.log('PHOTO URL TEST:', JSON.stringify(testResult, null, 2));
    res.json({ success: true, data: testResult });
  } catch (error) {
    next(error);
  }
});

// @desc    Debug route - Get all photos (for troubleshooting)
// @route   GET /api/photos/debug/all
// @access  Private
router.get('/debug/all', protect, async (req, res, next) => {
  try {
    const allPhotos = await Photo.find({})
      .populate('user', 'username avatar')
      .populate('portfolio', 'title slug')
      .sort({ createdAt: -1 })
      .limit(20);

    console.log('All photos in database:', {
      totalCount: allPhotos.length,
      photos: allPhotos.map(p => ({
        id: p._id,
        userId: p.user?._id,
        portfolioId: p.portfolio?._id,
        portfolioTitle: p.portfolio?.title,
        url: p.url,
        isPublic: p.isPublic,
        createdAt: p.createdAt
      }))
    });

    res.json({
      success: true,
      data: {
        photos: allPhotos,
        debug: {
          totalPhotos: allPhotos.length,
          userPhotos: allPhotos.filter(p => p.user?._id.toString() === req.user._id.toString()).length
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get user's photos
// @route   GET /api/photos/my
// @access  Private
router.get('/my', protect, validatePagination, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, portfolio: portfolioId, approvalStatus } = req.query;
    const skip = (page - 1) * limit;

    console.log('Photos /my route called with:', { page, limit, portfolioId, approvalStatus, userId: req.user._id });

    const query = { user: req.user._id };
    if (portfolioId) {
      query.portfolio = portfolioId;
    }
    if (approvalStatus) {
      query.approvalStatus = approvalStatus;
    }

    console.log('Query:', query);

    const photos = await Photo.find(query)
      .populate('user', 'username avatar')
      .populate('portfolio', 'title slug')
      .populate('adminReview.reviewedBy', 'username')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Photo.countDocuments(query);

    console.log('Found photos:', photos.length, 'Total:', total);

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
    console.error('Error in photos /my route:', error);
    next(error);
  }
});

// @desc    Get featured photos
// @route   GET /api/photos/featured
// @access  Public
router.get('/featured', async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const photos = await Photo.findFeatured(parseInt(limit));

    res.json({
      success: true,
      data: {
        photos
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get trending photos
// @route   GET /api/photos/trending
// @access  Public
router.get('/trending', async (req, res, next) => {
  try {
    const { limit = 10, days = 7 } = req.query;

    const photos = await Photo.findTrending(parseInt(limit), parseInt(days));

    res.json({
      success: true,
      data: {
        photos
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get photo by ID
// @route   GET /api/photos/:id
// @access  Public
router.get('/:id', optionalAuth, validateObjectId('id'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const photo = await Photo.findById(id)
      .populate('user', 'username avatar bio')
      .populate('portfolio', 'title slug');

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Check if user can access photo
    if (!photo.canAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Increment view count if not the owner
    if (!req.user || req.user._id.toString() !== photo.user._id.toString()) {
      await photo.incrementView();
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

// @desc    Update photo
// @route   PUT /api/photos/:id
// @access  Private
router.put('/:id', protect, validateObjectId('id'), validatePhoto, async (req, res, next) => {
  try {
    const { id } = req.params;

    const photo = await Photo.findById(id);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Check ownership
    if (photo.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this photo'
      });
    }

    const updatedPhoto = await Photo.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    )
      .populate('user', 'username avatar')
      .populate('portfolio', 'title slug');

    res.json({
      success: true,
      message: 'Photo updated successfully',
      data: {
        photo: updatedPhoto
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete photo
// @route   DELETE /api/photos/:id
// @access  Private
router.delete('/:id', protect, validateObjectId('id'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const photo = await Photo.findById(id);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Check ownership
    if (photo.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this photo'
      });
    }

    await photo.deleteOne();

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Like photo
// @route   POST /api/photos/:id/like
// @access  Private
router.post('/:id/like', protect, validateObjectId('id'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const photo = await Photo.findById(id);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Check if user can access photo
    if (!photo.canAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // In a real app, you'd want to track individual likes to prevent duplicate likes
    // For now, we'll just increment the like count
    await photo.incrementLike();

    res.json({
      success: true,
      message: 'Photo liked successfully',
      data: {
        likes: photo.analytics.likes
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Download photo
// @route   POST /api/photos/:id/download
// @access  Private
router.post('/:id/download', protect, validateObjectId('id'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const photo = await Photo.findById(id);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Check if user can access photo
    if (!photo.canAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if downloads are allowed
    if (!photo.settings.allowDownload) {
      return res.status(403).json({
        success: false,
        message: 'Downloads are not allowed for this photo'
      });
    }

    // Increment download count
    await photo.incrementDownload();

    res.json({
      success: true,
      message: 'Download initiated',
      data: {
        downloadUrl: photo.url,
        downloads: photo.analytics.downloads
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Share photo
// @route   POST /api/photos/:id/share
// @access  Private
router.post('/:id/share', protect, validateObjectId('id'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { platform } = req.body; // e.g., 'facebook', 'twitter', 'instagram'

    const photo = await Photo.findById(id);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Check if user can access photo
    if (!photo.canAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Increment share count
    photo.analytics.shares += 1;
    await photo.save();

    // In a real app, you'd integrate with social media APIs here
    const shareUrl = `${process.env.FRONTEND_URL}/photo/${id}`;

    res.json({
      success: true,
      message: 'Photo shared successfully',
      data: {
        shareUrl,
        platform,
        shares: photo.analytics.shares
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get photo analytics
// @route   GET /api/photos/:id/analytics
// @access  Private
router.get('/:id/analytics', protect, validateObjectId('id'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const photo = await Photo.findById(id);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Check ownership
    if (photo.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view analytics for this photo'
      });
    }

    const analytics = {
      views: photo.analytics.views,
      likes: photo.analytics.likes,
      downloads: photo.analytics.downloads,
      shares: photo.analytics.shares,
      lastViewed: photo.analytics.lastViewed,
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt
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

// @desc    Reorder photos in portfolio
// @route   PUT /api/photos/reorder
// @access  Private
router.put('/reorder', protect, [
  body('photos').isArray().withMessage('Photos must be an array'),
  body('photos.*.id').isMongoId().withMessage('Invalid photo ID'),
  body('photos.*.order').isInt({ min: 0 }).withMessage('Order must be a non-negative integer'),
  require('../middleware/validation').handleValidationErrors
], async (req, res, next) => {
  try {
    const { photos } = req.body;

    // Update photo orders
    const updatePromises = photos.map(photoData => 
      Photo.findByIdAndUpdate(
        photoData.id,
        { order: photoData.order },
        { new: true }
      )
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Photos reordered successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
