// Test admin login API endpoint
const axios = require('axios');

async function testAdminLogin() {
  try {
    console.log('🧪 Testing admin login...');
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      identifier: 'admin@lens.com',
      password: 'admin123'
    });
    
    console.log('✅ Login successful!');
    console.log('User:', response.data.data.user);
    console.log('Token:', response.data.data.token ? 'Present' : 'Missing');
    
  } catch (error) {
    console.error('❌ Login failed:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.message);
    console.error('Errors:', error.response?.data?.errors);
  }
}

testAdminLogin();

