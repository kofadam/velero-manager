# Velero Observability - Log Queries

Since Velero namespace contains the real operational data, here are the most important queries for monitoring your backup operations.

## 🔍 **Critical Velero Log Queries**

### Backup Operations

```logql
# All backup failures
{namespace="velero"} |= "backup" |~ "Failed|Error|error"

# Backup completion events
{namespace="velero"} |= "backup" |= "Completed" 

# Backup start/progress tracking
{namespace="velero"} |= "backup" |~ "Starting|InProgress"

# Backup validation errors
{namespace="velero"} |= "backup" |= "FailedValidation"

# Specific backup by name
{namespace="velero"} |= "backup=my-backup-name"

# Backups with warnings
{namespace="velero"} |= "backup" |~ "warning|Warning"
```

### Restore Operations

```logql
# All restore operations
{namespace="velero"} |= "restore"

# Failed restores
{namespace="velero"} |= "restore" |~ "Failed|Error"

# Successful restores  
{namespace="velero"} |= "restore" |= "Completed"

# Restore progress
{namespace="velero"} |= "restore" |~ "Starting|InProgress"

# Specific restore by name
{namespace="velero"} |= "restore=my-restore-name"
```

### Storage & Infrastructure

```logql
# Storage location issues
{namespace="velero"} |= "BackupStorageLocation" |~ "error|unavailable"

# S3/MinIO connection issues
{namespace="velero"} |~ "S3|minio|storage" |~ "error|failed|timeout"

# Plugin issues
{namespace="velero"} |= "plugin" |~ "error|failed"

# Volume snapshot issues
{namespace="velero"} |= "snapshot" |~ "error|failed"
```

### Performance & Timing

```logql
# Slow backups (looking for duration patterns)
{namespace="velero"} |= "backup" |= "duration"

# Large backup sizes
{namespace="velero"} |= "backup" |~ "size|bytes|MB|GB"

# Rate limiting or throttling
{namespace="velero"} |~ "rate|limit|throttl"
```

## 📊 **LogQL for Metrics Generation**

### Count backup outcomes over time

```logql
# Successful backups per hour
sum(count_over_time({namespace="velero"} |= "backup" |= "Completed" [1h]))

# Failed backups per hour
sum(count_over_time({namespace="velero"} |= "backup" |~ "Failed|PartiallyFailed" [1h]))

# Error rate percentage
(
  sum(count_over_time({namespace="velero"} |= "backup" |~ "Failed|Error" [1h])) /
  sum(count_over_time({namespace="velero"} |= "backup" [1h])) * 100
)
```

### Parse structured log data

```logql
# Extract backup duration from logs
{namespace="velero"} 
  | logfmt 
  | backup != "" 
  | duration != ""

# Extract backup size information
{namespace="velero"}
  | regex `backup=(?P<backup_name>\S+).*size=(?P<size>\d+)`
  | size > 1000000000  # Backups > 1GB
```

## 🚨 **Alerting Queries**

### For Prometheus AlertManager

```logql
# Critical: No successful backups in 24h
sum(count_over_time({namespace="velero"} |= "backup" |= "Completed" [24h])) == 0

# Warning: High backup failure rate
(
  sum(count_over_time({namespace="velero"} |= "backup" |~ "Failed" [1h])) /
  sum(count_over_time({namespace="velero"} |= "backup" [1h]))
) > 0.1

# Storage issues
sum(count_over_time({namespace="velero"} |= "BackupStorageLocation" |= "unavailable" [5m])) > 0
```

## 💡 **Pro Tips for Velero Log Analysis**

### 1. **Combine with Metrics**
```logql
# Use logs to understand WHY metrics show problems
# Example: If backup_success_rate metric drops, query:
{namespace="velero"} |= "backup" |~ "Failed|Error" | json
```

### 2. **Track User-Initiated vs Scheduled Backups**
```logql
# Manual backups
{namespace="velero"} |= "backup" |!= "schedule"

# Scheduled backups  
{namespace="velero"} |= "backup" |= "schedule"
```

### 3. **Monitor Backup Chain Integrity**
```logql
# Full vs incremental backups
{namespace="velero"} |= "backup" |~ "full|incremental"

# Backup dependencies
{namespace="velero"} |= "backup" |= "parent"
```

### 4. **Resource-Specific Issues**
```logql
# PVC backup issues
{namespace="velero"} |= "PersistentVolumeClaim" |~ "error|skip"

# Secret/ConfigMap issues
{namespace="velero"} |~ "Secret|ConfigMap" |~ "error|permission"

# CRD issues
{namespace="velero"} |= "CustomResourceDefinition" |~ "error|skip"
```

## 🎯 **Focus Areas for Dashboards**

Based on the Velero namespace being the source of truth:

1. **Backup Success Timeline** - Show backup completion over time
2. **Failure Analysis** - Parse error messages from failed operations
3. **Storage Health** - Monitor BackupStorageLocation status
4. **Performance Trends** - Track backup duration and size growth
5. **Schedule Compliance** - Verify scheduled backups are running
6. **Cross-Cluster Correlation** - If using multiple clusters

The velero-manager namespace logs are secondary - mainly for:
- API authentication issues
- Web UI access problems  
- OIDC troubleshooting
- User activity auditing