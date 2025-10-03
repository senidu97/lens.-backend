#!/usr/bin/env node

/**
 * Test R2 Environment-Based Directory Structure
 * This script tests the environment prefix functionality
 */

const { generateKey, generateUrl } = require('../src/utils/r2');

// Mock environment variables for testing
process.env.R2_ENVIRONMENT_PREFIX = process.env.R2_ENVIRONMENT_PREFIX || 'test';
process.env.R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://test-bucket.test.r2.cloudflarestorage.com';

function testEnvironmentStructure() {
  console.log('🧪 Testing R2 Environment-Based Directory Structure\n');
  
  // Test different environments
  const environments = ['dev', 'staging', 'prod'];
  
  environments.forEach(env => {
    console.log(`📁 Testing environment: ${env}`);
    process.env.R2_ENVIRONMENT_PREFIX = env;
    
    // Test photo key generation
    const photoKey = generateKey('photos', 'user123/1704067200000_abc123.jpg');
    const photoUrl = generateUrl(photoKey);
    
    // Test avatar key generation
    const avatarKey = generateKey('avatars', 'user123/1704067200000_def456.jpg');
    const avatarUrl = generateUrl(avatarKey);
    
    // Test cover photo key generation
    const coverKey = generateKey('cover-photos', 'user123/1704067200000_ghi789.jpg');
    const coverUrl = generateUrl(coverKey);
    
    console.log(`  📸 Photo: ${photoKey}`);
    console.log(`     URL: ${photoUrl}`);
    console.log(`  👤 Avatar: ${avatarKey}`);
    console.log(`     URL: ${avatarUrl}`);
    console.log(`  🖼️  Cover: ${coverKey}`);
    console.log(`     URL: ${coverUrl}`);
    console.log('');
  });
  
  // Test custom environment
  console.log('📁 Testing custom environment: "myapp"');
  process.env.R2_ENVIRONMENT_PREFIX = 'myapp';
  
  const customKey = generateKey('photos', 'user456/1704067200000_xyz789.jpg');
  const customUrl = generateUrl(customKey);
  
  console.log(`  📸 Custom: ${customKey}`);
  console.log(`     URL: ${customUrl}`);
  console.log('');
  
  // Test NODE_ENV fallback
  console.log('📁 Testing NODE_ENV fallback (when R2_ENVIRONMENT_PREFIX not set)');
  delete process.env.R2_ENVIRONMENT_PREFIX;
  process.env.NODE_ENV = 'testing';
  
  const fallbackKey = generateKey('photos', 'user789/1704067200000_fallback.jpg');
  const fallbackUrl = generateUrl(fallbackKey);
  
  console.log(`  📸 Fallback: ${fallbackKey}`);
  console.log(`     URL: ${fallbackUrl}`);
  console.log('');
  
  // Expected output examples
  console.log('✅ Expected Directory Structure:');
  console.log('your-bucket/');
  console.log('├── dev/');
  console.log('│   ├── photos/user123/1704067200000_abc123.jpg');
  console.log('│   ├── avatars/user123/1704067200000_def456.jpg');
  console.log('│   └── cover-photos/user123/1704067200000_ghi789.jpg');
  console.log('├── staging/');
  console.log('│   ├── photos/user123/1704067200000_abc123.jpg');
  console.log('│   ├── avatars/user123/1704067200000_def456.jpg');
  console.log('│   └── cover-photos/user123/1704067200000_ghi789.jpg');
  console.log('├── prod/');
  console.log('│   ├── photos/user123/1704067200000_abc123.jpg');
  console.log('│   ├── avatars/user123/1704067200000_def456.jpg');
  console.log('│   └── cover-photos/user123/1704067200000_ghi789.jpg');
  console.log('├── myapp/');
  console.log('│   └── photos/user456/1704067200000_xyz789.jpg');
  console.log('└── testing/');
  console.log('    └── photos/user789/1704067200000_fallback.jpg');
  console.log('');
  
  console.log('🎉 Environment-based directory structure test completed!');
  console.log('');
  console.log('💡 To use this in your application:');
  console.log('1. Set R2_ENVIRONMENT_PREFIX in your .env file');
  console.log('2. Use different values for different environments:');
  console.log('   - Development: R2_ENVIRONMENT_PREFIX=dev');
  console.log('   - Staging: R2_ENVIRONMENT_PREFIX=staging');
  console.log('   - Production: R2_ENVIRONMENT_PREFIX=prod');
  console.log('3. Files will be automatically organized by environment');
}

// Run the test
testEnvironmentStructure();

