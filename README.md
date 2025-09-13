# Velero Manager

Enterprise-grade backup orchestration and management platform for Kubernetes clusters. Provides centralized control, monitoring, and automation of Velero backup operations across multiple clusters with a modern web interface and GitOps integration.

## Overview

Velero Manager is a comprehensive solution that combines:
- **Web Management Interface** - React-based dashboard for backup operations
- **Multi-Cluster Orchestration** - Centralized backup management across clusters
- **Security-First Architecture** - Minimal RBAC permissions, no cluster-admin required
- **GitOps Automation** - ArgoCD integration for declarative configuration
- **Enterprise Authentication** - OIDC/SSO with role-based access control

## Key Features

### 🎯 Backup Management
- Create, monitor, and manage backups across multiple clusters
- Cross-cluster restore capabilities with target selection
- Automated scheduling with CronJob orchestration
- Real-time backup status and progress tracking
- Storage location management for S3-compatible backends

### 🔒 Security & Compliance
- **Minimal RBAC** - Least-privilege access model (no cluster-admin)
- **Token Rotation** - Automated credential rotation
- **Audit Logging** - Comprehensive backup operation audit trail
- **OIDC/SSO Integration** - Enterprise authentication support

### 📊 Monitoring & Observability
- Real-time cluster health monitoring
- Backup success rate tracking
- Prometheus metrics and alerts
- Grafana dashboards for operational visibility
- Centralized logging with audit trails

### 🚀 GitOps & Automation
- ArgoCD application management
- Declarative backup schedules
- Version-controlled configurations
- Automated deployment pipelines

## Architecture

```
┌─────────────────────┐
│   Web Interface     │ - React 18 + TypeScript + Material-UI
│  (Velero Manager)   │ - Real-time backup monitoring
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Management Cluster │ - Orchestration engine
│  - CronJobs         │ - ArgoCD for GitOps
│  - Velero           │ - Prometheus metrics
└──────────┬──────────┘
           │ Triggers backups
┌──────────▼──────────┐
│   Guest Clusters    │ - Velero agents
│  - Production       │ - Minimal RBAC
│  - Staging          │ - Workload namespaces
└──────────┬──────────┘
           │ Stores backups
┌──────────▼──────────┐
│   Object Storage    │ - S3-compatible
│  - MinIO/AWS S3     │ - Multi-region support
└─────────────────────┘
```

## Quick Start

### Option 1: Complete Multi-Cluster Setup

Deploy the full orchestration platform:

```bash
# Clone repository
git clone https://github.com/kofadam/velero-manager.git
cd velero-manager

# Deploy management components
cd orchestration
./scripts/deploy-secure-backup-system.sh deploy-all

# Add a guest cluster
./scripts/deploy-minimal-rbac.sh <cluster-name> <context>

# Access web interface
kubectl port-forward -n velero-manager svc/velero-manager 8080:8080
```

See the [Complete Deployment Guide](orchestration/VELERO_DEPLOYMENT_GUIDE.md) for detailed instructions.

### Option 2: Web UI Only

Deploy just the web interface:

```bash
# Deploy to Kubernetes
kubectl apply -f deployments/

# Or run locally
cd backend && go run main.go &
cd frontend && npm start
```

### Option 3: Docker

```bash
docker run -p 8080:8080 \
  -v ~/.kube/config:/app/kubeconfig \
  ghcr.io/kofadam/velero-manager:latest
```

## Documentation

### 📚 Deployment & Operations
- **[Complete Deployment Guide](orchestration/VELERO_DEPLOYMENT_GUIDE.md)** - Step-by-step multi-cluster setup
- **[Quick Reference](orchestration/QUICK_REFERENCE.md)** - Commands and troubleshooting
- **[Cluster Management](orchestration/CLUSTER_MANAGEMENT.md)** - Adding and managing clusters

### 🔧 Configuration
- **[OIDC Setup Guide](docs/OIDC_SETUP.md)** - Authentication configuration
- **[Observability Guide](docs/OBSERVABILITY.md)** - Monitoring and dashboards
- **[Grafana Dashboard Guide](docs/GRAFANA_DASHBOARD.md)** - Metrics visualization

### 🔒 Security
- **[Security Architecture](orchestration/security/README.md)** - RBAC implementation
- **[GitOps Workflow](orchestration/gitops/README.md)** - ArgoCD integration

## Configuration

### Environment Variables

```bash
# Authentication
OIDC_ENABLED=true
OIDC_ISSUER_URL=https://your-idp.com/auth/realms/company
OIDC_CLIENT_ID=velero-manager
OIDC_CLIENT_SECRET=your-secret

# Server
GIN_MODE=release
PORT=8080

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090
```

### Storage Backends

Supports all S3-compatible storage:
- AWS S3
- MinIO
- Google Cloud Storage (S3 API)
- Azure Blob (with S3 compatibility)
- NetApp StorageGRID

## API Reference

REST API endpoints for programmatic access:

| Endpoint | Description |
|----------|-------------|
| `/api/v1/auth/*` | Authentication and user management |
| `/api/v1/clusters/*` | Cluster management and health |
| `/api/v1/backups/*` | Backup operations |
| `/api/v1/restores/*` | Restore operations |
| `/api/v1/schedules/*` | Schedule management |
| `/api/v1/storage-locations/*` | Storage configuration |
| `/api/v1/dashboard/*` | Metrics and monitoring |

## Development

### Prerequisites
- Go 1.21+
- Node.js 18+
- Docker
- Kubernetes cluster with Velero

### Local Development

```bash
# Backend
cd backend
go mod download
go run main.go

# Frontend (separate terminal)
cd frontend
npm install
npm start

# Access at http://localhost:3000
```

### Building

```bash
# Build all components
./build.sh

# Build specific component
cd frontend && npm run build
cd backend && go build -o velero-manager

# Docker image
docker build -t velero-manager:latest .
```

### Testing

```bash
# Backend tests
cd backend && go test ./...

# Frontend tests
cd frontend && npm test

# E2E tests
npm run test:e2e
```

## Project Structure

```
velero-manager/
├── backend/           # Go backend with Gin framework
├── frontend/          # React TypeScript frontend
├── deployments/       # Kubernetes manifests
├── orchestration/     # Multi-cluster orchestration
│   ├── security/      # RBAC and security configs
│   ├── gitops/        # ArgoCD applications
│   ├── scripts/       # Deployment automation
│   └── examples/      # Example configurations
├── docs/              # Additional documentation
└── build/             # Build scripts and Docker
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`go test ./...` and `npm test`)
5. Commit using conventional commits (`git commit -m 'feat: add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Roadmap

- [ ] Helm chart for simplified deployment
- [ ] Multi-tenancy support
- [ ] Backup policies and compliance rules
- [ ] Cost optimization analytics
- [ ] Disaster recovery automation
- [ ] Backup verification and testing
- [ ] Mobile app for monitoring

## Support

- **Documentation**: See `/docs` and `/orchestration` directories
- **Issues**: [GitHub Issues](https://github.com/kofadam/velero-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/kofadam/velero-manager/discussions)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Velero](https://velero.io/) - Kubernetes backup and disaster recovery
- [Material-UI](https://mui.com/) - React component library
- [ArgoCD](https://argoproj.github.io/cd/) - GitOps continuous delivery
- [Prometheus](https://prometheus.io/) & [Grafana](https://grafana.com/) - Monitoring stack

---

**Velero Manager** - Enterprise backup orchestration for Kubernetes
*Secure • Scalable • Simple*