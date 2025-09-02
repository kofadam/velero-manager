# Velero Manager Observability Stack

## Overview

Velero Manager includes a comprehensive observability stack designed for production-grade monitoring of backup operations across multiple Kubernetes clusters. The stack provides real-time metrics, log aggregation, alerting, and beautiful dashboards for operational insights.

## Components

### 1. Grafana Alloy
Modern replacement for Promtail, Alloy handles both metrics scraping and log collection:
- **Metrics**: Scrapes Velero Manager metrics via ServiceMonitor
- **Logs**: Collects logs from both `velero` and `velero-manager` namespaces
- **Processing**: Parses Gin framework logs, Velero structured logs, and backup operation events

### 2. Prometheus
Time-series database for metrics storage:
- **Cluster Metrics**: Health status, success rates, backup counts
- **API Metrics**: Request rates, response times, error rates
- **Operational Metrics**: Backup duration, restore performance, schedule compliance

### 3. Loki
Log aggregation system:
- **Namespace Separation**: Distinct processing for velero system logs vs application logs
- **Structured Parsing**: Extracts backup status, operations, and error details
- **Label Enrichment**: Adds severity, priority, and operational context

### 4. Grafana
Visualization and alerting platform with pre-configured dashboards

## Deployment Guide

### Production Deployment (monitoring namespace)

1. **Create the monitoring namespace:**
```bash
kubectl create namespace monitoring
```

2. **Deploy Alloy for metrics and logs collection:**
```bash
kubectl apply -f k8s/monitoring/alloy.yaml
```

3. **Deploy ServiceMonitor for Prometheus scraping:**
```bash
kubectl apply -f k8s/monitoring/servicemonitor.yaml
```

4. **Deploy Prometheus alerts:**
```bash
kubectl apply -f k8s/monitoring/prometheus-alerts.yaml
```

5. **Verify deployment:**
```bash
# Check Alloy is running
kubectl get pods -n monitoring | grep alloy

# Check ServiceMonitor is created
kubectl get servicemonitor -n monitoring

# Verify metrics are being scraped
curl http://<prometheus-url>/api/v1/targets | grep velero-manager
```

### MicroK8s Deployment (observability namespace)

For MicroK8s with the observability addon:

1. **Enable observability addon:**
```bash
microk8s enable observability
```

2. **Deploy simplified Alloy configuration:**
```bash
kubectl apply -f k8s/observability/alloy-simple.yaml
```

3. **Deploy ServiceMonitor:**
```bash
kubectl apply -f k8s/observability/servicemonitor.yaml
```

## Grafana Dashboards

### Daily Backup Overview Dashboard
**File**: `grafana-daily-backup-overview.json`
**UID**: `velero-daily-overview`

Perfect for morning operational checks:
- **Top Row Stats**:
  - 24-hour backup success rate (overall percentage)
  - Failed backups count (last 24 hours)
  - Successful backups count (last 24 hours)  
  - Clusters without recent backups
  
- **Middle Section**:
  - Failed backup logs requiring investigation
  - Cluster backup status table with health indicators
  
- **Bottom Section**:
  - Backup activity timeline (hourly success/failure rates)
  - Schedule status table showing last run times
  - Recent successful backup logs

### Velero Operations Dashboard
**File**: `grafana-velero-operations.json`
**UID**: `velero-operations`

Comprehensive operational monitoring:
- Cluster health status with color coding
- Backup success rate trends by cluster
- Backup status distribution (pie chart)
- Log level analysis over time
- Restore operations tracking
- Storage and infrastructure issue logs
- Cluster backup summary table
- Scheduled backup activity monitoring

### Importing Dashboards

1. **Access Grafana:**
```bash
# Production
http://grafana.monitoring.svc.cluster.local:3000

# MicroK8s
kubectl port-forward -n observability svc/kube-prom-stack-grafana 3000:80
```

2. **Import dashboard:**
- Navigate to Dashboards → Import
- Upload JSON file or paste contents
- Select Prometheus and Loki datasources
- Click Import

## Metrics Reference

### Cluster Metrics
```promql
# Cluster health (0=critical, 1=no-backups, 2=warning, 3=healthy)
velero_cluster_health_status{cluster="cluster-name"}

# Backup success rate percentage
velero_cluster_backup_success_rate{cluster="cluster-name"}

# Last backup timestamp (Unix timestamp)
velero_cluster_last_backup_timestamp{cluster="cluster-name"}

# Total backups by status
velero_cluster_backup_total{cluster="cluster-name",status="total|successful|failed"}

# Total restores by status  
velero_cluster_restore_total{cluster="cluster-name",status="total|successful|failed"}
```

### Backup Operation Metrics
```promql
# Backup counters by namespace, schedule, and storage
velero_backup_total{namespace="ns",schedule="daily",storage_location="s3"}
velero_backup_success_total{...}
velero_backup_failure_total{...}

# Backup performance
velero_backup_duration_seconds{...}
velero_backup_size_bytes{backup_name="backup-20240101"}
velero_backup_items_total{...}
velero_backup_items_backed_up{...}
```

### API Metrics
```promql
# API request counters
velero_manager_api_requests_total{method="GET",endpoint="/api/v1/backups",status="200"}

# API performance
velero_manager_api_request_duration_seconds{method="POST",endpoint="/api/v1/backups"}
```

