const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    if (existingSuperAdmin) {
      console.log('Super admin already exists:', existingSuperAdmin.username);
      process.exit(0);
    }

    // Create super admin user
    const superAdmin = await User.create({
      username: process.env.SUPER_ADMIN_USERNAME || 'admin',
      email: process.env.SUPER_ADMIN_EMAIL || 'admin@lens.com',
      password: process.env.SUPER_ADMIN_PASSWORD || 'admin123',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
      isVerified: true,
      isActive: true
    });

    console.log('Super admin created successfully:');
    console.log('Username:', superAdmin.username);
    console.log('Email:', superAdmin.email);
    console.log('Role:', superAdmin.role);
    console.log('\nPlease change the default password after first login!');

  } catch (error) {
    console.error('Error creating super admin:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

createSuperAdmin();
