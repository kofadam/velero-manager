# Velero Deployment and Testing Guide

## Table of Contents

- [Prerequisites](#prerequisites)
- [MinIO Credentials Setup](#minio-credentials-setup)
- [Generic Kubernetes Deployment](#generic-kubernetes-deployment)
- [VMware vSphere Specific Deployment](#vmware-vsphere-specific-deployment)
- [Testing Backup and Restore](#testing-backup-and-restore)
- [Advanced Restore Scenarios](#advanced-restore-scenarios)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Kubernetes cluster v1.19+
- kubectl configured to access your cluster
- Velero CLI v1.16+ installed
- MinIO or S3-compatible storage accessible from cluster
- Cluster admin permissions

### Install Velero CLI

```bash
# Linux/MacOS
wget https://github.com/vmware-tanzu/velero/releases/download/v1.16.2/velero-v1.16.2-linux-amd64.tar.gz
tar -xzf velero-v1.16.2-linux-amd64.tar.gz
sudo mv velero-v1.16.2-linux-amd64/velero /usr/local/bin/

# Verify installation
velero version --client-only
```

## MinIO Credentials Setup

### Create Credentials File

Create a file named `credentials-velero` with your MinIO access credentials:

```ini
[default]
aws_access_key_id = your-minio-access-key
aws_secret_access_key = your-minio-secret-key
```

### For Self-Signed Certificates

If your MinIO uses self-signed certificates, you have two options:

#### Option 1: Configure Velero to skip TLS verification

```bash
# Add to backup-location-config during installation
--backup-location-config region=minio,s3ForcePathStyle=true,s3Url=https://your-minio:9443,insecureSkipTLSVerify=true
```

#### Option 2: Add CA certificate to Velero (Recommended)

```bash
# Create a secret with your CA certificate
kubectl create secret generic minio-ca-cert \
  --from-file=ca-bundle.crt=/path/to/your/ca-cert.pem \
  -n velero

# Reference it during installation (see deployment sections below)
```

## Generic Kubernetes Deployment

### Basic Installation with Node-Agent (File System Backup)

This method works on any Kubernetes cluster regardless of storage provider:

```bash
# Create namespace
kubectl create namespace velero

# Install Velero with node-agent for PVC backup
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.10.0 \
  --bucket velero-backups \
  --backup-location-config region=minio,s3ForcePathStyle=true,s3Url=http://minio.minio-namespace.svc:9000 \
  --use-volume-snapshots=false \
  --use-node-agent \
  --default-volumes-to-fs-backup \
  --secret-file ./credentials-velero \
  --namespace velero
```

### For HTTPS MinIO with Self-Signed Certificate

```bash
# First create the CA certificate secret
kubectl create secret generic minio-ca-cert \
  --from-file=ca-bundle.crt=/path/to/minio-ca.crt \
  -n velero

# Install with CA certificate
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.10.0 \
  --bucket velero-backups \
  --backup-location-config region=minio,s3ForcePathStyle=true,s3Url=https://minio.minio-namespace.svc:9443 \
  --use-volume-snapshots=false \
  --use-node-agent \
  --default-volumes-to-fs-backup \
  --secret-file ./credentials-velero \
  --cacert /path/to/minio-ca.crt \
  --namespace velero
```

### Cloud-Native Installation (AWS/GCP/Azure)

For cloud providers with native snapshot support:

```bash
# AWS EKS Example
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.10.0 \
  --bucket velero-backups \
  --backup-location-config region=us-east-1 \
  --snapshot-location-config region=us-east-1 \
  --use-volume-snapshots=true \
  --secret-file ./credentials-velero \
  --namespace velero
```

## VMware vSphere Specific Deployment

### Prerequisites for vSphere

- vSphere 6.7U3 or later
- vSphere CSI driver installed
- Velero vSphere plugin compatibility verified

### Installation with vSphere Plugin

```bash
# Create namespace
kubectl create namespace velero

# Install Velero with vSphere plugin and AWS plugin for S3
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.10.0,velero/velero-plugin-for-vsphere:v1.5.0 \
  --bucket velero-backups \
  --backup-location-config region=minio,s3ForcePathStyle=true,s3Url=http://minio.minio-namespace.svc:9000 \
  --use-node-agent \
  --default-volumes-to-fs-backup \
  --secret-file ./credentials-velero \
  --namespace velero
```

### Configure vSphere Snapshot Location (Optional)

If using vSphere native snapshots:

```yaml
# vsphere-volumesnapshotlocation.yaml
apiVersion: velero.io/v1
kind: VolumeSnapshotLocation
metadata:
  name: vsphere-snapshots
  namespace: velero
spec:
  provider: velero.io/vsphere
  config:
    # Optional parameters
    # VirtualCenterListBase64: base64-encoded-vc-list
```

Apply the configuration:

```bash
kubectl apply -f vsphere-volumesnapshotlocation.yaml
```

## Testing Backup and Restore

### 1. Create Test Application with PVC

```bash
# Create test namespace
kubectl create namespace test-app

# Deploy test application with PVC
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Namespace
metadata:
  name: test-app
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-data
  namespace: test-app
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 2Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-deployment
  namespace: test-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: test-app
  template:
    metadata:
      labels:
        app: test-app
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
        volumeMounts:
        - name: data
          mountPath: /usr/share/nginx/html
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: test-data
---
apiVersion: v1
kind: Service
metadata:
  name: test-service
  namespace: test-app
spec:
  selector:
    app: test-app
  ports:
    - port: 80
      targetPort: 80
EOF
```

### 2. Add Test Data

```bash
# Wait for pod to be ready
kubectl wait --for=condition=ready pod -l app=test-app -n test-app --timeout=60s

# Write test data to PVC
kubectl exec -n test-app deployment/test-deployment -- \
  sh -c "echo '<h1>Test Data: $(date)</h1>' > /usr/share/nginx/html/index.html"

# Verify data
kubectl exec -n test-app deployment/test-deployment -- cat /usr/share/nginx/html/index.html
```

### 3. Create Backup

```bash
# Create backup of test-app namespace
velero backup create test-backup \
  --include-namespaces test-app \
  --wait

# Check backup status
velero backup describe test-backup --details

# Verify PodVolumeBackup was created
kubectl get podvolumebackups -n velero | grep test-backup
```

### 4. Simulate Disaster Recovery

```bash
# Delete the entire namespace
kubectl delete namespace test-app

# Verify deletion
kubectl get namespace test-app
```

### 5. Restore to Original Namespace

```bash
# Restore the backup
velero restore create test-restore \
  --from-backup test-backup \
  --wait

# Check restore status
velero restore describe test-restore --details

# Verify namespace and resources
kubectl get all -n test-app
kubectl get pvc -n test-app

# Verify data was restored
kubectl exec -n test-app deployment/test-deployment -- cat /usr/share/nginx/html/index.html
```

## Advanced Restore Scenarios

### Restore to Different Namespace

```bash
# Restore to a new namespace
velero restore create restore-to-new-ns \
  --from-backup test-backup \
  --namespace-mappings test-app:test-app-restored \
  --wait

# Verify resources in new namespace
kubectl get all -n test-app-restored
kubectl get pvc -n test-app-restored

# Check restored data
kubectl exec -n test-app-restored deployment/test-deployment -- \
  cat /usr/share/nginx/html/index.html
```

### Selective Restore

```bash
# Restore only specific resources
velero restore create selective-restore \
  --from-backup test-backup \
  --include-resources deployment,service \
  --wait

# Restore with label selector
velero restore create label-restore \
  --from-backup test-backup \
  --selector app=test-app \
  --wait
```

### Schedule Automated Backups

```bash
# Create daily backup schedule
velero schedule create daily-backup \
  --schedule="0 2 * * *" \
  --include-namespaces test-app \
  --ttl 720h

# Create weekly backup of all namespaces
velero schedule create weekly-full \
  --schedule="0 3 * * 0" \
  --ttl 2160h

# List schedules
velero schedule get
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Check Velero Pod Logs

```bash
# Velero server logs
kubectl logs deployment/velero -n velero

# Node-agent logs
kubectl logs -n velero -l name=node-agent
```

#### 2. PVC Not Being Backed Up

```bash
# Check if node-agent is running on all nodes
kubectl get pods -n velero -o wide

# Verify default-volumes-to-fs-backup is enabled
kubectl get deployment velero -n velero -o yaml | grep default-volumes-to-fs-backup

# Manually annotate pod for backup (if needed)
kubectl annotate pod -n test-app -l app=test-app \
  backup.velero.io/backup-volumes=data
```

#### 3. MinIO Connection Issues

```bash
# Test MinIO connectivity from inside cluster
kubectl run minio-test --image=minio/mc --rm -it --restart=Never -- \
  /bin/sh -c "mc alias set minio http://minio:9000 ACCESS_KEY SECRET_KEY && mc ls minio/"

# Check backup location status
velero backup-location get
```

#### 4. Restore Failing

```bash
# Check restore logs
velero restore logs restore-name

# Verify backup has expected resources
velero backup describe backup-name --details

# Check for PodVolumeRestores
kubectl get podvolumerestores -n velero
```

### Cleanup Test Resources

```bash
# Delete test namespaces
kubectl delete namespace test-app test-app-restored

# Delete test backups and restores
velero backup delete test-backup --confirm
velero restore delete test-restore --confirm

# Delete schedules
velero schedule delete daily-backup --confirm
```

## Best Practices

1. **Regular Testing**: Periodically test restore procedures
2. **Backup Retention**: Set appropriate TTL for backups
3. **Monitoring**: Set up alerts for backup failures
4. **Documentation**: Document what namespaces/resources are being backed up
5. **Security**: Use encrypted S3 buckets and secure credentials
6. **Resource Filtering**: Exclude unnecessary resources to reduce backup size

## Additional Resources

- [Velero Documentation](https://velero.io/docs/)
- [Velero GitHub Repository](https://github.com/vmware-tanzu/velero)
- [vSphere Plugin Documentation](https://github.com/vmware-tanzu/velero-plugin-for-vsphere)
- [Troubleshooting Guide](https://velero.io/docs/main/troubleshooting/)
