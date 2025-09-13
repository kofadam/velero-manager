# Multi-Cluster Velero Setup Guide

## Prerequisites

- Management cluster with Velero Manager
- Guest clusters with Kubernetes 1.24+
- MinIO or S3-compatible storage
- Network connectivity between clusters

## Step-by-Step Setup

### 1. Prepare Management Cluster (microk8s)

```bash
# Install Velero Manager
kubectl apply -f deployments/

# Setup ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### 2. Prepare Guest Cluster (minikube)

```bash
# Install Velero
velero install --provider aws --bucket velero-backups \
  --secret-file ./credentials-velero \
  --backup-location-config region=minio,s3ForcePathStyle="true",s3Url=http://minio:9000

# Apply minimal RBAC
kubectl apply -f orchestration/security/rbac/minimal-rbac.yaml
```

### 3. Connect Clusters

```bash
# Extract guest cluster credentials
./orchestration/scripts/connect-clusters.sh

# Create CronJob on management cluster
kubectl apply -f orchestration/examples/test-backup-cronjob.yaml
```

### 4. Verify Setup

```bash
# Trigger test backup
kubectl create job --from=cronjob/backup-minikube-test test-now -n velero

# Check backup status
velero backup get
```

## Troubleshooting

### Network Connectivity

```bash
# Test from guest cluster
kubectl run test --image=busybox --rm -it --restart=Never -- wget -O- http://minio:9000
```

### Token Issues

```bash
# Manually rotate token
kubectl delete secret velero-remote-trigger-token -n velero
kubectl apply -f orchestration/security/rbac/minimal-rbac.yaml
```
