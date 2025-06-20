#!/bin/bash
set -e

echo "Setting up build environment..."

# Ensure node_modules/.bin is in PATH
export PATH="$PWD/node_modules/.bin:$PATH"

# Make vite executable
chmod +x node_modules/.bin/vite 2>/dev/null || true

echo "Running build..."
npm run build

echo "Build completed successfully!"