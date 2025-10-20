const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Simple admin user creation
async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lens-dev');
    console.log('Connected to MongoDB');

    // Define User schema inline
    const userSchema = new mongoose.Schema({
      username: { type: String, required: true, unique: true },
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      role: { type: String, enum: ['user', 'admin', 'super_admin'], default: 'user' },
      isVerified: { type: Boolean, default: false },
      isActive: { type: Boolean, default: true },
      firstName: String,
      lastName: String,
      avatar: String,
      bio: String,
      website: String,
      location: String,
      subscription: {
        plan: { type: String, enum: ['free', 'pro'], default: 'free' },
        isActive: { type: Boolean, default: true }
      },
      stats: {
        totalPhotos: { type: Number, default: 0 },
        totalViews: { type: Number, default: 0 },
        totalLikes: { type: Number, default: 0 },
        publicPhotos: { type: Number, default: 0 }
      },
      preferences: {
        theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
        emailNotifications: { type: Boolean, default: true },
        publicProfile: { type: Boolean, default: true }
      },
      refreshTokens: [String],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });

    // Pre-save middleware to hash password
    userSchema.pre('save', async function(next) {
      if (!this.isModified('password')) return next();
      this.password = await bcrypt.hash(this.password, 12);
      next();
    });

    const User = mongoose.model('User', userSchema);

    // Check if admin already exists
    let admin = await User.findOne({ email: 'admin@lens.com' });

    if (admin) {
      console.log('Admin user already exists. Updating...');
      admin.username = 'admin';
      admin.password = 'admin123'; // Will be hashed by pre-save middleware
      admin.role = 'super_admin';
      admin.isActive = true;
      admin.isVerified = true;
      admin.firstName = 'Admin';
      admin.lastName = 'User';
      await admin.save();
      console.log('Admin user updated successfully!');
    } else {
      admin = await User.create({
        username: 'admin',
        email: 'admin@lens.com',
        password: 'admin123',
        role: 'super_admin',
        isVerified: true,
        isActive: true,
        firstName: 'Admin',
        lastName: 'User'
      });
      console.log('Admin user created successfully!');
    }

    console.log(`
✅ Admin User Details:
- Username: ${admin.username}
- Email: ${admin.email}
- Role: ${admin.role}
- Password: admin123 (please change after first login!)
- Active: ${admin.isActive}
- Verified: ${admin.isVerified}
    `);

  } catch (error) {
    console.error('Error creating admin user:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Load environment variables
require('dotenv').config();

// Run the function
createAdminUser();
