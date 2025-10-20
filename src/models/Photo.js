const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Photo must belong to a user']
  },
  portfolio: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Portfolio',
    required: [true, 'Photo must belong to a portfolio']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  url: {
    type: String,
    required: [true, 'Photo URL is required']
  },
  publicId: {
    type: String, // R2 key
    required: [true, 'Public ID (R2 key) is required']
  },
  thumbnail: {
    type: String, // Thumbnail URL
    required: true
  },
  metadata: {
    width: {
      type: Number,
      required: true
    },
    height: {
      type: Number,
      required: true
    },
    format: {
      type: String,
      required: true,
      enum: ['jpg', 'jpeg', 'png', 'webp', 'gif']
    },
    size: {
      type: Number, // File size in bytes
      required: true
    },
    exif: {
      camera: String,
      lens: String,
      focalLength: String,
      aperture: String,
      shutterSpeed: String,
      iso: String,
      dateTaken: Date,
      location: {
        latitude: Number,
        longitude: Number,
        address: String
      }
    }
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  category: {
    type: String,
    enum: [
      'portrait',
      'landscape',
      'street',
      'wedding',
      'fashion',
      'nature',
      'architecture',
      'abstract',
      'documentary',
      'sports',
      'food',
      'travel',
      'other'
    ],
    default: 'other'
  },
  isPublic: {
    type: Boolean,
    default: false // Changed to false - photos need admin approval
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminReview: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    rejectionReason: {
      type: String,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters']
    },
    adminNotes: {
      type: String,
      maxlength: [1000, 'Admin notes cannot exceed 1000 characters']
    }
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    downloads: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    lastViewed: {
      type: Date
    }
  },
  settings: {
    allowDownload: {
      type: Boolean,
      default: true
    },
    showMetadata: {
      type: Boolean,
      default: false
    },
    watermark: {
      enabled: {
        type: Boolean,
        default: false
      },
      text: String,
      position: {
        type: String,
        enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'],
        default: 'bottom-right'
      },
      opacity: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.7
      }
    }
  },
  altText: {
    type: String,
    maxlength: [125, 'Alt text cannot exceed 125 characters']
  },
  colorPalette: [{
    color: String,
    percentage: Number
  }],
  processing: {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    error: String,
    processedAt: Date
  },
  // R2 specific fields
  r2: {
    bucket: {
      type: String,
      default: process.env.R2_BUCKET_NAME
    },
    region: {
      type: String,
      default: process.env.R2_REGION || 'auto'
    },
    etag: String, // R2 ETag for integrity checking
    lastModified: Date,
    storageClass: {
      type: String,
      default: 'STANDARD'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
photoSchema.index({ user: 1 });
photoSchema.index({ portfolio: 1 });
photoSchema.index({ isPublic: 1 });
photoSchema.index({ approvalStatus: 1 });
photoSchema.index({ tags: 1 });
photoSchema.index({ category: 1 });
photoSchema.index({ 'analytics.views': -1 });
photoSchema.index({ 'analytics.likes': -1 });
photoSchema.index({ createdAt: -1 });
photoSchema.index({ order: 1 });
photoSchema.index({ publicId: 1 }); // Index for R2 key lookups
photoSchema.index({ 'adminReview.reviewedBy': 1 });

// Virtual for aspect ratio
photoSchema.virtual('aspectRatio').get(function() {
  return this.metadata.width / this.metadata.height;
});

// Virtual for file size in MB
photoSchema.virtual('sizeInMB').get(function() {
  return (this.metadata.size / (1024 * 1024)).toFixed(2);
});

// Virtual for dimensions string
photoSchema.virtual('dimensions').get(function() {
  return `${this.metadata.width} × ${this.metadata.height}`;
});

// Virtual for dominant color
photoSchema.virtual('dominantColor').get(function() {
  if (this.colorPalette && this.colorPalette.length > 0) {
    return this.colorPalette[0].color;
  }
  return null;
});

// Virtual for R2 CDN URL with transformations
photoSchema.virtual('cdnUrl').get(function() {
  return this.url; // R2 public URL is already a CDN URL
});

// Virtual for thumbnail CDN URL
photoSchema.virtual('thumbnailCdnUrl').get(function() {
  return this.thumbnail;
});

// Pre-save middleware to generate alt text if not provided
photoSchema.pre('save', function(next) {
  if (!this.altText && this.title) {
    this.altText = this.title;
  } else if (!this.altText) {
    this.altText = `Photo by ${this.user}`;
  }
  next();
});

// Pre-save middleware to update user stats
photoSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      await this.model('User').findByIdAndUpdate(
        this.user,
        { $inc: { 'stats.totalPhotos': 1 } }
      );
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Pre-remove middleware to update user stats and clean up
photoSchema.pre('remove', async function(next) {
  try {
    // Update user stats
    await this.model('User').findByIdAndUpdate(
      this.user,
      { $inc: { 'stats.totalPhotos': -1 } }
    );
    
    // Note: R2 cleanup is handled in the upload route
    // This ensures proper error handling and logging
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to increment view count
photoSchema.methods.incrementView = function() {
  this.analytics.views += 1;
  this.analytics.lastViewed = new Date();
  return this.save();
};

// Instance method to increment like count
photoSchema.methods.incrementLike = function() {
  this.analytics.likes += 1;
  return this.save();
};

// Instance method to increment download count
photoSchema.methods.incrementDownload = function() {
  this.analytics.downloads += 1;
  return this.save();
};

// Instance method to check if user can access photo
photoSchema.methods.canAccess = function(user) {
  // Public photos can be accessed by anyone
  if (this.isPublic) return true;
  
  // Private photos can only be accessed by the owner
  return user && user._id.toString() === this.user.toString();
};

// Instance method to get R2 key for thumbnail
photoSchema.methods.getThumbnailKey = function() {
  // Assuming thumbnail follows the pattern: original_key_thumb.jpg
  return this.publicId.replace('.jpg', '_thumb.jpg');
};

// Instance method to get CDN URL with transformations
photoSchema.methods.getCDNUrl = function(transformations = {}) {
  if (Object.keys(transformations).length === 0) {
    return this.url;
  }

  // For R2, you can use Cloudflare Images or custom transformations
  // This is a basic implementation
  const params = new URLSearchParams();
  
  if (transformations.width) params.append('width', transformations.width);
  if (transformations.height) params.append('height', transformations.height);
  if (transformations.quality) params.append('quality', transformations.quality);
  if (transformations.format) params.append('format', transformations.format);
  
  return params.toString() ? `${this.url}?${params.toString()}` : this.url;
};

// Static method to find public photos
photoSchema.statics.findPublic = function() {
  return this.find({ isPublic: true, approvalStatus: 'approved' }).populate('user', 'username avatar');
};

// Static method to find by portfolio
photoSchema.statics.findByPortfolio = function(portfolioId, options = {}) {
  const {
    isPublic = true,
    limit = 50,
    skip = 0,
    sort = { order: 1, createdAt: -1 }
  } = options;

  const query = { portfolio: portfolioId };
  if (isPublic !== null) {
    query.isPublic = isPublic;
    if (isPublic) {
      query.approvalStatus = 'approved';
    }
  }

  return this.find(query)
    .populate('user', 'username avatar')
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

// Static method to search photos
photoSchema.statics.search = function(query, options = {}) {
  const {
    category,
    tags,
    user,
    portfolio,
    isPublic = true,
    limit = 20,
    skip = 0,
    sort = { createdAt: -1 }
  } = options;

  const searchQuery = { isPublic };
  if (isPublic) {
    searchQuery.approvalStatus = 'approved';
  }

  if (query) {
    searchQuery.$or = [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ];
  }

  if (category) {
    searchQuery.category = category;
  }

  if (tags && tags.length > 0) {
    searchQuery.tags = { $in: tags };
  }

  if (user) {
    searchQuery.user = user;
  }

  if (portfolio) {
    searchQuery.portfolio = portfolio;
  }

  return this.find(searchQuery)
    .populate('user', 'username avatar')
    .populate('portfolio', 'title slug')
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

// Static method to get featured photos
photoSchema.statics.findFeatured = function(limit = 10) {
  return this.find({ isPublic: true, isFeatured: true, approvalStatus: 'approved' })
    .populate('user', 'username avatar')
    .populate('portfolio', 'title slug')
    .sort({ 'analytics.views': -1 })
    .limit(limit);
};

// Static method to get trending photos
photoSchema.statics.findTrending = function(limit = 10, days = 7) {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return this.find({
    isPublic: true,
    approvalStatus: 'approved',
    createdAt: { $gte: date }
  })
    .populate('user', 'username avatar')
    .populate('portfolio', 'title slug')
    .sort({ 'analytics.views': -1 })
    .limit(limit);
};

// Static method to find photos by R2 key
photoSchema.statics.findByR2Key = function(key) {
  return this.findOne({ publicId: key });
};

// Static method to get photos by R2 keys (batch lookup)
photoSchema.statics.findByR2Keys = function(keys) {
  return this.find({ publicId: { $in: keys } });
};

// Static method to find photos pending approval
photoSchema.statics.findPendingApproval = function(options = {}) {
  const {
    limit = 50,
    skip = 0,
    sort = { createdAt: -1 }
  } = options;

  return this.find({ approvalStatus: 'pending' })
    .populate('user', 'username avatar email')
    .populate('portfolio', 'title slug')
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

// Static method to find photos by approval status
photoSchema.statics.findByApprovalStatus = function(status, options = {}) {
  const {
    limit = 50,
    skip = 0,
    sort = { createdAt: -1 }
  } = options;

  return this.find({ approvalStatus: status })
    .populate('user', 'username avatar email')
    .populate('portfolio', 'title slug')
    .populate('adminReview.reviewedBy', 'username')
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

// Static method to get approval statistics
photoSchema.statics.getApprovalStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$approvalStatus',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Instance method to approve photo
photoSchema.methods.approve = function(adminId, notes = '') {
  this.approvalStatus = 'approved';
  this.isPublic = true;
  this.adminReview = {
    reviewedBy: adminId,
    reviewedAt: new Date(),
    adminNotes: notes
  };
  return this.save();
};

// Instance method to reject photo
photoSchema.methods.reject = function(adminId, reason, notes = '') {
  this.approvalStatus = 'rejected';
  this.isPublic = false;
  this.adminReview = {
    reviewedBy: adminId,
    reviewedAt: new Date(),
    rejectionReason: reason,
    adminNotes: notes
  };
  return this.save();
};

module.exports = mongoose.model('Photo', photoSchema);