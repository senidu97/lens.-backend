#!/usr/bin/env node

/**
 * Environment Setup Script for Lens Backend
 * This script helps users configure their .env file with R2 settings
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function generateEnvFile() {
  console.log('🚀 Lens Backend Environment Setup\n');
  console.log('This script will help you create a .env file for local development.\n');

  // Check if .env already exists
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      process.exit(0);
    }
  }

  console.log('📋 Please provide the following information:\n');

  // Basic configuration
  const port = await question('Port (default: 5000): ') || '5000';
  const nodeEnv = await question('Environment (default: development): ') || 'development';
  
  // Database
  console.log('\n🗄️  Database Configuration:');
  const useAtlas = await question('Use MongoDB Atlas (cloud)? (Y/n): ');
  
  let mongoUri;
  if (useAtlas.toLowerCase() !== 'n') {
    console.log('\n📋 MongoDB Atlas Connection String:');
    console.log('Format: mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority');
    mongoUri = await question('MongoDB Atlas URI: ');
    
    if (!mongoUri || !mongoUri.includes('mongodb+srv://')) {
      console.log('⚠️  Invalid Atlas URI format. Please use mongodb+srv://...');
      mongoUri = await question('MongoDB Atlas URI: ');
    }
  } else {
    mongoUri = await question('MongoDB URI (default: mongodb://localhost:27017/lens-portfolio): ') || 
      'mongodb://localhost:27017/lens-portfolio';
  }

  // JWT secrets
  console.log('\n🔐 JWT Configuration:');
  const jwtSecret = await question('JWT Secret (generate a secure random string): ');
  const jwtRefreshSecret = await question('JWT Refresh Secret (generate a secure random string): ');

  // R2 Configuration
  console.log('\n☁️  Cloudflare R2 Configuration:');
  console.log('Get these values from your Cloudflare Dashboard → R2 Object Storage\n');
  
  const r2AccountId = await question('R2 Account ID: ');
  const r2AccessKeyId = await question('R2 Access Key ID: ');
  const r2SecretAccessKey = await question('R2 Secret Access Key: ');
  const r2BucketName = await question('R2 Bucket Name (e.g., lens-photos-dev): ');
  const r2Region = await question('R2 Region (default: auto): ') || 'auto';
  const r2PublicUrl = await question('R2 Public URL (e.g., https://your-bucket.your-account.r2.cloudflarestorage.com): ');

  // Optional R2 settings
  const useCustomDomain = await question('\nUse custom domain for CDN? (y/N): ');
  let r2CustomDomain = '';
  if (useCustomDomain.toLowerCase() === 'y') {
    r2CustomDomain = await question('Custom CDN Domain (e.g., cdn.yourdomain.com): ');
  }

  // Frontend URL
  const frontendUrl = await question('\nFrontend URL (default: http://localhost:3000): ') || 'http://localhost:3000';

  // File upload settings
  console.log('\n📁 File Upload Configuration:');
  const maxFileSize = await question('Max file size in MB (default: 10): ') || '10';
  const imageQuality = await question('Image quality 1-100 (default: 85): ') || '85';

  // Email (optional)
  console.log('\n📧 Email Configuration (Optional - press Enter to skip):');
  const emailHost = await question('SMTP Host: ');
  const emailUser = await question('SMTP User: ');
  const emailPass = await question('SMTP Password: ');

  // Generate .env content
  const envContent = `# =============================================================================
# LENS BACKEND - ENVIRONMENT CONFIGURATION
# Generated on ${new Date().toISOString()}
# =============================================================================

# =============================================================================
# SERVER CONFIGURATION
# =============================================================================
PORT=${port}
NODE_ENV=${nodeEnv}
HOST=localhost

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
MONGODB_URI=${mongoUri}
MONGODB_TEST_URI=mongodb://localhost:27017/lens-portfolio-test

# =============================================================================
# AUTHENTICATION & SECURITY
# =============================================================================
JWT_SECRET=${jwtSecret}
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=${jwtRefreshSecret}
JWT_REFRESH_EXPIRE=30d

# =============================================================================
# CLOUDFLARE R2 STORAGE (Primary Storage)
# =============================================================================
R2_ACCOUNT_ID=${r2AccountId}
R2_ACCESS_KEY_ID=${r2AccessKeyId}
R2_SECRET_ACCESS_KEY=${r2SecretAccessKey}
R2_BUCKET_NAME=${r2BucketName}
R2_REGION=${r2Region}
R2_PUBLIC_URL=${r2PublicUrl}
R2_STORAGE_CLASS=STANDARD
R2_CACHE_CONTROL=max-age=31536000
R2_CONTENT_DISPOSITION=inline
R2_USE_CDN=true${r2CustomDomain ? `\nR2_CDN_CUSTOM_DOMAIN=${r2CustomDomain}` : ''}
R2_ENABLE_IMAGE_TRANSFORMATIONS=true

# =============================================================================
# FILE UPLOAD CONFIGURATION
# =============================================================================
MAX_FILE_SIZE=${parseInt(maxFileSize) * 1024 * 1024}
MAX_AVATAR_SIZE=5242880
MAX_COVER_PHOTO_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp,image/gif
ALLOWED_IMAGE_EXTENSIONS=jpg,jpeg,png,webp,gif
IMAGE_QUALITY=${imageQuality}
IMAGE_MAX_WIDTH=2048
IMAGE_MAX_HEIGHT=2048
THUMBNAIL_SIZE=300
AVATAR_SIZE=400

# =============================================================================
# CORS & FRONTEND CONFIGURATION
# =============================================================================
FRONTEND_URL=${frontendUrl}
CORS_CREDENTIALS=true
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,PATCH,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization,X-Requested-With

# =============================================================================
# RATE LIMITING & SECURITY
# =============================================================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SECURITY_HEADERS_ENABLED=true
HELMET_CSP_ENABLED=true

# =============================================================================
# LOGGING & MONITORING
# =============================================================================
LOG_LEVEL=debug
LOG_FORMAT=combined
DEBUG=lens:*
DEBUG_DATABASE=false
DEBUG_UPLOADS=false

# =============================================================================
# REDIS CONFIGURATION
# =============================================================================
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL=3600

# =============================================================================
# SUBSCRIPTION & LIMITS
# =============================================================================
FREE_PLAN_MAX_PHOTOS=30
FREE_PLAN_MAX_PORTFOLIOS=3
FREE_PLAN_MAX_FILE_SIZE=10485760
PRO_PLAN_MAX_PHOTOS=999999
PRO_PLAN_MAX_PORTFOLIOS=999999
PRO_PLAN_MAX_FILE_SIZE=52428800

# =============================================================================
# DEVELOPMENT & TESTING
# =============================================================================
DEV_AUTO_RELOAD=true
DEV_MOCK_EMAILS=false
DEV_SKIP_AUTH=false
TEST_DATABASE_URI=mongodb://localhost:27017/lens-portfolio-test
TEST_UPLOAD_PATH=./test-uploads

# =============================================================================
# ANALYTICS & TRACKING
# =============================================================================
ANALYTICS_ENABLED=true
TRACK_VIEWS=true
TRACK_DOWNLOADS=true
TRACK_SHARES=true${emailHost ? `

# =============================================================================
# EMAIL CONFIGURATION
# =============================================================================
EMAIL_HOST=${emailHost}
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=${emailUser}
EMAIL_PASS=${emailPass}
EMAIL_FROM=noreply@lens.photography
EMAIL_VERIFICATION_ENABLED=false
EMAIL_WELCOME_ENABLED=true
EMAIL_NOTIFICATIONS_ENABLED=true` : ''}
`;

  // Write .env file
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ .env file created successfully!');
    console.log(`📁 Location: ${envPath}`);
    
    // Create uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      fs.mkdirSync(path.join(uploadsDir, 'photos'), { recursive: true });
      fs.mkdirSync(path.join(uploadsDir, 'avatars'), { recursive: true });
      fs.mkdirSync(path.join(uploadsDir, 'cover-photos'), { recursive: true });
      console.log('📁 Created uploads directory structure');
    }

    console.log('\n🚀 Next steps:');
    console.log('1. Review your .env file and make any necessary adjustments');
    console.log('2. Start MongoDB: docker-compose up mongodb');
    console.log('3. Start the backend: npm run dev');
    console.log('4. Or run everything with Docker: npm run docker:dev');
    
    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
      console.log('\n⚠️  Warning: R2 credentials not provided. File uploads will not work.');
      console.log('   Please update your .env file with valid R2 credentials.');
      console.log('   See R2_SETUP_GUIDE.md for detailed instructions.');
    }

  } catch (error) {
    console.error('\n❌ Error creating .env file:', error.message);
    process.exit(1);
  }

  rl.close();
}

// Generate random JWT secrets
function generateRandomSecret(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Handle command line arguments
if (process.argv.includes('--generate-secrets')) {
  console.log('🔐 Generated JWT Secrets:');
  console.log(`JWT_SECRET=${generateRandomSecret()}`);
  console.log(`JWT_REFRESH_SECRET=${generateRandomSecret()}`);
  process.exit(0);
}

if (process.argv.includes('--help')) {
  console.log(`
Lens Backend Environment Setup

Usage:
  node scripts/env-setup.js              # Interactive setup
  node scripts/env-setup.js --generate-secrets  # Generate JWT secrets
  node scripts/env-setup.js --help       # Show this help

Options:
  --generate-secrets    Generate secure JWT secrets
  --help               Show this help message

Examples:
  npm run setup:env                    # Run interactive setup
  node scripts/env-setup.js --generate-secrets  # Generate secrets
`);
  process.exit(0);
}

// Run the setup
generateEnvFile().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
