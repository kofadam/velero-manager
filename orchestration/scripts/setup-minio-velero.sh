#!/bin/bash
# Setup MinIO for Velero backups

set -euo pipefail

echo "🔧 Setting up MinIO for Velero..."

# Check if MinIO is accessible
kubectl config use-context microk8s

# Get MinIO service details
MINIO_NAMESPACE="minio-operator"
echo "📍 Checking MinIO in namespace: $MINIO_NAMESPACE"

# Port forward to MinIO console (if needed)
echo "📡 Setting up port-forward to MinIO console..."
echo "Run this in another terminal:"
echo "kubectl port-forward -n $MINIO_NAMESPACE svc/console 9090:9090"
echo ""
echo "Then access: http://localhost:9090"
echo ""

# Create MinIO credentials file for Velero
cat > minio-credentials.txt << 'EOF'
[default]
aws_access_key_id = minioadmin
aws_secret_access_key = minioadmin
EOF

echo "📝 MinIO credentials file created: minio-credentials.txt"
echo ""
echo "⚠️  Update these with your actual MinIO credentials!"
echo ""

# Create Velero backup location configuration
cat > velero-backup-location.yaml << 'EOF'
---
# This goes in: management-cluster/velero/backup-locations/minio.yaml
apiVersion: velero.io/v1
kind: BackupStorageLocation
metadata:
  name: default
  namespace: velero
spec:
  provider: aws
  objectStorage:
    bucket: velero-backups
  config:
    region: minio
    s3ForcePathStyle: "true"
    s3Url: http://minio.minio-operator.svc.cluster.local:9000
    publicUrl: http://minio.homelab.local:9000
  credential:
    name: cloud-credentials
    key: cloud

---
# Secret for MinIO credentials
apiVersion: v1
kind: Secret
metadata:
  name: cloud-credentials
  namespace: velero
type: Opaque
stringData:
  cloud: |
    [default]
    aws_access_key_id = minioadmin
    aws_secret_access_key = minioadmin
EOF

echo "✅ Backup location configuration created!"

# Test MinIO connectivity from within cluster
cat > test-minio-job.yaml << 'EOF'
apiVersion: batch/v1
kind: Job
metadata:
  name: test-minio-connection
  namespace: velero
spec:
  template:
    spec:
      containers:
      - name: test
        image: amazon/aws-cli:latest
        command:
        - sh
        - -c
        - |
          echo "Testing MinIO connection..."
          aws --endpoint-url http://minio.minio-operator.svc.cluster.local:9000 \
              s3 ls \
              || echo "Connection failed - check credentials"
        env:
        - name: AWS_ACCESS_KEY_ID
          value: "minioadmin"
        - name: AWS_SECRET_ACCESS_KEY
          value: "minioadmin"
      restartPolicy: Never
  backoffLimit: 1
EOF

echo "📋 Created test job: test-minio-job.yaml"
echo ""
echo "To test MinIO connection:"
echo "kubectl apply -f test-minio-job.yaml"
echo "kubectl logs job/test-minio-connection -n velero"
