#!/bin/bash
set -e

echo "Starting build process..."

# Navigate to frontend directory
cd frontend/dis

echo "Installing frontend dependencies..."
npm install

echo "Setting up build environment..."
# Ensure node_modules/.bin is in PATH
export PATH="$PWD/node_modules/.bin:$PATH"

# Make vite executable (ignore errors if already executable)
chmod +x node_modules/.bin/vite 2>/dev/null || true

echo "Building frontend..."
# Try multiple approaches to run vite build
if command -v npx >/dev/null 2>&1; then
    echo "Using npx to run vite build..."
    npx vite build
elif [ -x "node_modules/.bin/vite" ]; then
    echo "Using direct vite binary..."
    ./node_modules/.bin/vite build
else
    echo "Using node to run vite..."
    node node_modules/vite/bin/vite.js build
fi

echo "Build completed successfully!"
echo "Build output is in frontend/dis/dist/"