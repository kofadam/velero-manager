#!/bin/bash
set -e

echo "🏗️  Building Velero Manager for air-gap deployment..."

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm run build
cd ..

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t velero-manager:latest .

# Save image for air-gap transfer
echo "💾 Saving Docker image for air-gap transfer..."
docker save velero-manager:latest | gzip > velero-manager-latest.tar.gz

echo "✅ Build complete! Files ready for air-gap deployment:"
echo "   - velero-manager-latest.tar.gz (Docker image)"
echo "   - k8s/ directory (Kubernetes manifests)"
echo ""
echo "📋 Next steps:"
echo "   1. Transfer files to air-gap environment"
echo "   2. docker load < velero-manager-latest.tar.gz"
echo "   3. Update k8s/ingress.yaml with your domain"
echo "   4. kubectl apply -f k8s/"
