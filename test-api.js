#!/usr/bin/env node

const http = require('http');

console.log('🧪 Testing Backend API Endpoints...\n');

const endpoints = [
  { path: '/health', method: 'GET', description: 'Health Check' },
  { path: '/api/auth/register', method: 'POST', description: 'User Registration' },
  { path: '/api/auth/login', method: 'POST', description: 'User Login' },
  { path: '/api/users', method: 'GET', description: 'Get Users' },
  { path: '/api/portfolios', method: 'GET', description: 'Get Portfolios' },
  { path: '/api/photos', method: 'GET', description: 'Get Photos' }
];

function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: endpoint.path,
      method: endpoint.method,
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          endpoint: endpoint.path,
          method: endpoint.method,
          description: endpoint.description,
          status: res.statusCode,
          success: res.statusCode < 400
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        endpoint: endpoint.path,
        method: endpoint.method,
        description: endpoint.description,
        status: 'ERROR',
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        endpoint: endpoint.path,
        method: endpoint.method,
        description: endpoint.description,
        status: 'TIMEOUT',
        success: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing endpoints on http://localhost:5000...\n');
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    
    const status = result.success ? '✅' : '❌';
    const statusText = typeof result.status === 'number' ? result.status : result.status;
    
    console.log(`${status} ${endpoint.method} ${endpoint.path}`);
    console.log(`   ${endpoint.description}`);
    console.log(`   Status: ${statusText}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  }
  
  console.log('🎉 API testing complete!');
  console.log('\n📋 Available API Routes:');
  console.log('   GET  /health           - Health check');
  console.log('   POST /api/auth/register - User registration');
  console.log('   POST /api/auth/login    - User login');
  console.log('   GET  /api/users         - Get users');
  console.log('   GET  /api/portfolios    - Get portfolios');
  console.log('   GET  /api/photos        - Get photos');
  console.log('   POST /api/upload        - File upload');
}

runTests().catch(console.error);


