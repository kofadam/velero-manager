# Security Enhancements for Velero Manager

## Overview

These configurations replace the default cluster-admin service account approach with minimal RBAC and automated token rotation.

## Components

### 1. Minimal RBAC (`rbac/`)

- `minimal-rbac.yaml` - Least-privilege ClusterRole for backup operations
- `token-rotation-cronjob.yaml` - Automated weekly token rotation
- `deploy-minimal-rbac.sh` - Deployment script

### 2. Audit Logging (`audit/`)

- `backup-audit-system.yaml` - Fluent Bit sidecar for audit trails

### 3. Monitoring (`monitoring/`)

- `backup-monitoring-alerts.yaml` - Prometheus rules and alerts

## Deployment

```bash
# Deploy minimal RBAC on guest cluster
./rbac/deploy-minimal-rbac.sh guest-cluster-name guest-context

# Enable token rotation
kubectl apply -f rbac/token-rotation-cronjob.yaml

# Setup audit logging
kubectl apply -f audit/backup-audit-system.yaml

# Configure monitoring
kubectl apply -f monitoring/backup-monitoring-alerts.yaml
```

## Security Improvements

| Risk                 | Before         | After            |
| -------------------- | -------------- | ---------------- |
| Privilege Escalation | cluster-admin  | Minimal RBAC     |
| Static Credentials   | Forever tokens | Weekly rotation  |
| Audit Trail          | None           | Full logging     |
| Unauthorized Access  | No monitoring  | Real-time alerts |
