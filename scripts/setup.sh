#!/bin/bash

# Lens Backend Setup Script
echo "🚀 Setting up Lens Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if MongoDB is running
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB is not installed locally. You can use Docker instead."
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp env.example .env
    echo "✅ .env file created. Please update it with your configuration."
else
    echo "✅ .env file already exists."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create uploads directory
mkdir -p uploads/photos
mkdir -p uploads/avatars
mkdir -p uploads/cover-photos

echo "✅ Setup completed!"
echo ""
echo "🔧 Next steps:"
echo "1. Update your .env file with your configuration"
echo "2. Start MongoDB (or use Docker: docker-compose up mongodb)"
echo "3. Run 'npm run dev' to start the development server"
echo "4. Or use 'docker-compose up' to run everything with Docker"
