#!/usr/bin/env node

/**
 * Debug R2 Configuration
 * This script helps debug R2 credential issues
 */

require('dotenv').config();

console.log('🔍 R2 Configuration Debug\n');

// Check if .env is loaded
console.log('📄 Environment Variables:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
console.log('R2_ENVIRONMENT_PREFIX:', process.env.R2_ENVIRONMENT_PREFIX || 'NOT SET (will use NODE_ENV)');

console.log('\n🔑 R2 Credentials:');
console.log('R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID ? `SET (${process.env.R2_ACCOUNT_ID.length} chars)` : 'NOT SET');
console.log('R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? `SET (${process.env.R2_ACCESS_KEY_ID.length} chars)` : 'NOT SET');
console.log('R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? `SET (${process.env.R2_SECRET_ACCESS_KEY.length} chars)` : 'NOT SET');

console.log('\n🪣 R2 Bucket Configuration:');
console.log('R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME || 'NOT SET');
console.log('R2_REGION:', process.env.R2_REGION || 'NOT SET (will use "auto")');
console.log('R2_PUBLIC_URL:', process.env.R2_PUBLIC_URL || 'NOT SET');

console.log('\n🔧 Upload Configuration:');
console.log('MAX_FILE_SIZE:', process.env.MAX_FILE_SIZE || 'NOT SET (will use 10MB)');
console.log('ALLOWED_FILE_TYPES:', process.env.ALLOWED_FILE_TYPES || 'NOT SET');

// Validate credential lengths
console.log('\n✅ Credential Validation:');
const issues = [];

if (process.env.R2_ACCESS_KEY_ID && process.env.R2_ACCESS_KEY_ID.length !== 32) {
  issues.push(`R2_ACCESS_KEY_ID has length ${process.env.R2_ACCESS_KEY_ID.length}, should be 32`);
}

if (process.env.R2_SECRET_ACCESS_KEY && process.env.R2_SECRET_ACCESS_KEY.length !== 40) {
  issues.push(`R2_SECRET_ACCESS_KEY has length ${process.env.R2_SECRET_ACCESS_KEY.length}, should be 40`);
}

if (issues.length === 0) {
  console.log('✅ All credential lengths are correct');
} else {
  console.log('❌ Issues found:');
  issues.forEach(issue => console.log('  -', issue));
}

// Test S3Client initialization
console.log('\n🧪 Testing S3Client Initialization:');
try {
  const { S3Client } = require('@aws-sdk/client-s3');
  
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    console.log('❌ Cannot test S3Client - missing credentials');
  } else {
    const testClient = new S3Client({
      region: process.env.R2_REGION || 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    console.log('✅ S3Client initialized successfully');
  }
} catch (error) {
  console.log('❌ S3Client initialization failed:', error.message);
}

console.log('\n💡 Next Steps:');
if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  console.log('1. Make sure your .env file exists in the lens.-backend directory');
  console.log('2. Add the required R2 credentials to your .env file');
  console.log('3. Restart your server after adding credentials');
} else if (issues.length > 0) {
  console.log('1. Check your R2 credentials in the Cloudflare dashboard');
  console.log('2. Make sure you copied the credentials correctly');
  console.log('3. Generate new credentials if needed');
} else {
  console.log('1. Your R2 configuration looks correct!');
  console.log('2. Try uploading a photo to test the connection');
  console.log('3. Check server logs for any additional error messages');
}
