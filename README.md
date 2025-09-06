# Velero Manager

A modern web interface for managing Velero backup and restore operations across multiple Kubernetes clusters. Provides a user-friendly dashboard for monitoring backup health, creating scheduled backups, and performing disaster recovery operations.

## What is Velero Manager?

Velero Manager simplifies Kubernetes backup management by providing:

- **Multi-cluster backup management** - Centralized control of Velero operations across multiple clusters
- **Web-based interface** - Modern React dashboard for managing backups, restores, and schedules
- **Real-time monitoring** - Live backup status, cluster health, and success rate tracking
- **Enterprise authentication** - OIDC/SSO integration alongside traditional login
- **Comprehensive observability** - Integrated Grafana dashboards and Prometheus metrics

## Features

- **Backup Operations** - Create, monitor, and manage backups with real-time status
- **Restore Management** - Cross-cluster restore capabilities with target selection
- **Schedule Automation** - CronJob-based backup scheduling and management
- **Cluster Health Monitoring** - Real-time cluster status and backup success rates
- **Storage Location Management** - Configure and manage backup storage locations
- **User Authentication** - OIDC/SSO integration with role-based access control

## Architecture

- **Frontend**: React 18 + TypeScript with Material-UI design system
- **Backend**: Go with Gin framework and Velero CRD integration
- **Authentication**: OpenID Connect (OIDC) + JWT token fallback
- **Storage**: S3-compatible storage backends (MinIO, AWS S3, etc.)
- **Deployment**: Docker containers with Kubernetes manifests

## Quick Start

### Prerequisites

- Kubernetes cluster with Velero installed
- kubectl access to your clusters
- Docker for building images
- Node.js and npm for frontend development

### Local Development

```bash
# Clone the repository
git clone https://github.com/kofadam/velero-manager.git
cd velero-manager

# Build frontend
cd frontend && npm install && npm run build

# Start backend
cd ../backend && go run main.go

# Access the application
http://localhost:8080
```

### Kubernetes Deployment

```bash
# Build and deploy to Kubernetes
./build.sh        # Build Docker image
./deploy-local.sh # Deploy to cluster

# Or use kubectl directly
kubectl apply -f k8s/
```

### Docker Deployment

```bash
# Build image
docker build -t velero-manager:latest .

# Run container
docker run -p 8080:8080 velero-manager:latest
```

## Configuration

### Basic Configuration

The application can be configured through environment variables or Kubernetes ConfigMaps:

```bash
# Authentication
OIDC_ENABLED=true
OIDC_ISSUER_URL=https://your-keycloak.com/auth/realms/company
OIDC_CLIENT_ID=velero-manager

# Server settings
GIN_MODE=release
PORT=8080
```

### Storage Configuration

Configure backup storage locations through the web interface or API:

- S3-compatible storage (AWS S3, MinIO, etc.)
- Self-signed certificate support
- Credential management

## Documentation

- **[Velero Deployment Guide](docs/velero-deployment-readme.md)** - Complete Velero setup and configuration
- **[OIDC Setup Guide](docs/OIDC_SETUP.md)** - Authentication configuration
- **[Observability Guide](docs/OBSERVABILITY.md)** - Monitoring and dashboard setup
- **[Grafana Dashboard Guide](docs/GRAFANA_DASHBOARD.md)** - Dashboard configuration

## Monitoring & Observability

Velero Manager includes integrated monitoring capabilities:

- **Prometheus metrics** - Cluster health and backup success rates
- **Grafana dashboards** - Pre-configured operational dashboards
- **Real-time alerts** - Backup failure notifications
- **Log aggregation** - Centralized logging with Loki

For detailed setup instructions, see the [Observability Guide](docs/OBSERVABILITY.md).

## Helm Chart (Coming Soon)

Helm chart deployment will be available in future releases for simplified Kubernetes installation.

## API Documentation

The application provides REST APIs for programmatic access:

- **Authentication**: `/api/v1/auth/*` - Login, OIDC, user management
- **Clusters**: `/api/v1/clusters/*` - Cluster management and health
- **Backups**: `/api/v1/backups/*` - Backup operations and status
- **Restores**: `/api/v1/restores/*` - Restore operations
- **Monitoring**: `/api/v1/dashboard/*` - Metrics and dashboard data

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Velero](https://velero.io/) - Kubernetes backup and disaster recovery
- [Material-UI](https://mui.com/) - React component library
- [Prometheus](https://prometheus.io/) & [Grafana](https://grafana.com/) - Monitoring stack
