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
    type: String, // Cloudinary public ID
    required: [true, 'Public ID is required']
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
    default: true
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
photoSchema.index({ tags: 1 });
photoSchema.index({ category: 1 });
photoSchema.index({ 'analytics.views': -1 });
photoSchema.index({ 'analytics.likes': -1 });
photoSchema.index({ createdAt: -1 });
photoSchema.index({ order: 1 });

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
    
    // TODO: Delete from Cloudinary
    // await cloudinary.uploader.destroy(this.publicId);
    
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

// Static method to find public photos
photoSchema.statics.findPublic = function() {
  return this.find({ isPublic: true }).populate('user', 'username avatar');
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
  return this.find({ isPublic: true, isFeatured: true })
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
    createdAt: { $gte: date }
  })
    .populate('user', 'username avatar')
    .populate('portfolio', 'title slug')
    .sort({ 'analytics.views': -1 })
    .limit(limit);
};

module.exports = mongoose.model('Photo', photoSchema);
