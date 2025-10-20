const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

// Create admin user
const createAdminUser = async () => {
  await connectDB();

  const User = require('./src/models/User');

  const adminData = {
    username: 'admin',
    email: 'admin@lens.com',
    password: 'admin123',
    role: 'super_admin',
    isVerified: true,
    isActive: true,
    firstName: 'Admin',
    lastName: 'User'
  };

  try {
    // Check if admin already exists
    let admin = await User.findOne({ email: adminData.email });

    if (admin) {
      console.log('Admin user already exists. Updating...');
      admin.username = adminData.username;
      admin.password = adminData.password; // Will be hashed by pre-save middleware
      admin.role = adminData.role;
      admin.isActive = adminData.isActive;
      admin.isVerified = adminData.isVerified;
      admin.firstName = adminData.firstName;
      admin.lastName = adminData.lastName;
      await admin.save();
      console.log('Admin user updated successfully!');
    } else {
      admin = await User.create(adminData);
      console.log('Admin user created successfully!');
    }

    console.log(`
Admin User Details:
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
    mongoose.connection.close();
  }
};

createAdminUser();
