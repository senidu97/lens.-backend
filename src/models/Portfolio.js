const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Portfolio must belong to a user']
  },
  title: {
    type: String,
    required: [true, 'Portfolio title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  coverPhoto: {
    type: String, // R2 URL
    default: null
  },
  layout: {
    type: {
      type: String,
      enum: ['masonry', 'grid', 'list'],
      default: 'masonry'
    },
    columns: {
      type: Number,
      min: 1,
      max: 6,
      default: 3
    },
    spacing: {
      type: Number,
      min: 0,
      max: 50,
      default: 10
    }
  },
  theme: {
    backgroundColor: {
      type: String,
      default: '#ffffff'
    },
    textColor: {
      type: String,
      default: '#000000'
    },
    accentColor: {
      type: String,
      default: '#007bff'
    },
    fontFamily: {
      type: String,
      default: 'system-ui'
    }
  },
  customDomain: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9.-]+$/, 'Custom domain can only contain lowercase letters, numbers, dots, and hyphens']
  },
  seo: {
    metaTitle: {
      type: String,
      maxlength: [60, 'Meta title cannot exceed 60 characters']
    },
    metaDescription: {
      type: String,
      maxlength: [160, 'Meta description cannot exceed 160 characters']
    },
    keywords: [{
      type: String,
      trim: true
    }]
  },
  analytics: {
    totalViews: {
      type: Number,
      default: 0
    },
    uniqueViews: {
      type: Number,
      default: 0
    },
    lastViewed: {
      type: Date
    }
  },
  settings: {
    showTitle: {
      type: Boolean,
      default: true
    },
    showDescription: {
      type: Boolean,
      default: true
    },
    showPhotoCount: {
      type: Boolean,
      default: true
    },
    allowDownload: {
      type: Boolean,
      default: false
    },
    showMetadata: {
      type: Boolean,
      default: false
    },
    enableComments: {
      type: Boolean,
      default: false
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
  // R2 specific fields for cover photo
  r2: {
    coverPhotoKey: String, // R2 key for cover photo
    bucket: {
      type: String,
      default: process.env.R2_BUCKET_NAME
    },
    region: {
      type: String,
      default: process.env.R2_REGION || 'auto'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
portfolioSchema.index({ user: 1 });
portfolioSchema.index({ slug: 1 });
portfolioSchema.index({ isPublic: 1 });
portfolioSchema.index({ tags: 1 });
portfolioSchema.index({ category: 1 });
portfolioSchema.index({ 'analytics.totalViews': -1 });
portfolioSchema.index({ 'r2.coverPhotoKey': 1 });

// Virtual for photo count
portfolioSchema.virtual('photoCount', {
  ref: 'Photo',
  localField: '_id',
  foreignField: 'portfolio',
  count: true
});

// Virtual for URL
portfolioSchema.virtual('url').get(function() {
  if (this.customDomain) {
    return `https://${this.customDomain}`;
  }
  return `${process.env.FRONTEND_URL}/portfolio/${this.slug}`;
});

// Virtual for cover photo CDN URL
portfolioSchema.virtual('coverPhotoCdnUrl').get(function() {
  return this.coverPhoto; // R2 public URL is already a CDN URL
});

// Pre-save middleware to generate slug
portfolioSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  next();
});

// Pre-save middleware to ensure only one default portfolio per user
portfolioSchema.pre('save', async function(next) {
  if (this.isModified('isDefault') && this.isDefault) {
    try {
      await this.constructor.updateMany(
        { user: this.user, _id: { $ne: this._id } },
        { isDefault: false }
      );
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Instance method to increment view count
portfolioSchema.methods.incrementView = function() {
  this.analytics.totalViews += 1;
  this.analytics.lastViewed = new Date();
  return this.save();
};

// Instance method to check if user can access portfolio
portfolioSchema.methods.canAccess = function(user) {
  // Public portfolios can be accessed by anyone
  if (this.isPublic) return true;
  
  // Private portfolios can only be accessed by the owner
  return user && user._id.toString() === this.user.toString();
};

// Instance method to get cover photo CDN URL with transformations
portfolioSchema.methods.getCoverPhotoCDNUrl = function(transformations = {}) {
  if (!this.coverPhoto) return null;
  
  if (Object.keys(transformations).length === 0) {
    return this.coverPhoto;
  }

  // For R2, you can use Cloudflare Images or custom transformations
  const params = new URLSearchParams();
  
  if (transformations.width) params.append('width', transformations.width);
  if (transformations.height) params.append('height', transformations.height);
  if (transformations.quality) params.append('quality', transformations.quality);
  if (transformations.format) params.append('format', transformations.format);
  
  return params.toString() ? `${this.coverPhoto}?${params.toString()}` : this.coverPhoto;
};

// Static method to find public portfolios
portfolioSchema.statics.findPublic = function() {
  return this.find({ isPublic: true }).populate('user', 'username avatar');
};

// Static method to find by slug
portfolioSchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug }).populate('user', 'username avatar bio');
};

// Static method to search portfolios
portfolioSchema.statics.search = function(query, options = {}) {
  const {
    category,
    tags,
    user,
    isPublic = true,
    limit = 20,
    skip = 0,
    sort = { 'analytics.totalViews': -1 }
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

  return this.find(searchQuery)
    .populate('user', 'username avatar')
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

// Static method to find portfolios by R2 cover photo keys
portfolioSchema.statics.findByCoverPhotoKeys = function(keys) {
  return this.find({ 'r2.coverPhotoKey': { $in: keys } });
};

// Pre-remove middleware to clean up related data
portfolioSchema.pre('remove', async function(next) {
  try {
    // Remove all photos in this portfolio
    await this.model('Photo').deleteMany({ portfolio: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Portfolio', portfolioSchema);