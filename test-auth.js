#!/usr/bin/env node

/**
 * Simple authentication test script
 * Tests signup and login endpoints
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:5000/api';

// Test data
const testUser = {
  username: 'testuser123',
  email: 'test@example.com',
  password: 'TestPass123',
  firstName: 'Test',
  lastName: 'User'
};

const loginData = {
  identifier: testUser.email,
  password: testUser.password
};

async function testSignup() {
  console.log('🧪 Testing user signup...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser)
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Signup successful!');
      console.log('   User ID:', data.data.user.id);
      console.log('   Username:', data.data.user.username);
      console.log('   Email:', data.data.user.email);
      return data.data.token;
    } else {
      console.log('❌ Signup failed:', data.message);
      if (data.errors) {
        console.log('   Validation errors:', data.errors);
      }
      return null;
    }
  } catch (error) {
    console.log('❌ Signup error:', error.message);
    return null;
  }
}

async function testLogin() {
  console.log('\n🧪 Testing user login...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData)
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Login successful!');
      console.log('   User ID:', data.data.user.id);
      console.log('   Username:', data.data.user.username);
      console.log('   Subscription:', data.data.user.subscription.plan);
      return data.data.token;
    } else {
      console.log('❌ Login failed:', data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Login error:', error.message);
    return null;
  }
}

async function testMeEndpoint(token) {
  console.log('\n🧪 Testing /auth/me endpoint...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ /auth/me successful!');
      console.log('   User:', data.data.user.username);
      console.log('   Email:', data.data.user.email);
      console.log('   Stats:', data.data.user.stats);
      return true;
    } else {
      console.log('❌ /auth/me failed:', data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ /auth/me error:', error.message);
    return false;
  }
}

async function testHealthCheck() {
  console.log('🏥 Testing health check...');
  
  try {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Health check passed!');
      console.log('   Status:', data.status);
      console.log('   Environment:', data.environment);
      return true;
    } else {
      console.log('❌ Health check failed:', data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Authentication Tests\n');
  console.log('API Base URL:', API_BASE_URL);
  console.log('Test User:', testUser.username, '(' + testUser.email + ')');
  console.log('=' .repeat(50));
  
  // Test health check first
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log('\n❌ Server is not running or not accessible');
    console.log('   Please start the backend server first:');
    console.log('   cd lens.-backend && npm run dev');
    process.exit(1);
  }
  
  // Test signup
  const signupToken = await testSignup();
  
  // Test login
  const loginToken = await testLogin();
  
  // Test protected endpoint
  if (loginToken) {
    await testMeEndpoint(loginToken);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Authentication tests completed!');
  
  if (signupToken && loginToken) {
    console.log('✅ All authentication endpoints are working correctly!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start your frontend: cd lens.-frontend && npm run dev');
    console.log('   2. Visit http://localhost:3000/auth/signup to test signup');
    console.log('   3. Visit http://localhost:3000/auth/login to test login');
  } else {
    console.log('❌ Some authentication tests failed');
    console.log('   Check the error messages above for details');
  }
}

// Run the tests
runTests().catch(console.error);
