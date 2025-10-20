const mongoose = require('mongoose');
const User = require('./src/models/User');
const Photo = require('./src/models/Photo');
require('dotenv').config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

const recalculateUserStats = async () => {
  try {
    console.log('Starting user stats recalculation...');
    
    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to process`);
    
    for (const user of users) {
      // Count actual photos for this user
      const actualPhotoCount = await Photo.countDocuments({ user: user._id });
      
      // Update user stats if there's a discrepancy
      if (user.stats.totalPhotos !== actualPhotoCount) {
        console.log(`User ${user.username}: Stats show ${user.stats.totalPhotos} photos, but actually has ${actualPhotoCount} photos`);
        
        await User.findByIdAndUpdate(user._id, {
          $set: { 'stats.totalPhotos': actualPhotoCount }
        });
        
        console.log(`✅ Updated ${user.username}'s photo count to ${actualPhotoCount}`);
      } else {
        console.log(`✅ ${user.username}: Stats are accurate (${actualPhotoCount} photos)`);
      }
    }
    
    console.log('✅ User stats recalculation completed!');
  } catch (error) {
    console.error('Error recalculating user stats:', error);
  } finally {
    mongoose.connection.close();
  }
};

const main = async () => {
  await connectDB();
  await recalculateUserStats();
};

main();

