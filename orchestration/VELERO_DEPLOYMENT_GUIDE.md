# Velero Multi-Cluster Backup Solution - Complete Deployment Guide

## What is This Solution?

This guide helps you deploy an enterprise-grade Kubernetes backup system that:
- **Automatically backs up multiple Kubernetes clusters** from a central location
- **Uses minimal permissions** (not cluster-admin) for security
- **Stores backups in S3-compatible storage** (MinIO, AWS S3, etc.)
- **Manages everything through GitOps** for version control and automation

### How It Works

```
┌─────────────────────┐
│  Management Cluster │ (Runs scheduled jobs)
│    - Velero Manager │
│    - ArgoCD         │
│    - CronJobs       │
└──────────┬──────────┘
           │ Triggers backups
           ▼
┌─────────────────────┐
│   Guest Clusters    │ (Your workload clusters)
│    - Velero         │
│    - Your apps      │
└──────────┬──────────┘
           │ Stores backups
           ▼
┌─────────────────────┐
│   Object Storage    │
│    - MinIO/S3       │
│    - Backup data    │
└─────────────────────┘
```

## Table of Contents

1. [Before You Start](#before-you-start)
2. [Phase 1: Setup Management Cluster](#phase-1-setup-management-cluster)
3. [Phase 2: Prepare Your First Guest Cluster](#phase-2-prepare-your-first-guest-cluster)
4. [Phase 3: Connect the Clusters](#phase-3-connect-the-clusters)
5. [Phase 4: Create Backup Schedules](#phase-4-create-backup-schedules)
6. [Phase 5: Verify Everything Works](#phase-5-verify-everything-works)
7. [Adding More Clusters](#adding-more-clusters)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## Before You Start

### What You Need

#### Required Infrastructure
- **1 Management Cluster**: Where the orchestration runs (e.g., microk8s, regular k8s)
- **1+ Guest Clusters**: Your workload clusters to backup (e.g., production, staging)
- **Object Storage**: MinIO, AWS S3, or compatible storage with:
  - Endpoint URL
  - Access credentials
  - Bucket(s) created

#### Required Tools on Your Workstation
```bash
# Check if you have these installed
kubectl version --client  # Kubernetes CLI
helm version              # Helm package manager (v3+)
git --version            # Git for version control

# Optional but helpful
velero version --client   # Velero CLI
argocd version --client   # ArgoCD CLI
```

#### Network Requirements
- Management cluster can reach guest clusters' Kubernetes API (port 6443/8443)
- All clusters can reach your object storage
- Your workstation can reach all clusters

---

## Phase 1: Setup Management Cluster

This is your control center for all backups.

### Step 1.1: Prepare the Management Cluster

```bash
# Set your context to the management cluster
kubectl config use-context <your-management-cluster>

# Create necessary namespaces
kubectl create namespace velero
kubectl create namespace velero-manager
kubectl create namespace argocd

# Label the namespace for pod security
kubectl label namespace velero \
  pod-security.kubernetes.io/enforce=privileged \
  pod-security.kubernetes.io/audit=privileged \
  pod-security.kubernetes.io/warn=privileged
```

### Step 1.2: Install Velero on Management Cluster

First, create your storage credentials file:

```bash
# Create a file called 'credentials-velero' with your storage credentials
cat > credentials-velero <<EOF
[default]
aws_access_key_id = <your-access-key>
aws_secret_access_key = <your-secret-key>
EOF
```

Install Velero:

```bash
# For MinIO
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.9.0 \
  --bucket management-backups \
  --secret-file ./credentials-velero \
  --use-node-agent \
  --backup-location-config region=minio,s3ForcePathStyle="true",s3Url=http://<minio-ip>:9000

# For AWS S3
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.9.0 \
  --bucket management-backups \
  --secret-file ./credentials-velero \
  --use-node-agent \
  --backup-location-config region=us-east-1
```

### Step 1.3: Deploy Velero Manager (Optional Web UI)

```bash
# Clone the repository
git clone https://github.com/kofadam/velero-manager.git
cd velero-manager

# Deploy Velero Manager
kubectl apply -f deployments/

# Check it's running
kubectl get pods -n velero-manager
```

### Step 1.4: Install ArgoCD for GitOps

```bash
# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for it to be ready
kubectl wait --for=condition=ready pod --all -n argocd --timeout=300s

# Get the admin password
echo "ArgoCD admin password:"
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo
```

### Step 1.5: Access ArgoCD (Optional)

```bash
# Option A: Port forward
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Access at: https://localhost:8080
# Username: admin
# Password: (from previous step)

# Option B: Create ingress (if you have ingress controller)
# See the ingress example in orchestration/gitops/argocd/
```

---

## Phase 2: Prepare Your First Guest Cluster

This is a cluster you want to backup.

### Step 2.1: Install Velero on Guest Cluster

```bash
# Switch to guest cluster
kubectl config use-context <your-guest-cluster>

# Create namespace
kubectl create namespace velero

# Install Velero with same storage backend
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.9.0 \
  --bucket <department-backups> \
  --secret-file ./credentials-velero \
  --use-node-agent \
  --backup-location-config region=minio,s3ForcePathStyle="true",s3Url=http://<minio-ip>:9000
```

### Step 2.2: Apply Security Configuration (IMPORTANT!)

Instead of giving the management cluster full admin access, we use minimal permissions:

```bash
# Save this as minimal-rbac.yaml
cat > minimal-rbac.yaml <<'EOF'
apiVersion: v1
kind: ServiceAccount
metadata:
  name: velero-remote-trigger
  namespace: velero
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: velero-remote-backup-operator
rules:
# Only what's needed for backups
- apiGroups: ["velero.io"]
  resources: ["backups", "schedules", "backupstoragelocations"]
  verbs: ["create", "get", "list", "watch"]
- apiGroups: ["velero.io"]
  resources: ["backups/status", "backups/logs"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: velero-remote-backup-operator
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: velero-remote-backup-operator
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

# Apply it
kubectl apply -f minimal-rbac.yaml

# Wait for token to be generated
sleep 5
```

---

## Phase 3: Connect the Clusters

Now we give the management cluster access to trigger backups on the guest cluster.

### Step 3.1: Extract Guest Cluster Credentials

```bash
# On the guest cluster
kubectl config use-context <your-guest-cluster>

# Extract the connection details
TOKEN=$(kubectl get secret velero-remote-trigger-token -n velero -o jsonpath='{.data.token}' | base64 -d)
CA_CERT=$(kubectl get secret velero-remote-trigger-token -n velero -o jsonpath='{.data.ca\.crt}')
SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')

# Choose a name for this cluster
CLUSTER_NAME="production"  # or staging, dev, etc.

echo "Cluster: $CLUSTER_NAME"
echo "Server: $SERVER"
echo "Token extracted successfully"
```

### Step 3.2: Store Credentials on Management Cluster

```bash
# Switch to management cluster
kubectl config use-context <your-management-cluster>

# Create the secret
kubectl create secret generic "${CLUSTER_NAME}-sa-token" \
  --from-literal=token="$TOKEN" \
  --from-literal=ca.crt="$CA_CERT" \
  --from-literal=server="$SERVER" \
  --from-literal=cluster-name="$CLUSTER_NAME" \
  -n velero

# Label it for organization
kubectl label secret "${CLUSTER_NAME}-sa-token" type=cluster-token -n velero

echo "✓ Guest cluster credentials stored on management cluster"
```

---

## Phase 4: Create Backup Schedules

### Step 4.1: Create a Backup CronJob

Save this as `backup-production.yaml` (replace 'production' with your cluster name):

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-production-daily
  namespace: velero
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: velero-backup
            image: bitnami/kubectl:latest
            command: ["/bin/bash", "-c"]
            args:
            - |
              set -e
              echo "Starting backup for production cluster..."
              
              # Setup connection to guest cluster
              TOKEN=$(cat /secrets/token)
              SERVER=$(cat /secrets/server)
              CLUSTER_NAME=$(cat /secrets/cluster-name)
              
              # Create kubeconfig
              cat > /tmp/kubeconfig <<EOF
              apiVersion: v1
              kind: Config
              clusters:
              - cluster:
                  certificate-authority-data: $(cat /secrets/ca.crt)
                  server: $SERVER
                name: guest
              contexts:
              - context:
                  cluster: guest
                  user: velero
                name: guest
              current-context: guest
              users:
              - name: velero
                user:
                  token: $TOKEN
              EOF
              
              export KUBECONFIG=/tmp/kubeconfig
              
              # Create backup
              BACKUP_NAME="${CLUSTER_NAME}-$(date +%Y%m%d-%H%M%S)"
              
              cat <<BACKUP | kubectl apply -f -
              apiVersion: velero.io/v1
              kind: Backup
              metadata:
                name: $BACKUP_NAME
                namespace: velero
              spec:
                includedNamespaces:
                - default
                - production-apps  # Add your namespaces here
                excludedNamespaces:
                - kube-system
                - kube-public
                storageLocation: default
                ttl: 720h0m0s  # Keep for 30 days
              BACKUP
              
              echo "Backup $BACKUP_NAME created successfully"
            volumeMounts:
            - name: cluster-secrets
              mountPath: /secrets
          volumes:
          - name: cluster-secrets
            secret:
              secretName: production-sa-token  # Match your cluster name
          restartPolicy: OnFailure
```

### Step 4.2: Deploy the Schedule

```bash
# Apply the CronJob
kubectl apply -f backup-production.yaml

# Verify it was created
kubectl get cronjobs -n velero
```

### Step 4.3: Test the Backup Immediately

```bash
# Create a one-time job from the CronJob
kubectl create job --from=cronjob/backup-production-daily test-backup -n velero

# Watch the logs
kubectl logs -n velero job/test-backup -f

# Check if backup was created on guest cluster
kubectl config use-context <your-guest-cluster>
velero backup get
```

---

## Phase 5: Verify Everything Works

### Check Backup Status

```bash
# On guest cluster - see all backups
kubectl config use-context <your-guest-cluster>
velero backup get

# Get details of a specific backup
velero backup describe <backup-name>

# Check backup logs
velero backup logs <backup-name>
```

### Monitor CronJobs

```bash
# On management cluster
kubectl config use-context <your-management-cluster>

# See all scheduled backups
kubectl get cronjobs -n velero

# Check last execution
kubectl get jobs -n velero
```

### Test a Restore (Optional)

```bash
# On guest cluster
kubectl config use-context <your-guest-cluster>

# Create a test namespace with some data
kubectl create namespace test-restore
kubectl create deployment nginx --image=nginx -n test-restore

# Create backup
velero backup create test-backup --include-namespaces test-restore

# Delete the namespace
kubectl delete namespace test-restore

# Restore it
velero restore create --from-backup test-backup

# Verify
kubectl get all -n test-restore
```

---

## Adding More Clusters

For each additional cluster, repeat these steps:

1. **Install Velero** on the new guest cluster (Phase 2.1)
2. **Apply minimal RBAC** (Phase 2.2)
3. **Extract and store credentials** (Phase 3)
4. **Create a new CronJob** with a unique name and schedule (Phase 4)

Pro tip: Stagger the backup times to avoid overloading storage:
- Cluster 1: "0 2 * * *" (2 AM)
- Cluster 2: "0 3 * * *" (3 AM)
- Cluster 3: "0 4 * * *" (4 AM)

---

## Troubleshooting Guide

### Problem: Backup CronJob fails

```bash
# Check the job logs
kubectl logs -n velero job/<job-name>

# Common issues:
# - "connection refused" → Check SERVER address and network connectivity
# - "unauthorized" → Token might be expired, recreate the secret
# - "forbidden" → RBAC not applied correctly
```

### Problem: Can't connect to guest cluster

```bash
# Test connectivity from management cluster
kubectl run test --rm -it --image=busybox --restart=Never -- \
  wget --spider https://<guest-cluster-ip>:6443

# If this fails, check:
# - Firewall rules
# - Network policies
# - VPN connections
```

### Problem: Backups not appearing in storage

```bash
# Check Velero logs on guest cluster
kubectl logs deployment/velero -n velero

# Common issues:
# - Wrong storage credentials
# - Bucket doesn't exist
# - Network can't reach storage
```

### Problem: Restore fails

```bash
# Check restore status
velero restore describe <restore-name>

# Common issues:
# - Original namespace has conflicting resources
# - PV/PVC restoration needs CSI snapshots
# - Some resources are cluster-scoped
```

---

## Security Notes

This solution implements several security best practices:

1. **No Cluster-Admin**: Uses minimal RBAC instead of full admin access
2. **Token Rotation**: Supports automatic token rotation (see orchestration/security/rbac/token-rotation-cronjob.yaml)
3. **Audit Logging**: All backup operations are logged
4. **GitOps**: All configurations can be version controlled

---

## Next Steps

Once everything is working:

1. **Enable Monitoring**: Deploy Prometheus alerts (see orchestration/security/monitoring/)
2. **Setup Notifications**: Configure Slack/email alerts for backup failures
3. **Document Procedures**: Create restore runbooks for your team
4. **Test Regularly**: Schedule quarterly restore drills

---

## Support Resources

- **Velero Documentation**: https://velero.io/docs/
- **Kubernetes Backup Best Practices**: https://kubernetes.io/docs/concepts/cluster-administration/backing-up/
- **This Repository**: https://github.com/kofadam/velero-manager

For issues specific to this deployment:
- Check logs: `kubectl logs -n velero`
- Velero Manager UI: http://<your-velero-manager>/
- ArgoCD UI: https://<your-argocd>/

---

*This guide is part of the Velero Manager project - Enterprise-grade backup orchestration for Kubernetes*