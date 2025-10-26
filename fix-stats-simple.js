// Simple script to fix user stats
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
  username: String,
  stats: {
    totalPhotos: { type: Number, default: 0 }
  }
});

const photoSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const User = mongoose.model('User', userSchema);
const Photo = mongoose.model('Photo', photoSchema);

async function fixStats() {
  try {
    console.log('Fixing user stats...');
    
    // Find user with username "senindu" or similar
    const users = await User.find({});
    console.log(`Found ${users.length} users`);
    
    for (const user of users) {
      const actualCount = await Photo.countDocuments({ user: user._id });
      console.log(`User ${user.username}: DB shows ${user.stats.totalPhotos}, actual photos: ${actualCount}`);
      
      if (user.stats.totalPhotos !== actualCount) {
        await User.findByIdAndUpdate(user._id, {
          $set: { 'stats.totalPhotos': actualCount }
        });
        console.log(`✅ Fixed ${user.username}: Updated to ${actualCount}`);
      }
    }
    
    console.log('✅ Stats fixed!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixStats();