## Alert Rules

### Critical Alerts

#### VeleroBackupFailed
- **Trigger**: Any backup failure in the last hour
- **Severity**: Critical
- **Action**: Investigate failed backup logs immediately

#### VeleroNoRecentBackup
- **Trigger**: No successful backup in 24 hours
- **Severity**: Critical
- **Action**: Check schedule status and storage connectivity

#### VeleroStorageLocationUnavailable
- **Trigger**: Backup storage location unreachable for 10 minutes
- **Severity**: Critical
- **Action**: Verify S3/MinIO connectivity and credentials

### Warning Alerts

#### VeleroBackupSuccessRateLow
- **Trigger**: Success rate below 85% for 15 minutes
- **Severity**: Warning
- **Action**: Review backup logs for recurring issues

#### VeleroSchedulePaused
- **Trigger**: Backup schedule paused for over 1 hour
- **Severity**: Warning
- **Action**: Verify if pause is intentional

#### VeleroDailyBackupMissing
- **Trigger**: No daily backup completed in 25 hours
- **Severity**: Warning (SLA)
- **Action**: Check daily schedule execution

## Log Queries

### Essential LogQL Queries

```logql
# All backup failures
{namespace="velero"} |= "backup" |~ "Failed|Error|PartiallyFailed"

# Backup completions
{namespace="velero"} |= "backup" |= "Completed"

# Storage issues
{namespace="velero"} |= "BackupStorageLocation" |~ "error|unavailable"

# Restore operations
{namespace="velero"} |= "restore" |~ "Completed|Failed"

# API errors (velero-manager)
{namespace="velero-manager"} |~ "403|401|500|error"
```

### Metric Generation from Logs

```logql
# Backup success rate from logs
(
  sum(count_over_time({namespace="velero"} |= "backup" |= "Completed" [1h])) /
  sum(count_over_time({namespace="velero"} |= "backup" [1h]))
) * 100

# Error rate percentage
sum(rate({namespace="velero"} |~ "Failed|Error" [5m])) * 100
```

## Troubleshooting

### Metrics Not Appearing

1. **Check ServiceMonitor:**
```bash
kubectl get servicemonitor -n monitoring velero-manager -o yaml
```

2. **Verify Prometheus targets:**
```bash
curl http://<prometheus-url>/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job == "velero-manager")'
```

3. **Check Alloy logs:**
```bash
kubectl logs -n monitoring daemonset/alloy
```

### Logs Not Collected

1. **Verify Alloy configuration:**
```bash
kubectl describe configmap -n monitoring alloy-config
```

2. **Check Loki connectivity:**
```bash
kubectl exec -n monitoring daemonset/alloy -- wget -O- http://loki:3100/ready
```

3. **Verify namespace labels:**
```bash
kubectl get namespace velero velero-manager --show-labels
```

### Dashboard Not Loading

1. **Check datasource configuration:**
- Prometheus URL: `http://prometheus:9090`
- Loki URL: `http://loki:3100`

2. **Verify time range:**
- Ensure selected time range contains data
- Default to "Last 24 hours" for daily overview

3. **Check variable substitution:**
- Cluster variable should populate from metrics
- Namespace variable should show velero, velero-manager

## Testing with Mock Data

For development and testing, generate realistic metrics:

```bash
# Generate mock metrics data
curl -X POST http://velero-manager:8080/api/v1/test/generate-mock-data

# Verify metrics
curl http://velero-manager:8080/metrics | grep velero_cluster

# Check in Prometheus
curl "http://prometheus:9090/api/v1/query?query=velero_cluster_health_status"
```

## Best Practices

### 1. Retention Policies
- **Metrics**: 15 days for high-resolution, 90 days for 5m aggregations
- **Logs**: 7 days for debug level, 30 days for errors and critical

### 2. Resource Allocation
```yaml
resources:
  alloy:
    requests:
      cpu: 100m
      memory: 200Mi
    limits:
      cpu: 500m
      memory: 500Mi
```

### 3. Label Cardinality
- Avoid high-cardinality labels (e.g., backup names in metrics)
- Use log correlation for detailed tracking
- Aggregate metrics by cluster, namespace, and schedule

### 4. Alert Fatigue Prevention
- Set appropriate thresholds (85% for warnings, 95% for SLA)
- Use time windows (for: 15m) to avoid flapping
- Group related alerts to reduce noise

## Integration with External Systems

### Slack Notifications
```yaml
route:
  group_by: ['alertname', 'cluster']
  receiver: 'slack-notifications'
  routes:
  - match:
      severity: critical
    receiver: 'slack-critical'
```

### PagerDuty Integration
```yaml
receivers:
- name: 'pagerduty'
  pagerduty_configs:
  - service_key: '<service-key>'
    description: 'Velero Backup Failed: {{ .GroupLabels.cluster }}'
```

## Additional Resources

- [Grafana Alloy Documentation](https://grafana.com/docs/alloy/latest/)
- [Prometheus Operator](https://prometheus-operator.dev/)
- [Loki Best Practices](https://grafana.com/docs/loki/latest/best-practices/)
- [Velero Metrics](https://velero.io/docs/main/metrics/)

---

For questions or issues, please refer to the [main README](../README.md) or open an issue in the repository.