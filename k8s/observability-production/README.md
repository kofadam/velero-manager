# Production Observability Stack for Velero Manager

This directory contains production-ready manifests for deploying a complete observability stack on vanilla Kubernetes.

## Components

- **Prometheus** - Metrics collection and storage
- **Loki** - Log aggregation and storage
- **Grafana** - Visualization and dashboards
- **Alloy** - Unified telemetry collector (replaces Promtail)

## Deployment Options

### Option 1: Full Stack (Recommended for new clusters)

Deploy everything including Prometheus, Loki, Grafana, and Alloy:

```bash
kubectl create namespace observability
kubectl apply -f namespace.yaml
kubectl apply -f prometheus.yaml
kubectl apply -f loki.yaml
kubectl apply -f grafana.yaml
kubectl apply -f alloy.yaml
```

### Option 2: Alloy Only (For existing observability stacks)

If you already have Prometheus/Loki/Grafana, just deploy Alloy:

```bash
kubectl apply -f alloy-standalone.yaml
```

Then configure Alloy to point to your existing endpoints.

## Configuration

### Customize Endpoints

Edit `alloy.yaml` or `alloy-standalone.yaml` to set your endpoints:

```yaml
# For Prometheus
PROMETHEUS_ENDPOINT: 'http://your-prometheus:9090/api/v1/write'

# For Loki
LOKI_ENDPOINT: 'http://your-loki:3100/loki/api/v1/push'
```

### Storage Configuration

For production, configure proper storage classes:

```yaml
storageClassName: 'fast-ssd' # Your storage class
storage: 100Gi # Adjust based on retention needs
```

## Security Considerations

1. **Enable Authentication**

   - Configure Grafana OIDC/LDAP
   - Add basic auth to Prometheus/Loki

2. **Network Policies**

   - Restrict access between namespaces
   - Limit ingress to Grafana only

3. **Resource Limits**

   - Set appropriate CPU/memory limits
   - Configure PVC sizes based on retention

4. **TLS/HTTPS**
   - Use cert-manager for certificates
   - Enable TLS on all endpoints

## Monitoring

After deployment, verify:

```bash
# Check all pods are running
kubectl get pods -n observability

# Verify Prometheus targets
kubectl port-forward -n observability svc/prometheus 9090:9090
# Browse to http://localhost:9090/targets

# Check Loki is receiving logs
kubectl port-forward -n observability svc/loki 3100:3100
curl http://localhost:3100/ready

# Access Grafana
kubectl port-forward -n observability svc/grafana 3000:3000
# Login with admin/admin (change immediately)
```

## Dashboards

Import the included dashboards:

1. `velero-manager-dashboard.json` - Main operational dashboard
2. `velero-cluster-overview.json` - Multi-cluster overview
3. `velero-slo-dashboard.json` - SLO/SLI tracking

## Retention Policies

Default retention:

- Prometheus: 30 days
- Loki: 30 days
- Grafana: Persistent

Adjust in respective ConfigMaps based on compliance requirements.

## Backup

Remember to backup:

- Grafana database (dashboards, users)
- Prometheus data (if long-term retention needed)
- Loki chunks (for compliance)

Use Velero itself to backup the observability namespace:

```bash
velero backup create observability-backup --include-namespaces observability
```
