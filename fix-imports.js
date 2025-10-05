#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Route files to check
const routeFiles = [
  'src/routes/auth.js',
  'src/routes/users.js', 
  'src/routes/photos.js',
  'src/routes/portfolios.js',
  'src/routes/upload.js'
];

console.log('🔍 Checking route files for missing imports...\n');

routeFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${file} - File not found`);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  console.log(`📄 ${file}:`);
  
  // Check for body usage without import
  if (content.includes('body(') && !content.includes('const { body')) {
    console.log('  ❌ Missing body import from express-validator');
  } else if (content.includes('body(')) {
    console.log('  ✅ body import found');
  }
  
  // Check for query usage without import  
  if (content.includes('query(') && !content.includes('const { query')) {
    console.log('  ❌ Missing query import from express-validator');
  } else if (content.includes('query(')) {
    console.log('  ✅ query import found');
  }
  
  // Check for jwt usage without import
  if (content.includes('jwt.') && !content.includes('const jwt')) {
    console.log('  ❌ Missing jwt import from jsonwebtoken');
  } else if (content.includes('jwt.')) {
    console.log('  ✅ jwt import found');
  }
  
  console.log('');
});

console.log('✅ Import check complete!');


