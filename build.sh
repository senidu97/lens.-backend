#!/bin/bash

echo "🔨 Building Lens Backend Docker image..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "Creating basic .env file..."
    cat > .env << EOF
MONGODB_URI=mongodb://localhost:27017/lens
JWT_SECRET=your-jwt-secret-change-this
JWT_REFRESH_SECRET=your-refresh-secret-change-this
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d
PORT=5000
NODE_ENV=production
FRONTEND_URL=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    echo "✅ Basic .env created - please update with your values"
fi

# Try building with main Dockerfile first
echo "Building Docker image with main Dockerfile..."
docker build -t lens-backend:latest .

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "To run the container:"
    echo "docker run -p 5000:5000 --env-file .env lens-backend:latest"
else
    echo "❌ Main Dockerfile build failed!"
    echo "Trying simple Dockerfile..."
    
    # Try with simple Dockerfile
    docker build -f Dockerfile.simple -t lens-backend:latest .
    
    if [ $? -eq 0 ]; then
        echo "✅ Build successful with simple Dockerfile!"
        echo ""
        echo "To run the container:"
        echo "docker run -p 5000:5000 -e MONGODB_URI=mongodb://localhost:27017/lens lens-backend:latest"
    else
        echo "❌ Both builds failed!"
        echo "Check the error messages above for details."
        echo ""
        echo "Troubleshooting tips:"
        echo "1. Make sure Docker is running"
        echo "2. Check your internet connection"
        echo "3. Try: docker system prune -a"
        echo "4. Check if package.json is valid"
    fi
fi
