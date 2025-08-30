# Velero Manager Grafana Dashboard

This repository includes a comprehensive Grafana dashboard for monitoring Velero Manager metrics across multiple clusters.

## 📊 Dashboard Overview

The dashboard provides comprehensive visibility into:

### **🎯 Key Metrics Panels**

1. **Cluster Health Status** - Real-time health indicators per cluster
   - 🟢 **Healthy** (90%+ backup success rate)
   - 🟡 **Warning** (70-90% backup success rate) 
   - 🟠 **No Backups** (no backup activity detected)
   - 🔴 **Critical** (<70% success rate or all backups failing)

2. **Backup & Restore Success Rates** - Per-cluster percentage success rates
   - Color-coded thresholds: Green (90%+), Yellow (70-90%), Red (<70%)
   - Horizontal bar charts for easy comparison across clusters

3. **Overall Backup & Restore Totals** - Time series of total operations
   - Successful vs failed backup/restore trends over time
   - Helps identify overall system health and activity patterns

4. **Backup Distribution** - Pie chart showing backup status distribution
   - Visual breakdown of successful, failed, and total backup counts

5. **Backup Duration Analysis** - Performance metrics
   - 95th and 50th percentile backup duration times
   - Helps identify performance issues and optimization opportunities

6. **Last Backup Information** - Critical monitoring table
   - Shows last backup timestamp per cluster
   - Time since last backup with color-coded alerts
   - Red alert if >48 hours, yellow if >24 hours

7. **Detailed Cluster Statistics** - Stacked time series
   - Successful vs failed backups per cluster over time
   - Helps identify cluster-specific trends and issues

8. **API Performance Monitoring** - Request rate and response times
   - API request rates by endpoint and status code
   - Performance monitoring for the Velero Manager application

9. **Operational Status** - Key metrics summary
   - Active schedules count
   - Paused schedules (with alerting)
   - Velero availability status
   - Total managed clusters

## 🚀 Setup Instructions

### **1. Prerequisites**

- Prometheus server configured to scrape Velero Manager metrics
- Grafana instance with Prometheus data source configured
- Velero Manager running with metrics enabled on `/metrics` endpoint

### **2. Prometheus Configuration**

Add the following job to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'velero-manager'
    static_configs:
      - targets: ['velero-manager:8080']  # Adjust host/port as needed
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### **3. Dashboard Import**

1. **Copy Dashboard JSON**: Use the provided `grafana-dashboard.json`

2. **Import to Grafana**:
   - Navigate to Grafana → Dashboards → Import
   - Paste the JSON content or upload the file
   - Select your Prometheus data source
   - Click "Import"

3. **Configure Data Source**: 
   - Ensure the `${DS_PROMETHEUS}` variable points to your Prometheus instance
   - Test data source connectivity

### **4. Dashboard Configuration**

- **Refresh Rate**: Default 30s auto-refresh (configurable)
- **Time Range**: Default 1 hour view (adjustable)
- **Variables**: Prometheus data source selector included

## 📈 Available Metrics

### **Cluster-Based Metrics** (New in v2.3.3+)

```
# Cluster health status (0=critical, 1=no-backups, 2=warning, 3=healthy)
velero_cluster_health_status{cluster="cluster-name"}

# Backup success rate percentage per cluster  
velero_cluster_backup_success_rate{cluster="cluster-name"}

# Restore success rate percentage per cluster
velero_cluster_restore_success_rate{cluster="cluster-name"}

# Last backup timestamp per cluster
velero_cluster_last_backup_timestamp{cluster="cluster-name"}

# Backup totals per cluster and status
velero_cluster_backup_total{cluster="cluster-name",status="successful|failed|total"}

# Restore totals per cluster and status  
velero_cluster_restore_total{cluster="cluster-name",status="successful|failed|total"}
```

### **Traditional Velero Metrics**

```
# Backup metrics
velero_backup_success_total{namespace,schedule,storage_location}
velero_backup_failure_total{namespace,schedule,storage_location}  
velero_backup_duration_seconds{namespace,schedule,phase}

# Restore metrics
velero_restore_success_total{namespace,backup_name}
velero_restore_failure_total{namespace,backup_name}
velero_restore_duration_seconds{namespace,backup_name,phase}

# Schedule metrics
velero_schedule_total{namespace,phase}
velero_schedule_paused{namespace}
velero_schedule_last_backup_timestamp{namespace,schedule_name}

# System metrics
velero_available                    # Velero CRD availability
velero_manager_api_requests_total   # API request counts
velero_manager_api_request_duration_seconds # API response times
```

## 🔧 Customization Options

### **Alert Rules** (Optional Prometheus Alerts)

```yaml
groups:
  - name: velero-manager.rules
    rules:
    - alert: VeleroClusterCritical
      expr: velero_cluster_health_status == 0
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Velero cluster {{ $labels.cluster }} is in critical state"
        
    - alert: VeleroNoRecentBackups  
      expr: time() - velero_cluster_last_backup_timestamp > 172800  # 48 hours
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "No recent backups for cluster {{ $labels.cluster }}"
        
    - alert: VeleroLowSuccessRate
      expr: velero_cluster_backup_success_rate < 70
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "Low backup success rate for cluster {{ $labels.cluster }}"
```

### **Panel Customization**

- **Thresholds**: Adjust success rate thresholds in each panel
- **Colors**: Modify color schemes for different status levels
- **Time Ranges**: Change default time ranges for different views
- **Legends**: Customize legend formats and positions

## 🔍 Troubleshooting

### **No Data Showing**

1. **Check Prometheus Scraping**:
   ```bash
   curl http://velero-manager:8080/metrics
   ```

2. **Verify Metrics Collection**:
   - Check Velero Manager logs for metrics collection errors
   - Ensure Kubernetes permissions for accessing Velero resources

3. **Data Source Connection**:
   - Test Prometheus data source in Grafana
   - Verify metric names in Prometheus query browser

### **Missing Cluster Metrics**

- Ensure Velero Manager version 2.3.3+ (includes cluster-based metrics)
- Check that backup naming follows expected conventions
- Verify cluster extraction logic matches your backup naming

### **Performance Issues**

- Adjust scrape intervals if needed (default 30s)
- Consider retention policies for high-cardinality metrics
- Use recording rules for complex calculations

## 🎨 Dashboard Features

- **🌙 Dark Theme** - Optimized for operations centers
- **📱 Responsive Design** - Works on mobile and desktop
- **🔄 Auto-refresh** - Real-time monitoring (30s default)
- **🎯 Smart Thresholds** - Industry-standard success rate thresholds
- **📊 Multiple Visualizations** - Bars, pies, time series, tables
- **⚠️ Alert-Ready** - Compatible with Prometheus alerting

## 📝 Version History

- **v1.0** - Initial dashboard with basic backup/restore metrics
- **v2.0** - Added cluster-based health monitoring
- **v2.3.3** - Complete cluster-centric redesign with success rates
- **Current** - Enhanced with API monitoring and operational status

---

**Need Help?** Check the Velero Manager documentation or open an issue in the repository.