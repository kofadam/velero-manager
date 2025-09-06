# Velero Multi-Cluster Backup Management Solution

## Architecture Overview

This solution provides centralized backup orchestration and monitoring for multiple Kubernetes clusters using Velero, with backups stored in NetApp StorageGRID and metrics monitoring through Grafana.

### Components

- **Management Cluster**: Orchestrates backups across all guest clusters, provides unified monitoring
- **Guest Clusters**: Execute backup operations when triggered by management cluster
- **StorageGRID**: Object storage for backup data, organized by department buckets
- **Monitoring Stack**: Prometheus, Grafana for backup health monitoring

### Data Flow

1. Management cluster CronJobs trigger backup creation on guest clusters
2. Guest clusters execute backups locally and upload directly to StorageGRID
3. Management cluster monitors backup status through its own Velero metrics
4. All backup metadata centralized on management cluster for monitoring

## Prerequisites

- Air-gapped Kubernetes environment with Harbor container registry
- NetApp StorageGRID with tenant access
- Cert-manager for TLS certificates
- Prometheus Operator for monitoring

## Management Cluster Setup

### 1. Deploy Core Infrastructure

```bash
# Create namespace with required pod security labels
kubectl create namespace velero
kubectl label namespace velero \
  pod-security.kubernetes.io/enforce=privileged \
  pod-security.kubernetes.io/enforce-version=latest \
  pod-security.kubernetes.io/audit=privileged \
  pod-security.kubernetes.io/audit-version=latest \
  pod-security.kubernetes.io/warn=privileged \
  pod-security.kubernetes.io/warn-version=latest

# Deploy Velero via Helm
helm upgrade --install velero oci://harbor.mydomain.local/tanzu/charts/velero \
  --namespace velero \
  -f management-cluster-values.yaml \
  --set-file "credentials.secretContents.cloud"="/tmp/storagegrid-credentials"
```

### 2. Configure Department Storage Locations

```bash
# Create BackupStorageLocation for each department
kubectl apply -f - <<EOF
apiVersion: velero.io/v1
kind: BackupStorageLocation
metadata:
  name: dept1-storage
  namespace: velero
spec:
  provider: aws
  config:
    region: "us-east-1"
    s3ForcePathStyle: "true"
    s3Url: "https://object-gw.mydomain.local:10443"
  credential:
    name: cloud-credentials
    key: cloud
  objectStorage:
    bucket: dept1-backups
    caCert: "BASE64_ENCODED_CA_CERT"
EOF
```

## Adding Guest Clusters

### For Existing Clusters with Velero

1. **Create Management Access on Guest Cluster**:

```bash
# On guest cluster
kubectl create serviceaccount velero-mgmt -n velero
kubectl create clusterrolebinding velero-mgmt-admin \
  --clusterrole=cluster-admin \
  --serviceaccount=velero:velero-mgmt

# Create token secret
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: velero-mgmt-token
  namespace: velero
  annotations:
    kubernetes.io/service-account.name: velero-mgmt
type: kubernetes.io/service-account-token
EOF

# Extract credentials
GUEST_CLUSTER_NAME="guest-cluster-1"  #Set new guest cluster name
EXTRACTED_TOKEN=$(kubectl get secret velero-mgmt-token -n velero -o jsonpath='{.data.token}' | base64 -d)
EXTRACTED_CA_CERT=$(kubectl get secret velero-mgmt-token -n velero -o jsonpath='{.data.ca\.crt}')
EXTRACTED_CLUSTER_IP=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
echo "New guest cluster: " $GUEST_CLUSTER_NAME
echo "EXTRACTED_TOKEN: " $EXTRACTED_TOKEN
echo "EXTRACTED_CA_CERT: " $EXTRACTED_CA_CERT
echo "EXTRACTED_CLUSTER_IP: " $EXTRACTED_CLUSTER_IP
```

2. **Configure Management Cluster Access**:

```bash
# On management cluster
kubectl create secret generic $GUEST_CLUSTER_NAME-sa-token \
  --from-literal=token=$EXTRACTED_TOKEN \
  --from-literal=ca.crt=$EXTRACTED_CA_CERT \
  --from-literal=server=$EXTRACTED_CLUSTER_IP \
  -n velero
```

### For New Clusters

Deploy Velero with department-specific storage:

