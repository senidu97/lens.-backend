const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const Photo = require('../models/Photo');
const Portfolio = require('../models/Portfolio');
const User = require('../models/User');
const { protect, checkSubscriptionLimits } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');
const {
  processAndUploadImage,
  uploadAvatar,
  deleteFromR2,
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
} = require('../utils/r2');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp,image/gif').split(',');
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF files are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 10 // Maximum 10 files per request
  }
});

// @desc    Upload single photo
// @route   POST /api/upload/photo
// @access  Private
router.post('/photo', protect, checkSubscriptionLimits('photos'), upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo file provided'
      });
    }

    const { portfolioId, title, description, tags, category, isPublic = true } = req.body;

    // Validate portfolio ID
    if (!portfolioId) {
      return res.status(400).json({
        success: false,
        message: 'Portfolio ID is required'
      });
    }

    // Check if portfolio exists and user owns it
    const portfolio = await Portfolio.findById(portfolioId);
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      });
    }

    if (portfolio.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to upload to this portfolio'
      });
    }

    // Check if user can upload more photos
    if (!req.user.canUploadPhoto()) {
      return res.status(403).json({
        success: false,
        message: `You have reached the photo limit for your ${req.user.subscription.plan} plan`
      });
    }

    // Process and upload image to R2
    const uploadResult = await processAndUploadImage(req.file.buffer, {
      userId: req.user._id,
      folder: 'photos',
      originalName: req.file.originalname,
      quality: 85,
      maxWidth: 2048,
      maxHeight: 2048,
      generateThumbnail: true,
      thumbnailSize: 300,
      extractColors: true,
    });

    // Parse tags
    const tagArray = tags ? tags.split(',').map(tag => tag.trim()) : [];

    // Create photo record
    const photo = await Photo.create({
      user: req.user._id,
      portfolio: portfolioId,
      title: title || req.file.originalname.split('.')[0],
      description,
      url: uploadResult.mainImage.url,
      publicId: uploadResult.mainImage.key, // Store R2 key as publicId
      thumbnail: uploadResult.thumbnail.url,
      metadata: {
        width: uploadResult.mainImage.width,
        height: uploadResult.mainImage.height,
        format: uploadResult.mainImage.format,
        size: uploadResult.mainImage.size
      },
      tags: tagArray,
      category: category || 'other',
      isPublic,
      colorPalette: uploadResult.colorPalette
    });

    // Populate photo with user and portfolio data
    await photo.populate('user', 'username avatar');
    await photo.populate('portfolio', 'title slug');

    res.status(201).json({
      success: true,
      message: 'Photo uploaded successfully',
      data: {
        photo
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Upload multiple photos
// @route   POST /api/upload/photos
// @access  Private
router.post('/photos', protect, checkSubscriptionLimits('photos'), upload.array('photos', 10), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No photo files provided'
      });
    }

    const { portfolioId, isPublic = true } = req.body;

    // Validate portfolio ID
    if (!portfolioId) {
      return res.status(400).json({
        success: false,
        message: 'Portfolio ID is required'
      });
    }

    // Check if portfolio exists and user owns it
    const portfolio = await Portfolio.findById(portfolioId);
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      });
    }

    if (portfolio.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to upload to this portfolio'
      });
    }

    // Check if user can upload more photos
    const remainingSlots = req.user.subscription.plan === 'free' ? 
      Math.max(0, 30 - req.user.stats.totalPhotos) : Infinity;

    if (req.files.length > remainingSlots) {
      return res.status(403).json({
        success: false,
        message: `You can only upload ${remainingSlots} more photos with your current plan`
      });
    }

    const uploadedPhotos = [];
    const errors = [];

    // Process each file
    for (let i = 0; i < req.files.length; i++) {
      try {
        const file = req.files[i];

        // Process and upload image to R2
        const uploadResult = await processAndUploadImage(file.buffer, {
          userId: req.user._id,
          folder: 'photos',
          originalName: file.originalname,
          quality: 85,
          maxWidth: 2048,
          maxHeight: 2048,
          generateThumbnail: true,
          thumbnailSize: 300,
          extractColors: true,
        });

        // Create photo record
        const photo = await Photo.create({
          user: req.user._id,
          portfolio: portfolioId,
          title: file.originalname.split('.')[0],
          url: uploadResult.mainImage.url,
          publicId: uploadResult.mainImage.key,
          thumbnail: uploadResult.thumbnail.url,
          metadata: {
            width: uploadResult.mainImage.width,
            height: uploadResult.mainImage.height,
            format: uploadResult.mainImage.format,
            size: uploadResult.mainImage.size
          },
          isPublic,
          colorPalette: uploadResult.colorPalette,
          order: i
        });

        uploadedPhotos.push(photo);
      } catch (error) {
        errors.push({
          file: req.files[i].originalname,
          error: error.message
        });
      }
    }

    // Populate photos with user and portfolio data
    const populatedPhotos = await Photo.find({
      _id: { $in: uploadedPhotos.map(p => p._id) }
    })
      .populate('user', 'username avatar')
      .populate('portfolio', 'title slug');

    res.status(201).json({
      success: true,
      message: `${uploadedPhotos.length} photos uploaded successfully`,
      data: {
        photos: populatedPhotos,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Upload avatar
// @route   POST /api/upload/avatar
// @access  Private
router.post('/avatar', protect, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No avatar file provided'
      });
    }

    // Upload avatar to R2
    const uploadResult = await uploadAvatar(req.file.buffer, req.user._id);

    // Update user avatar
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: uploadResult.url },
      { new: true }
    ).select('-password -refreshTokens');

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      data: {
        user,
        avatar: uploadResult.url
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete photo from R2
// @route   DELETE /api/upload/photo/:id
// @access  Private
router.delete('/photo/:id', protect, validateObjectId('id'), async (req, res, next) => {
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

    // Delete from R2
    try {
      // Delete main image
      await deleteFromR2(photo.publicId);
      
      // Delete thumbnail (assuming it follows the same naming pattern)
      const thumbnailKey = photo.publicId.replace('.jpg', '_thumb.jpg');
      await deleteFromR2(thumbnailKey);
    } catch (r2Error) {
      console.error('R2 deletion error:', r2Error);
      // Continue with database deletion even if R2 fails
    }

    // Delete from database
    await photo.remove();

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get presigned upload URL
// @route   POST /api/upload/presigned-url
// @access  Private
router.post('/presigned-url', protect, async (req, res, next) => {
  try {
    const { contentType, filename } = req.body;

    if (!contentType || !filename) {
      return res.status(400).json({
        success: false,
        message: 'Content type and filename are required'
      });
    }

    // Generate unique key with environment prefix
    const fileId = uuidv4();
    const timestamp = Date.now();
    const environmentPrefix = process.env.R2_ENVIRONMENT_PREFIX || process.env.NODE_ENV || 'dev';
    const key = `${environmentPrefix}/photos/${req.user._id}/${timestamp}_${fileId}_${filename}`;

    // Generate presigned URL
    const presignedUrl = await generatePresignedUploadUrl(key, contentType, 3600); // 1 hour

    res.json({
      success: true,
      data: {
        presignedUrl,
        key,
        url: `${process.env.R2_PUBLIC_URL}/${key}`,
        environment: environmentPrefix
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get presigned download URL
// @route   POST /api/upload/download-url
// @access  Private
router.post('/download-url', protect, async (req, res, next) => {
  try {
    const { key, expiresIn = 3600 } = req.body;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'Key is required'
      });
    }

    // Generate presigned download URL
    const presignedUrl = await generatePresignedDownloadUrl(key, expiresIn);

    res.json({
      success: true,
      data: {
        downloadUrl: presignedUrl,
        expiresIn
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get upload limits for user
// @route   GET /api/upload/limits
// @access  Private
router.get('/limits', protect, async (req, res, next) => {
  try {
    const user = req.user;
    const plan = user.subscription.plan;

    const limits = {
      free: {
        maxPhotos: 30,
        maxPortfolios: 3,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFilesPerUpload: 5,
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif']
      },
      pro: {
        maxPhotos: Infinity,
        maxPortfolios: Infinity,
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxFilesPerUpload: 20,
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'tiff', 'bmp']
      }
    };

    const userLimits = limits[plan];
    const currentUsage = {
      photos: user.stats.totalPhotos,
      portfolios: await Portfolio.countDocuments({ user: user._id })
    };

    res.json({
      success: true,
      data: {
        limits: userLimits,
        usage: currentUsage,
        remaining: {
          photos: userLimits.maxPhotos === Infinity ? Infinity : Math.max(0, userLimits.maxPhotos - currentUsage.photos),
          portfolios: userLimits.maxPortfolios === Infinity ? Infinity : Math.max(0, userLimits.maxPortfolios - currentUsage.portfolios)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get R2 configuration for frontend
// @route   GET /api/upload/config
// @access  Private
router.get('/config', protect, async (req, res, next) => {
  try {
    const config = {
      bucketName: process.env.R2_BUCKET_NAME,
      publicUrl: process.env.R2_PUBLIC_URL,
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
      allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp,image/gif').split(','),
      region: process.env.R2_REGION || 'auto'
    };

    res.json({
      success: true,
      data: {
        config
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;