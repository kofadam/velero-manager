#!/bin/bash
set -e

# Get version
VERSION=$(./version.sh)
echo "🏗️  Building Velero Manager version: $VERSION"

# Build frontend with version
echo "📦 Building frontend..."
cd frontend
REACT_APP_VERSION="$VERSION" npm run build
cd ..

# Build Docker image with version tag
echo "🐳 Building Docker image..."
docker build -t velero-manager:latest -t "kofadam/velero-manager:$VERSION" .

# Save image for air-gap transfer
echo "💾 Saving Docker image for air-gap transfer..."
docker save "kofadam/velero-manager:$VERSION" | gzip > "velero-manager-$VERSION.tar.gz"

echo "✅ Build complete! Files ready for air-gap deployment:"
echo "   - velero-manager-$VERSION.tar.gz (Docker image)"
echo "   - k8s/ directory (Kubernetes manifests)"
echo ""
echo "📋 Next steps:"
echo "   1. Transfer files to air-gap environment"
echo "   2. docker load < velero-manager-$VERSION.tar.gz"
echo "   3. Update k8s/deployment.yaml image to kofadam/velero-manager:$VERSION"
echo "   4. kubectl apply -f k8s/"
echo ""
echo "🏷️  Version: $VERSION"