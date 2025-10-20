const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import all models to ensure they're registered
const User = require('./src/models/User');
const Photo = require('./src/models/Photo');
const Portfolio = require('./src/models/Portfolio');

// Database initialization function
async function initializeDatabase() {
  try {
    console.log('🚀 Initializing Lens Database...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    
    if (existingSuperAdmin) {
      console.log('✅ Super admin already exists:', existingSuperAdmin.email);
      console.log('📝 You can update credentials in MongoDB Atlas if needed');
    } else {
      // Create initial super admin
      console.log('👤 Creating initial super admin...');
      
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
🔐 Initial Super Admin Credentials:
   Email: ${superAdmin.email}
   Username: ${superAdmin.username}
   Password: admin123
   Role: ${superAdmin.role}

⚠️  IMPORTANT: Change these credentials after first login!
      `);
    }

    // Create database indexes for better performance
    console.log('📊 Creating database indexes...');
    
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
    
    console.log('✅ Database indexes created successfully');

    // Verify database structure
    console.log('🔍 Verifying database structure...');
    
    const userCount = await User.countDocuments();
    const photoCount = await Photo.countDocuments();
    const portfolioCount = await Portfolio.countDocuments();
    
    console.log(`
📈 Database Statistics:
   Users: ${userCount}
   Photos: ${photoCount}
   Portfolios: ${portfolioCount}
    `);

    console.log('🎉 Database initialization completed successfully!');
    console.log(`
📋 Next Steps:
   1. Start the backend server: npm run dev
   2. Login to admin dashboard with initial credentials
   3. Change admin password in MongoDB Atlas or through admin panel
   4. Configure additional admin users as needed
    `);

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run initialization
initializeDatabase();

