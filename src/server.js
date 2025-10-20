const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const portfolioRoutes = require('./routes/portfolios');
const photoRoutes = require('./routes/photos');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin');

// Import path for serving static files
const path = require('path');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.ADMIN_FRONTEND_URL || 'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files for development
app.use('/uploads', express.static('uploads'));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Serve static files only (no user uploads stored locally)
// This is only for static assets like logos, icons, etc.
app.use('/static', express.static(path.join(process.cwd(), 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Database connection and initialization
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Initialize database with schemas and admin user
    await initializeDatabase();
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

// Database initialization function
const initializeDatabase = async () => {
  try {
    // Import models to ensure they're registered
    const User = require('./models/User');
    const Photo = require('./models/Photo');
    const Portfolio = require('./models/Portfolio');

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    
    if (existingSuperAdmin) {
      console.log('✅ Super admin already exists:', existingSuperAdmin.email);
      console.log('🔒 Credentials are preserved - no changes made to existing admin');
    } else {
      // Create initial super admin ONLY if none exists
      console.log('👤 Creating initial super admin (first time setup)...');
      
      const superAdmin = await User.create({
        username: 'superadmin',
        email: 'admin@lens.com',
        password: 'admin123', // Will be hashed by pre-save middleware
        role: 'super_admin',
        isVerified: true,
        isActive: true,
        firstName: 'Super',
        lastName: 'Admin',
        subscription: {
          plan: 'pro',
          isActive: true
        },
        stats: {
          totalPhotos: 0,
          totalViews: 0,
          totalLikes: 0,
          publicPhotos: 0
        },
        preferences: {
          theme: 'system',
          emailNotifications: true,
          publicProfile: false
        }
      });

      console.log('✅ Super admin created successfully!');
      console.log(`
🔐 Initial Super Admin Credentials (FIRST TIME ONLY):
   Email: ${superAdmin.email}
   Username: ${superAdmin.username}
   Password: admin123
   Role: ${superAdmin.role}

⚠️  IMPORTANT: Change these credentials after first login!
   These credentials will NEVER be overwritten on server restart.
      `);
    }

    // Create database indexes for better performance (safe to run multiple times)
    console.log('📊 Ensuring database indexes are created...');
    
    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ username: 1 }, { unique: true });
    await User.collection.createIndex({ role: 1 });
    await User.collection.createIndex({ isActive: 1 });
    
    // Photo indexes
    await Photo.collection.createIndex({ user: 1 });
    await Photo.collection.createIndex({ portfolio: 1 });
    await Photo.collection.createIndex({ approvalStatus: 1 });
    await Photo.collection.createIndex({ isPublic: 1 });
    await Photo.collection.createIndex({ category: 1 });
    await Photo.collection.createIndex({ tags: 1 });
    await Photo.collection.createIndex({ createdAt: -1 });
    await Photo.collection.createIndex({ 'analytics.views': -1 });
    
    // Portfolio indexes
    await Portfolio.collection.createIndex({ user: 1 });
    await Portfolio.collection.createIndex({ slug: 1 }, { unique: true });
    await Portfolio.collection.createIndex({ isPublic: 1 });
    await Portfolio.collection.createIndex({ isDefault: 1 });
    await Portfolio.collection.createIndex({ category: 1 });
    await Portfolio.collection.createIndex({ tags: 1 });
    
    console.log('✅ Database indexes verified/created successfully');
    console.log('🎉 Database initialization completed!');

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    // Don't exit on initialization error, just log it
  }
};

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log(`Error: ${err.message}`);
  process.exit(1);
});

startServer();

module.exports = app;