```bash
helm upgrade --install velero oci://harbor.mydomain.local/tanzu/charts/velero \
  --namespace velero \
  --create-namespace \
  --set-file "credentials.secretContents.cloud"="/tmp/storagegrid-credentials" \
  -f - <<EOF
namespace:
  labels:
    pod-security.kubernetes.io/enforce: privileged

configuration:
  backupStorageLocation:
  - name: default
    provider: aws
    bucket: dept1-backups
    caCert: "BASE64_ENCODED_CA_CERT"
    config:
      region: "us-east-1"
      s3ForcePathStyle: "true"
      s3Url: "https://object-gw.mydomain.local:10443"

  defaultSnapshotMoveData: true
  features: EnableCSI

deployNodeAgent: true
metrics:
  enabled: false
  serviceMonitor:
    enabled: false
EOF
```

## Backup Orchestration

### CronJob Template

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-cluster-name-daily
  namespace: velero
spec:
  schedule: '0 4 * * *' # Stagger times per cluster
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: backup-trigger
              image: harbor.mydomain.local/tanzu/velero/velero:v1.15.2_vmware.1
              command:
                - /bin/sh
                - -c
                - |
                  TOKEN=$(cat /secrets/token)
                  CA_CERT=$(cat /secrets/ca.crt)
                  SERVER=$(cat /secrets/server)

                  echo "$CA_CERT" | base64 -d > /tmp/ca.crt

                  cat > /tmp/kubeconfig <<KUBECONFIG_EOF
                  apiVersion: v1
                  kind: Config
                  clusters:
                  - cluster:
                      certificate-authority: /tmp/ca.crt
                      server: $SERVER
                    name: cluster-name
                  contexts:
                  - context:
                      cluster: cluster-name
                      user: cluster-sa
                    name: cluster-name
                  current-context: cluster-name
                  users:
                  - name: cluster-sa
                    user:
                      token: $TOKEN
                  KUBECONFIG_EOF

                  export KUBECONFIG=/tmp/kubeconfig

                  /velero backup create cluster-name-centralized-$(date +%Y%m%d-%H%M%S) \
                    --storage-location dept1-storage \
                    --include-namespaces "*" \
                    --include-cluster-resources \
                    --snapshot-volumes \
                    --ttl 720h \
                    --wait
              volumeMounts:
                - name: cluster-secrets
                  mountPath: /secrets
          volumes:
            - name: cluster-secrets
              secret:
                secretName: guest-cluster-sa-token
```

## Monitoring Setup

### Grafana Dashboard

Import the provided Velero dashboard that monitors:

- Backup success/failure rates
- Hours since last backup per cluster
- Backup duration and size trends
- Storage location health

### Key Metrics

- `velero_backup_last_successful_timestamp`: Backup freshness
- `velero_backup_deletion_success_total`: Cleanup operations
- `velero_backup_failure_total`: Failed backup count

## Operational Procedures

### Adding New Department

1. Create StorageGRID bucket: `dept-name-backups`
2. Add BackupStorageLocation to management cluster
3. Update CronJobs to use new storage location

### Adding New Cluster

1. Deploy Velero on guest cluster with department bucket
2. Create management service account on guest cluster
3. Store access credentials on management cluster
4. Deploy CronJob for scheduled backups

### Backup Monitoring

```bash
# Check backup status across all clusters
velero backup get

# Detailed backup information
velero backup describe backup-name

# Monitor via Grafana dashboard for trends and alerts
```

### Troubleshooting

**Common Issues:**

1. **Pod Security Errors**: Ensure namespace has `pod-security.kubernetes.io/enforce=privileged` label
2. **Storage Access**: Verify StorageGRID credentials and bucket permissions
3. **Cross-cluster Access**: Check service account tokens and cluster connectivity
4. **Resource Exclusions**: Use labels to exclude problematic resources like SMB PVCs

**ZSH Shell Considerations:**

When testing Prometheus queries, use proper URL encoding:

```bash
curl 'http://localhost:9090/api/v1/query?query=velero_backup_success_total{cluster="core-cl1"}'
```

## Security Considerations

- Service account tokens stored as Kubernetes secrets
- StorageGRID access limited to backup operations
- Cross-cluster access restricted to backup management
- Air-gapped environment with internal Harbor registry

## Backup Retention

- Default TTL: 720 hours (30 days)
- Configurable per backup via CronJob parameters
- StorageGRID lifecycle policies for long-term retention

## Recovery Procedures

Restores can be performed from management cluster to any target cluster using the centralized backup catalog and cross-cluster access credentials.
