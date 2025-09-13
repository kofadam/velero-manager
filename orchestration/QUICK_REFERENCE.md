# Velero Multi-Cluster Backup - Quick Reference

## 🚀 Quick Commands

### Adding a New Cluster - Fast Track

```bash
# 1. ON GUEST CLUSTER: Install Velero
velero install --provider aws --plugins velero/velero-plugin-for-aws:v1.9.0 \
  --bucket my-backups --secret-file ./creds \
  --backup-location-config region=minio,s3ForcePathStyle="true",s3Url=http://minio:9000

# 2. ON GUEST: Apply minimal permissions
kubectl apply -f https://raw.githubusercontent.com/kofadam/velero-manager/master/orchestration/security/rbac/minimal-rbac.yaml

# 3. ON GUEST: Extract credentials
TOKEN=$(kubectl get secret velero-remote-trigger-token -n velero -o jsonpath='{.data.token}' | base64 -d)
CA_CERT=$(kubectl get secret velero-remote-trigger-token -n velero -o jsonpath='{.data.ca\.crt}')
SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')

# 4. ON MANAGEMENT: Store credentials
kubectl create secret generic "mycluster-sa-token" \
  --from-literal=token="$TOKEN" \
  --from-literal=ca.crt="$CA_CERT" \
  --from-literal=server="$SERVER" \
  --from-literal=cluster-name="mycluster" \
  -n velero
```

### Daily Operations

```bash
# Check all backup schedules
kubectl get cronjobs -n velero

# Run backup now (don't wait for schedule)
kubectl create job --from=cronjob/backup-production-daily backup-now -n velero

# Watch backup progress
kubectl logs -n velero job/backup-now -f

# List all backups (on guest cluster)
velero backup get

# Describe specific backup
velero backup describe production-20250913-020000

# Create on-demand backup
velero backup create manual-backup --include-namespaces production

# Restore from backup
velero restore create --from-backup production-20250913-020000
```

### Troubleshooting

```bash
# Check Velero status (on guest)
kubectl logs deployment/velero -n velero --tail=50

# Test cluster connection
kubectl create job test-connection --from=cronjob/backup-production-daily -n velero
kubectl logs job/test-connection -n velero

# List all cluster credentials
kubectl get secrets -n velero -l type=cluster-token

# Check RBAC permissions (on guest)
kubectl auth can-i --list --as=system:serviceaccount:velero:velero-remote-trigger

# Debug backup failure
velero backup logs <backup-name>
velero backup describe <backup-name> --details
```

## 📋 Backup Schedule Template

```yaml
# Save as: backup-CLUSTERNAME.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-CLUSTERNAME-daily
  namespace: velero
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: trigger
            image: bitnami/kubectl:latest
            command: ["/bin/bash", "-c"]
            args:
            - |
              TOKEN=$(cat /secrets/token)
              SERVER=$(cat /secrets/server)
              # ... (full script in VELERO_DEPLOYMENT_GUIDE.md)
            volumeMounts:
            - name: cluster-secrets
              mountPath: /secrets
          volumes:
          - name: cluster-secrets
            secret:
              secretName: CLUSTERNAME-sa-token
          restartPolicy: OnFailure
```

## 🔍 Health Checks

| Component | Check Command | Expected Result |
|-----------|--------------|-----------------|
| Management Velero | `kubectl get pods -n velero` | All pods Running |
| Guest Velero | `kubectl logs deployment/velero -n velero` | No errors |
| Storage Access | `velero backup-location get` | Phase: Available |
| CronJobs | `kubectl get cronjobs -n velero` | ACTIVE: 1 or 0 |
| Recent Backups | `velero backup get` | Status: Completed |
| ArgoCD | `argocd app list --grpc-web` | Status: Healthy |

## 🚨 Common Fixes

| Problem | Solution |
|---------|----------|
| "Unauthorized" error | Recreate token secret on guest cluster |
| "Connection refused" | Check SERVER address, verify port (usually 6443) |
| Backup stuck "InProgress" | Check Velero logs on guest cluster |
| "Forbidden" error | Reapply minimal-rbac.yaml on guest |
| No backups created | Check CronJob logs on management cluster |
| Storage errors | Verify credentials and bucket exists |

## 📦 Storage Credentials Format

```bash
# MinIO / S3-compatible
cat > credentials-velero <<EOF
[default]
aws_access_key_id = YOUR_ACCESS_KEY
aws_secret_access_key = YOUR_SECRET_KEY
EOF

# AWS S3
cat > credentials-velero <<EOF
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
EOF
```

## 🔐 Security Checklist

- [ ] Using minimal RBAC (not cluster-admin)
- [ ] Token rotation CronJob deployed
- [ ] Audit logging enabled
- [ ] Network policies configured
- [ ] Secrets not in Git
- [ ] Backup retention configured
- [ ] Restore tested recently

## 📞 Getting Help

1. **Check logs first**: `kubectl logs -n velero`
2. **Velero CLI help**: `velero --help`
3. **Documentation**: https://velero.io/docs/
4. **This repo**: https://github.com/kofadam/velero-manager

---
*Keep this card handy for daily operations*