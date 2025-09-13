#!/bin/bash
# Deploy Velero on minikube guest cluster

set -euo pipefail

echo "🚀 Deploying Velero on minikube..."

# Switch to minikube context
kubectl config use-context minikube

# Create velero namespace
kubectl create namespace velero || echo "Namespace already exists"

# Install Velero using kubectl (simplified for testing)
echo "📦 Installing Velero..."

# Download and install Velero CLI if not present
if ! command -v velero &> /dev/null; then
    echo "📥 Downloading Velero CLI..."
    wget https://github.com/vmware-tanzu/velero/releases/download/v1.13.0/velero-v1.13.0-linux-amd64.tar.gz
    tar -xvf velero-v1.13.0-linux-amd64.tar.gz
    sudo mv velero-v1.13.0-linux-amd64/velero /usr/local/bin/
fi

# Get microk8s cluster IP for MinIO access
MICROK8S_IP=$(kubectl config view -o jsonpath='{.clusters[?(@.name=="microk8s-cluster")].cluster.server}' | sed 's|https://||' | cut -d: -f1)

# If MinIO is accessible from minikube, use direct connection
# Otherwise, we'll need to set up a tunnel or use NodePort
echo "🔗 Configuring MinIO endpoint..."
echo "MicroK8s IP: $MICROK8S_IP"

# Create MinIO credentials
cat > credentials-velero << EOF
[default]
aws_access_key_id = minioadmin
aws_secret_access_key = minioadmin
EOF

# Install Velero with MinIO backend
velero install \
    --provider aws \
    --plugins velero/velero-plugin-for-aws:v1.9.0 \
    --bucket velero-backups \
    --secret-file ./credentials-velero \
    --use-node-agent \
    --backup-location-config region=minio,s3ForcePathStyle="true",s3Url=http://${MICROK8S_IP}:9000 \
    --snapshot-location-config region=minio \
    --wait

echo "✅ Velero installed on minikube!"

# Create minimal RBAC for remote management
cat > minikube-velero-rbac.yaml << 'EOF'
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: velero-remote-trigger
  namespace: velero

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: velero-remote-backup
rules:
- apiGroups: ["velero.io"]
  resources: ["backups", "schedules", "backupstoragelocations"]
  verbs: ["create", "get", "list", "watch"]
- apiGroups: ["velero.io"]
  resources: ["backups/status"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["get", "list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: velero-remote-backup
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: velero-remote-backup
subjects:
- kind: ServiceAccount
  name: velero-remote-trigger
  namespace: velero

---
apiVersion: v1
kind: Secret
metadata:
  name: velero-remote-trigger-token
  namespace: velero
  annotations:
    kubernetes.io/service-account.name: velero-remote-trigger
type: kubernetes.io/service-account-token
EOF

echo "📝 Applying RBAC configuration..."
kubectl apply -f minikube-velero-rbac.yaml

# Wait for token generation
sleep 5

# Extract credentials for management cluster
echo "🔑 Extracting service account token..."
TOKEN=$(kubectl get secret velero-remote-trigger-token -n velero -o jsonpath='{.data.token}' | base64 -d)
CA_CERT=$(kubectl get secret velero-remote-trigger-token -n velero -o jsonpath='{.data.ca\.crt}')
SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')

echo ""
echo "✅ Minikube Velero Setup Complete!"
echo ""
echo "📋 Connection details for management cluster:"
echo "Server: $SERVER"
echo "Token: [extracted]"
echo ""
echo "Next: Create secret on management cluster with these credentials"
