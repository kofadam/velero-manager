#!/bin/bash
# Script to create the velero-gitops repository structure

set -euo pipefail

REPO_NAME="velero-gitops"
GITHUB_USER="kofadam"

echo "📁 Creating velero-gitops repository structure..."

# Create base directory
mkdir -p $REPO_NAME
cd $REPO_NAME

# Initialize git
git init

# Create directory structure
mkdir -p management-cluster/{argocd-apps,velero/{rbac,backup-controller,monitoring,audit,cronjobs}}
mkdir -p guest-clusters/{minikube,base}
mkdir -p environments/{dev,prod}

# Create README
cat > README.md << 'EOF'
# Velero GitOps Configuration

This repository contains the GitOps configuration for Velero multi-cluster backup management.

## Structure

- `management-cluster/` - Management cluster components
  - `argocd-apps/` - ArgoCD application definitions
  - `velero/` - Velero backup orchestration components
- `guest-clusters/` - Guest cluster configurations
  - `minikube/` - Minikube cluster specific configs
  - `base/` - Base configurations for all guest clusters
- `environments/` - Environment-specific overlays

## Setup

1. Fork this repository
2. Update ArgoCD application to point to your fork
3. Configure cluster credentials
4. Apply ArgoCD applications

## Clusters

- **Management**: microk8s
- **Guest**: minikube

## Storage

- **Backend**: MinIO
- **Buckets**: velero-backups
EOF

echo "✅ Repository structure created!"
echo ""
echo "📝 Next steps:"
echo "1. cd $REPO_NAME"
echo "2. git add ."
echo "3. git commit -m 'Initial GitOps structure'"
echo "4. gh repo create $GITHUB_USER/$REPO_NAME --public --source=. --remote=origin --push"
echo ""
echo "Or manually:"
echo "1. Create repo at https://github.com/$GITHUB_USER/$REPO_NAME"
echo "2. git remote add origin git@github.com:$GITHUB_USER/$REPO_NAME.git"
echo "3. git push -u origin main"
