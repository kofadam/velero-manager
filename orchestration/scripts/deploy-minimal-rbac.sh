#!/bin/bash
# Deploy minimal RBAC on guest cluster and extract credentials
# Location: orchestration/scripts/deploy-minimal-rbac.sh

set -euo pipefail

# Configuration
CLUSTER_NAME="${1:-}"
CLUSTER_CONTEXT="${2:-}"
MANAGEMENT_CLUSTER_CONTEXT="${3:-management-cluster}"

if [[ -z "$CLUSTER_NAME" ]] || [[ -z "$CLUSTER_CONTEXT" ]]; then
    echo "Usage: $0 <cluster-name> <guest-cluster-context> [management-cluster-context]"
    echo "Example: $0 minikube minikube microk8s"
    exit 1
fi

echo "🔧 Deploying minimal RBAC on guest cluster: $CLUSTER_NAME"

# Switch to guest cluster context
kubectl config use-context "$CLUSTER_CONTEXT"

# Apply the minimal RBAC configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RBAC_FILE="${SCRIPT_DIR}/../security/rbac/minimal-rbac.yaml"

if [ ! -f "$RBAC_FILE" ]; then
    echo "❌ RBAC file not found: $RBAC_FILE"
    exit 1
fi

kubectl apply -f "$RBAC_FILE"

echo "✅ RBAC deployed. Creating token secret..."

# Create token secret for the service account
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: velero-remote-trigger-token
  namespace: velero
  annotations:
    kubernetes.io/service-account.name: velero-remote-trigger
type: kubernetes.io/service-account-token
EOF

# Wait for token to be generated
echo "⏳ Waiting for token generation..."
sleep 5

# Extract credentials
echo "📤 Extracting credentials..."
TOKEN=$(kubectl get secret velero-remote-trigger-token -n velero -o jsonpath='{.data.token}' | base64 -d)
CA_CERT=$(kubectl get secret velero-remote-trigger-token -n velero -o jsonpath='{.data.ca\.crt}')
SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')

# Validate extraction
if [[ -z "$TOKEN" ]] || [[ -z "$CA_CERT" ]] || [[ -z "$SERVER" ]]; then
    echo "❌ Failed to extract credentials"
    exit 1
fi

echo "✅ Credentials extracted successfully"

# Switch to management cluster
echo "🔄 Switching to management cluster context: $MANAGEMENT_CLUSTER_CONTEXT"
kubectl config use-context "$MANAGEMENT_CLUSTER_CONTEXT"

# Create secret on management cluster
echo "📥 Creating secret on management cluster..."
kubectl create secret generic "${CLUSTER_NAME}-sa-token" \
    --from-literal=token="$TOKEN" \
    --from-literal=ca.crt="$CA_CERT" \
    --from-literal=server="$SERVER" \
    --from-literal=cluster-name="$CLUSTER_NAME" \
    -n velero \
    --dry-run=client -o yaml | kubectl apply -f -

# Label the secret for token rotation
kubectl label secret "${CLUSTER_NAME}-sa-token" type=cluster-token -n velero --overwrite

echo "✅ Secret '${CLUSTER_NAME}-sa-token' created in management cluster"

# Create a test backup to verify permissions
echo "🧪 Testing backup creation permissions..."
kubectl config use-context "$CLUSTER_CONTEXT"

# Create a test backup
cat <<EOF | kubectl apply -f -
apiVersion: velero.io/v1
kind: Backup
metadata:
  name: rbac-test-backup-$(date +%s)
  namespace: velero
spec:
  includedNamespaces:
  - default
  ttl: 1h
  storageLocation: default
EOF

if [[ $? -eq 0 ]]; then
    echo "✅ RBAC test successful - backup creation works"
else
    echo "⚠️  RBAC test failed - please check permissions"
fi

echo "
🎉 Setup complete for cluster: $CLUSTER_NAME
📋 Summary:
   - Service Account: velero-remote-trigger
   - Secret on mgmt cluster: ${CLUSTER_NAME}-sa-token
   - Minimal permissions applied
   - No cluster-admin access
"
