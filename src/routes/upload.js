const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid');
const Photo = require('../models/Photo');
const Portfolio = require('../models/Portfolio');
const { protect, checkSubscriptionLimits } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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

// Helper function to upload to Cloudinary
const uploadToCloudinary = async (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'lens-portfolio',
        public_id: options.publicId || uuidv4(),
        transformation: options.transformation || [],
        ...options
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

// Helper function to generate thumbnail
const generateThumbnail = async (buffer, width = 300, height = 300) => {
  return await sharp(buffer)
    .resize(width, height, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: 80 })
    .toBuffer();
};

// Helper function to extract dominant colors
const extractColors = async (buffer) => {
  try {
    const { data, info } = await sharp(buffer)
      .resize(150, 150)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const colors = {};
    const step = info.channels;

    for (let i = 0; i < data.length; i += step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const color = `rgb(${r},${g},${b})`;
      colors[color] = (colors[color] || 0) + 1;
    }

    // Sort colors by frequency and return top 5
    return Object.entries(colors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([color, count]) => ({
        color,
        percentage: Math.round((count / (data.length / step)) * 100)
      }));
  } catch (error) {
    console.error('Error extracting colors:', error);
    return [];
  }
};

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

    // Generate unique public ID
    const publicId = `${req.user._id}_${uuidv4()}`;

    // Process image with Sharp
    const processedImage = await sharp(req.file.buffer)
      .resize(2048, 2048, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Generate thumbnail
    const thumbnailBuffer = await generateThumbnail(req.file.buffer);

    // Extract colors
    const colorPalette = await extractColors(req.file.buffer);

    // Upload original image to Cloudinary
    const originalResult = await uploadToCloudinary(processedImage, {
      publicId: `${publicId}_original`,
      transformation: [
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });

    // Upload thumbnail to Cloudinary
    const thumbnailResult = await uploadToCloudinary(thumbnailBuffer, {
      publicId: `${publicId}_thumb`,
      transformation: [
        { width: 300, height: 300, crop: 'fill', quality: 'auto' }
      ]
    });

    // Get image metadata
    const metadata = await sharp(req.file.buffer).metadata();

    // Parse tags
    const tagArray = tags ? tags.split(',').map(tag => tag.trim()) : [];

    // Create photo record
    const photo = await Photo.create({
      user: req.user._id,
      portfolio: portfolioId,
      title: title || req.file.originalname.split('.')[0],
      description,
      url: originalResult.secure_url,
      publicId: originalResult.public_id,
      thumbnail: thumbnailResult.secure_url,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: req.file.size
      },
      tags: tagArray,
      category: category || 'other',
      isPublic,
      colorPalette
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
        const publicId = `${req.user._id}_${uuidv4()}`;

        // Process image with Sharp
        const processedImage = await sharp(file.buffer)
          .resize(2048, 2048, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 85 })
          .toBuffer();

        // Generate thumbnail
        const thumbnailBuffer = await generateThumbnail(file.buffer);

        // Extract colors
        const colorPalette = await extractColors(file.buffer);

        // Upload original image to Cloudinary
        const originalResult = await uploadToCloudinary(processedImage, {
          publicId: `${publicId}_original`,
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ]
        });

        // Upload thumbnail to Cloudinary
        const thumbnailResult = await uploadToCloudinary(thumbnailBuffer, {
          publicId: `${publicId}_thumb`,
          transformation: [
            { width: 300, height: 300, crop: 'fill', quality: 'auto' }
          ]
        });

        // Get image metadata
        const metadata = await sharp(file.buffer).metadata();

        // Create photo record
        const photo = await Photo.create({
          user: req.user._id,
          portfolio: portfolioId,
          title: file.originalname.split('.')[0],
          url: originalResult.secure_url,
          publicId: originalResult.public_id,
          thumbnail: thumbnailResult.secure_url,
          metadata: {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            size: file.size
          },
          isPublic,
          colorPalette,
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

    // Generate unique public ID
    const publicId = `avatar_${req.user._id}_${uuidv4()}`;

    // Process image with Sharp (square crop)
    const processedImage = await sharp(req.file.buffer)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Upload to Cloudinary
    const result = await uploadToCloudinary(processedImage, {
      publicId,
      transformation: [
        { width: 400, height: 400, crop: 'fill', quality: 'auto' }
      ]
    });

    // Update user avatar
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: result.secure_url },
      { new: true }
    ).select('-password -refreshTokens');

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      data: {
        user,
        avatar: result.secure_url
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete photo from Cloudinary
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

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(photo.publicId);
      await cloudinary.uploader.destroy(`${photo.publicId}_thumb`);
    } catch (cloudinaryError) {
      console.error('Cloudinary deletion error:', cloudinaryError);
      // Continue with database deletion even if Cloudinary fails
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

module.exports = router;
