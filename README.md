# Velero Manager

An enterprise-grade multi-cluster web interface for managing Velero backup operations across Kubernetes environments with comprehensive observability.

## Features

- **Multi-Cluster Management** - Centralized control across multiple Kubernetes clusters
- **Backup Operations** - Create, monitor, and manage backups with real-time status
- **Restore Management** - Cross-cluster restore capabilities with target selection
- **Schedule Automation** - CronJob-based backup scheduling (replacing Velero schedules)
- **Cluster Health Monitoring** - Real-time cluster status and backup metrics
- **Material-UI Design** - Modern dashboard with professional enterprise interface
- **Comprehensive Observability** - Integrated Alloy + Prometheus + Grafana metrics
- **Air-Gap Ready** - Fully self-contained for isolated environments

## Architecture

- **Frontend**: React 18 + TypeScript with Material-UI design system
- **Backend**: Go 1.24 + Gin framework with real Velero CRD integration
- **Observability**: Alloy metrics collection, Prometheus storage, Grafana dashboards
- **Storage**: MinIO S3 backend with tested disaster recovery workflows
- **Deployment**: Docker containers + Kubernetes manifests for air-gap environments

## Quick Start

### Development Mode
```bash
# Start backend
cd ./velero-manager
./backend/velero-manager

# Build frontend (required after changes)
cd ./velero-manager/frontend
npm run build
```

### Production Deployment
```bash
# Build and deploy locally (development)
./build.sh                # Builds and pushes to localhost:32000 registry
./deploy-local.sh         # Updates Kubernetes deployment

# Release build
docker build -t kofadam/velero-manager:v2.0.0 .
docker push kofadam/velero-manager:v2.0.0
```

### Access Application
```bash
# Local development
http://localhost:8080

# Grafana observability dashboard  
http://localhost:3000

# Prometheus metrics
http://localhost:9090
```

## Multi-Cluster Configuration

### Backend API Endpoints

#### Cluster Management
- `GET /api/v1/clusters` - List all managed clusters
- `GET /api/v1/clusters/{cluster}/health` - Get cluster health status
- `GET /api/v1/clusters/{cluster}/backups` - List cluster-specific backups

#### Backup Operations
- `GET /api/v1/backups` - List all backups across clusters
- `POST /api/v1/backups` - Create new backup
- `DELETE /api/v1/backups/{name}` - Delete backup

#### Restore Operations  
- `GET /api/v1/restores` - List all restores
- `POST /api/v1/restores` - Create restore (with target cluster selection)
- `GET /api/v1/restores/{name}/logs` - Get restore logs

#### CronJob Management
- `GET /api/v1/cronjobs` - List backup automation jobs
- `POST /api/v1/cronjobs` - Create scheduled backup job

## Observability Stack

### Metrics Collection (Alloy)
```yaml
# k8s/observability/alloy.yaml
- Velero pod metrics scraping
- Backup/restore operation metrics
- Cluster health indicators
- Custom business metrics
```

### Prometheus Storage
```yaml
# k8s/observability/prometheus.yaml
- Velero metrics retention
- Multi-cluster data aggregation
- Alert rule definitions
```

### Grafana Dashboards
```yaml
# k8s/observability/grafana.yaml
- Real-time backup success rates
- Cross-cluster health overview
- Historical trend analysis
- Failure correlation views
```

## Air-Gap Deployment

Designed for completely isolated Kubernetes environments:

### Requirements
- **No internet access** required during operation
- **All dependencies** vendored or containerized
- **Local container registry** (localhost:32000 for development)
- **MinIO S3** backend for backup storage
- **Velero** with node-agent deployed in target clusters

### Kubernetes Deployment
```bash
# Deploy observability stack
kubectl apply -f k8s/observability/

# Deploy main application
kubectl apply -f k8s/deployment.yaml

# Verify deployment
kubectl get pods -n velero-manager
```

## Development Workflow

### Local CI/CD Pipeline
```bash
# Complete development cycle
1. Make frontend/backend changes
2. ./build.sh              # Auto-build and local registry push
3. ./deploy-local.sh       # Update running Kubernetes deployment
4. Test at http://localhost:8080
5. git commit & push only when stable
```

### Version Management
```bash
# Automatic version injection
./version.sh              # Get current git-based version
# Docker build automatically injects version into React frontend
# UI displays actual version (not hardcoded)
```

### Branch Strategy
```bash
# Current active branch
feature/multi-cluster-management

# Tested features
- Multi-cluster backend (complete)
- Dashboard Material-UI redesign (complete) 
- Backup/Restore cluster support (complete)
- Modal consistency (complete)
- UI background standardization (in progress)
```

## Current Status (v2.0.0)

### Completed Features
- **Backend**: Full multi-cluster API with real CRD integration
- **Dashboard**: Complete Material-UI transformation with compact layout
- **Backup Page**: Cluster filtering, sorting, search with consistent styling
- **Restore Page**: Multi-cluster support with standardized interface
- **Observability**: Working metrics collection showing accurate data
- **Routing**: Browser refresh maintains page state
- **App Branding**: Updated title, needs favicon replacement

### In Progress
- **UI Consistency**: Standardizing header styling across all pages
- **Schedule Page**: Adding cluster support and Material-UI styling
- **Settings Page**: Material-UI transformation pending

### Tested Functionality
```bash
# Confirmed working end-to-end
curl http://localhost:8080/api/v1/clusters/core-cl1/health
# Returns: {"backupCount": 1, "cluster": "core-cl1", "lastBackup": "2025-08-29T08:40:27Z", "status": "healthy"}

# Complete disaster recovery workflow tested
1. Create backup → 2. Simulate failure → 3. Cross-cluster restore → 4. Verify data
```

## Contributing

## License

MIT License - Enterprise backup management for Kubernetes environments.

## Acknowledgments

- [Velero](https://velero.io/) - Kubernetes backup and disaster recovery
- [Material-UI](https://mui.com/) - Design system and component library
- [Prometheus](https://prometheus.io/) + [Grafana](https://grafana.com/) - Observability stack
- Air-gap deployment patterns for secure enterprise environments