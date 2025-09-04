#!/bin/bash
set -e

# Get version (trim whitespace)
VERSION=$(./version.sh | tr -d '\n\r')
echo "Building Velero Manager version: $VERSION"

# Build frontend with version
echo "Building frontend..."
cd frontend
REACT_APP_VERSION="$VERSION" npm run build
cd ..

# Build Docker image with version tag
echo "Building Docker image..."
docker build --build-arg REACT_APP_VERSION="$VERSION" -t velero-manager:latest -t "localhost:32000/velero-manager:$VERSION" .

# Push to local registry for testing
echo "Pushing to local registry..."
docker push "localhost:32000/velero-manager:$VERSION"

echo "Build complete! Version: $VERSION"
echo "Image available at: localhost:32000/velero-manager:$VERSION"
