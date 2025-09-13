# Velero Multi-Cluster Backup Management - Cluster Operations Guide

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Adding a New Cluster](#adding-a-new-cluster)
- [Fixing an Existing Cluster](#fixing-an-existing-cluster)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## Overview

This guide explains how to add clusters to the centralized Velero backup management system, which uses:

- **Management Cluster**: Orchestrates backups via CronJobs (microk8s in our setup)
- **Guest Clusters**: Execute backups when triggered (minikube, and others)
- **MinIO/S3**: Centralized backup storage
- **ArgoCD**: GitOps management for backup schedules
- **Minimal RBAC**: Least-privilege access (NOT cluster-admin)

## Prerequisites

### Management Cluster Requirements

- Velero Manager deployed
- ArgoCD installed and configured
- Access to MinIO/S3 storage
- `orchestration/` directory from this repository deployed

### Guest Cluster Requirements

- Kubernetes 1.24+
- Velero v1.13+ installed
- Network connectivity to MinIO/S3 storage
- Network connectivity from management cluster

### Tools Required

- `kubectl` with access to both clusters
- `velero` CLI (optional but recommended)
- `argocd` CLI (optional)

## Adding a New Cluster

### Step 1: Install Velero on the Guest Cluster

```bash
# Switch to the guest cluster context
kubectl config use-context <guest-cluster-context>

# Create namespace
kubectl create namespace velero

# Install Velero (adjust for your storage)
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.9.0 \
  --bucket <department-bucket> \
  --secret-file ./credentials-velero \
  --use-node-agent \
  --backup-location-config region=minio,s3ForcePathStyle="true",s3Url=http://<minio-endpoint>:9000
```

### Step 2: Deploy Minimal RBAC on Guest Cluster

```bash
# Apply the minimal RBAC configuration
kubectl apply -f orchestration/security/rbac/minimal-rbac.yaml

# Create token secret
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

# Wait for token generation
sleep 5
```

### Step 3: Extract Credentials

```bash
# Extract the credentials
TOKEN=$(kubectl get secret velero-remote-trigger-token -n velero -o jsonpath='{.data.token}' | base64 -d)
CA_CERT=$(kubectl get secret velero-remote-trigger-token -n velero -o jsonpath='{.data.ca\.crt}')
SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
CLUSTER_NAME="<your-cluster-name>"

echo "Credentials extracted for cluster: $CLUSTER_NAME"
```

### Step 4: Store Credentials on Management Cluster

```bash
# Switch to management cluster
kubectl config use-context <management-cluster-context>

# Create secret with guest cluster credentials
kubectl create secret generic "${CLUSTER_NAME}-sa-token" \
  --from-literal=token="$TOKEN" \
  --from-literal=ca.crt="$CA_CERT" \
  --from-literal=server="$SERVER" \
  --from-literal=cluster-name="$CLUSTER_NAME" \
  -n velero \
  --dry-run=client -o yaml | kubectl apply -f -

# Label the secret for token rotation
kubectl label secret "${CLUSTER_NAME}-sa-token" type=cluster-token -n velero
```

### Step 5: Create Backup Schedule via GitOps

Create a new CronJob in `orchestration/schedules/<cluster-name>-backup.yaml`:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-<cluster-name>-daily
  namespace: velero
  labels:
    cluster: <cluster-name>
    schedule: daily
spec:
  schedule: '0 3 * * *' # Adjust time to avoid conflicts
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup-trigger
              image: bitnami/kubectl:latest
              command: ['/bin/bash', '-c']
              args:
                - |
                  # Script content from test-backup-cronjob.yaml
                  # ... (backup logic here)
              volumeMounts:
                - name: cluster-secrets
                  mountPath: /secrets
          volumes:
            - name: cluster-secrets
              secret:
                secretName: <cluster-name>-sa-token
          restartPolicy: OnFailure
```

Commit and push to trigger ArgoCD sync:

```bash
git add orchestration/schedules/<cluster-name>-backup.yaml
git commit -m "feat: Add backup schedule for <cluster-name>"
git push origin master
```

## Fixing an Existing Cluster

If a cluster was previously added with cluster-admin or without GitOps, follow these steps:

### Step 1: Identify Current Configuration

```bash
# Check existing service accounts
kubectl get sa -n velero

# Check existing RBAC
kubectl get clusterrolebinding | grep velero

# Check existing secrets on management cluster
kubectl config use-context <management-cluster-context>
kubectl get secrets -n velero | grep -- -sa-token
```

### Step 2: Remove Old Cluster-Admin Configuration

```bash
# Switch to guest cluster
kubectl config use-context <guest-cluster-context>

# Delete old cluster-admin binding (if exists)
kubectl delete clusterrolebinding velero-mgmt-admin --ignore-not-found

# Delete old service account (if using cluster-admin)
kubectl delete sa velero-mgmt -n velero --ignore-not-found

# Delete old token secrets
kubectl delete secret velero-mgmt-token -n velero --ignore-not-found
```

### Step 3: Apply Minimal RBAC

```bash
# Apply the correct minimal RBAC
kubectl apply -f orchestration/security/rbac/minimal-rbac.yaml

# Verify the new ClusterRole
kubectl describe clusterrole velero-remote-backup-operator
```

### Step 4: Update Management Cluster Secret

```bash
# Delete old secret on management cluster
kubectl config use-context <management-cluster-context>
kubectl delete secret <cluster-name>-sa-token -n velero --ignore-not-found

# Follow steps 3-4 from "Adding a New Cluster" to create new credentials
```

### Step 5: Migrate to GitOps

```bash
# Delete any manually created CronJobs
kubectl delete cronjob backup-<cluster-name> -n velero --ignore-not-found

# Create GitOps-managed schedule (see Step 5 of Adding a New Cluster)
```

### Step 6: Test the New Configuration

```bash
# Create a test job
kubectl create job --from=cronjob/backup-<cluster-name>-daily test-backup-now -n velero

# Check logs
kubectl logs job/test-backup-now -n velero

# Verify on guest cluster
kubectl config use-context <guest-cluster-context>
velero backup get
```

## Verification

### Check RBAC Permissions

```bash
# On guest cluster - verify minimal permissions
kubectl auth can-i --list --as=system:serviceaccount:velero:velero-remote-trigger | grep velero

# Should show:
# - velero.io/backups [create get list watch]
# - velero.io/schedules [create get list watch]
# - velero.io/backupstoragelocations [create get list watch]
# But NOT:
# - * [*] (which would indicate cluster-admin)
```

### Verify Backup Execution

```bash
# On management cluster
kubectl logs -n velero job/<backup-job-name>

# On guest cluster
velero backup describe <backup-name>
```

### Check GitOps Sync

```bash
# Using ArgoCD CLI
argocd app get velero-schedules --grpc-web

# Or check in ArgoCD UI
# https://argocd.homelab.local
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Authentication Failures

```bash
# Error: "unauthorized" or "forbidden"
# Solution: Verify token is valid
kubectl config use-context <guest-cluster>
kubectl get secret velero-remote-trigger-token -n velero -o yaml
# Recreate if needed
```

#### 2. Network Connectivity

```bash
# Test from management cluster pod
kubectl run test --rm -it --image=busybox --restart=Never -- wget -O- http://<guest-cluster-ip>:6443
```

#### 3. RBAC Insufficient Permissions

```bash
# Check what permissions the SA has
kubectl auth can-i --list --as=system:serviceaccount:velero:velero-remote-trigger
```

#### 4. Backup Failures

```bash
# Check Velero logs on guest cluster
kubectl logs deployment/velero -n velero

# Check backup status
velero backup describe <backup-name> --details
```

### Debug Commands

```bash
# List all cluster connections
kubectl get secrets -n velero -l type=cluster-token

# Test a specific cluster connection
kubectl create job test-<cluster> --from=cronjob/backup-<cluster>-daily -n velero
kubectl logs job/test-<cluster> -n velero

# Check ArgoCD sync status
argocd app get velero-schedules --refresh --grpc-web
```

## Security Considerations

### What We're Protecting Against

1. **Privilege Escalation**: No cluster-admin access
2. **Credential Compromise**: Token rotation mechanism available
3. **Audit Trail**: All backup operations logged
4. **Blast Radius**: Limited permissions per cluster

### Security Best Practices

1. **Regular Token Rotation**

   - Enable the token-rotation CronJob
   - Rotates tokens weekly by default

2. **Network Policies**

   - Restrict management cluster access to guest clusters
   - Use private endpoints where possible

3. **Monitoring**

   - Enable Prometheus alerts for backup failures
   - Monitor token age and rotation status

4. **Secret Management**
   - Consider using Sealed Secrets or external secret operators
   - Never commit credentials to Git

### Compliance Checklist

- [ ] No cluster-admin permissions used
- [ ] Token rotation enabled
- [ ] Audit logging configured
- [ ] Network policies in place
- [ ] Backup retention policies defined
- [ ] Disaster recovery plan tested

## Next Steps

After adding or fixing clusters:

1. **Enable Monitoring**

   ```bash
   kubectl apply -f orchestration/security/monitoring/
   ```

2. **Configure Alerts**

   - Set up Slack/email notifications for backup failures
   - Configure PagerDuty for critical issues

3. **Test Disaster Recovery**

   ```bash
   # Create test backup
   velero backup create test-dr --include-namespaces=<test-namespace>

   # Delete namespace
   kubectl delete namespace <test-namespace>

   # Restore
   velero restore create --from-backup test-dr
   ```

4. **Document Department-Specific Procedures**
   - Backup schedules
   - Retention policies
   - Restore procedures
   - Contact information

## Support

For issues or questions:

- Check logs: `kubectl logs -n velero`
- ArgoCD UI: https://argocd.homelab.local
- Velero Manager UI: http://velero.homelab.local

---

_Last Updated: September 2025_
_Version: 1.0_
