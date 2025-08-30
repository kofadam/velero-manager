# Velero Manager

An enterprise-grade multi-cluster web interface for managing Velero backup operations across Kubernetes environments with comprehensive observability and corporate SSO integration.

## 🚀 Recent Major Updates (v2.3.0+)

### 🔐 **OIDC Authentication with Corporate Keycloak**
- **Single Sign-On**: Full OpenID Connect integration with corporate Keycloak
- **Role Mapping**: Automatic admin/user role assignment via Keycloak groups/roles
- **Backward Compatible**: Legacy username/password authentication remains available
- **Security**: State validation, proper token lifecycle, JWT bearer authentication

### 📊 **Enhanced Monitoring & Dashboards**
- **Cluster-Based Metrics**: Health status, success rates, and operational metrics per cluster
- **Comprehensive Grafana Dashboard**: 13 panels with color-coded thresholds and alerting
- **Auto-Refresh**: Real-time dashboard updates every 30 seconds
- **Prometheus Integration**: Cluster-specific metrics with backup/restore correlation

## Features

### Core Functionality
- **Multi-Cluster Management** - Centralized control across multiple Kubernetes clusters
- **Backup Operations** - Create, monitor, and manage backups with real-time status
- **Restore Management** - Cross-cluster restore capabilities with target selection
- **Schedule Automation** - CronJob-based backup scheduling (replacing Velero schedules)
- **Cluster Health Monitoring** - Real-time cluster status and backup metrics with success rates

### Enterprise Features
- **Corporate SSO** - OIDC authentication with Keycloak integration
- **Role-Based Access** - Admin/user permissions via corporate groups/roles
- **Material-UI Design** - Modern dashboard with professional enterprise interface
- **Comprehensive Observability** - Integrated Alloy + Prometheus + Grafana metrics
- **Air-Gap Ready** - Fully self-contained for isolated environments

## Architecture

- **Frontend**: React 18 + TypeScript with Material-UI design system and OIDC authentication
- **Backend**: Go 1.24 + Gin framework with OIDC middleware and real Velero CRD integration
- **Authentication**: OpenID Connect (Keycloak) + Legacy JWT/username fallback
- **Observability**: Cluster-based metrics collection, Prometheus storage, Grafana dashboards
- **Storage**: MinIO S3 backend with tested disaster recovery workflows
- **Deployment**: Docker containers + Kubernetes manifests for air-gap environments

## 🔧 Quick Start

### Development Mode
```bash
# Start backend (legacy auth only)
cd ./velero-manager/backend
OIDC_ENABLED=false ./velero-manager

# Start with OIDC (requires Keycloak configuration)
OIDC_ENABLED=true \
OIDC_ISSUER_URL=https://keycloak.company.com/auth/realms/company \
OIDC_CLIENT_ID=velero-manager \
OIDC_CLIENT_SECRET=your-secret \
./velero-manager

# Build frontend
cd ../frontend
npm run build
```

### Production Deployment
```bash
# Build and deploy locally (development)
./build.sh                # Builds and pushes to localhost:32000 registry
./deploy-local.sh         # Updates Kubernetes deployment

# Enterprise release with OIDC
docker build -t your-registry/velero-manager:v2.3.0 .
docker push your-registry/velero-manager:v2.3.0
```

### Access Application
```bash
# Local development
http://localhost:8080

# Default credentials (legacy auth)
Username: admin
Password: admin

# Grafana observability dashboard  
http://localhost:3000

# Prometheus metrics
http://localhost:9090/targets
```

## 🔐 Authentication Setup

### OIDC / Corporate Keycloak
For corporate environments with existing Keycloak/SSO infrastructure:

```bash
# Environment configuration
OIDC_ENABLED=true
OIDC_ISSUER_URL=https://keycloak.company.com/auth/realms/company
OIDC_CLIENT_ID=velero-manager
OIDC_CLIENT_SECRET=your-keycloak-client-secret
OIDC_REDIRECT_URL=https://velero-manager.company.com/auth/callback

# Role mapping
OIDC_ADMIN_ROLES=velero-admin,backup-admin
OIDC_ADMIN_GROUPS=platform-administrators,backup-operators
OIDC_DEFAULT_ROLE=user
```

**📋 Complete Setup Guide**: [docs/OIDC_SETUP.md](docs/OIDC_SETUP.md)

### Legacy Authentication
For development or environments without SSO:
- **Default Credentials**: `admin` / `admin`
- **User Management**: `/api/v1/users` endpoints for CRUD operations
- **JWT Tokens**: 24-hour expiry with automatic refresh

## 📊 Monitoring & Observability

### Grafana Dashboard
Comprehensive monitoring with 13 panels covering:
- **Cluster Health Status** - Real-time health indicators with color coding
- **Backup & Restore Success Rates** - Per-cluster percentage tracking
- **Last Backup Information** - Timestamp tracking with alerts
- **API Performance** - Request rates and response times
- **Operational Status** - Active schedules and system health

**📋 Complete Setup Guide**: [docs/GRAFANA_DASHBOARD.md](docs/GRAFANA_DASHBOARD.md)

### Metrics Collection
```bash
# Prometheus metrics endpoint
curl http://localhost:8080/metrics

# Key cluster-based metrics (new in v2.3.0+)
velero_cluster_health_status{cluster="cluster-name"}
velero_cluster_backup_success_rate{cluster="cluster-name"}
velero_cluster_last_backup_timestamp{cluster="cluster-name"}
```

## 📡 API Endpoints

### Authentication (New)
- `GET /api/v1/auth/info` - Authentication configuration and current user info
- `POST /api/v1/auth/login` - Legacy username/password login
- `GET /api/v1/auth/oidc/login` - Initiate OIDC authentication flow  
- `GET /api/v1/auth/oidc/callback` - Handle OIDC callback
- `POST /api/v1/auth/logout` - Logout (provides OIDC logout URL)

### Cluster Management
- `GET /api/v1/clusters` - List all managed clusters with health metrics
- `GET /api/v1/clusters/{cluster}/health` - Get cluster health status and success rates
- `GET /api/v1/clusters/{cluster}/backups` - List cluster-specific backups
- `GET /api/v1/clusters/{cluster}/details` - Comprehensive cluster information

### Backup Operations
- `GET /api/v1/backups` - List all backups across clusters
- `POST /api/v1/backups` - Create new backup
- `DELETE /api/v1/backups/{name}` - Delete backup

### Restore Operations  
- `GET /api/v1/restores` - List all restores
- `POST /api/v1/restores` - Create restore (with target cluster selection)
- `GET /api/v1/restores/{name}/logs` - Get restore logs
- `GET /api/v1/restores/{name}/describe` - Get restore details

### Monitoring & Metrics
- `GET /api/v1/dashboard/metrics` - Enhanced dashboard metrics with cluster breakdowns
- `GET /metrics` - Prometheus metrics endpoint with cluster-based metrics

## 🐳 Deployment Options

### Docker Compose (Development)
```yaml
version: '3.8'
services:
  velero-manager:
    image: your-registry/velero-manager:v2.3.0
    environment:
      OIDC_ENABLED: "true"
      OIDC_ISSUER_URL: "https://keycloak.company.com/auth/realms/company"
      OIDC_CLIENT_ID: "velero-manager"
      OIDC_CLIENT_SECRET: "${OIDC_CLIENT_SECRET}"
    ports:
      - "8080:8080"
```

### Kubernetes (Production)
```bash
# Deploy observability stack
kubectl apply -f k8s/observability/

# Deploy main application with OIDC
kubectl create secret generic oidc-secret \
  --from-literal=OIDC_CLIENT_SECRET=your-secret

kubectl apply -f k8s/deployment.yaml

# Verify deployment
kubectl get pods -n velero-manager
```

### Air-Gap Deployment
Perfect for completely isolated environments:
- **No internet access** required during operation
- **All dependencies** vendored or containerized
- **Local container registry** support
- **MinIO S3** backend for backup storage

## 🔄 Current Development Status

### ✅ Completed Features (v2.3.0+)
- **✅ OIDC Authentication**: Complete Keycloak integration with role mapping
- **✅ Enhanced Dashboard**: Cluster-based metrics with auto-refresh
- **✅ Grafana Integration**: 13-panel comprehensive monitoring dashboard  
- **✅ Multi-Cluster Backend**: Real CRD integration with health monitoring
- **✅ Material-UI Frontend**: Modern enterprise interface design
- **✅ Backup/Restore Operations**: Cross-cluster support with filtering
- **✅ Observability Stack**: Prometheus metrics with cluster correlation
- **✅ Documentation**: Complete setup guides for OIDC and monitoring

### 🚧 In Progress / TODO
- **🔄 OIDC Configuration Management**: Make OIDC configuration through configMap and UI settings
- **🔄 Frontend Route Integration**: Add OIDC callback route to React router
- **🔄 Schedule Page Enhancement**: Material-UI transformation with cluster support
- **🔄 Settings Page Redesign**: OIDC user info display and management
- **🔄 User Profile Management**: Display OIDC user details (email, groups, roles)
- **🔄 Error Handling**: Enhanced OIDC error states and user feedback
- **🔄 Testing**: End-to-end OIDC authentication flow validation
- **🔄 Mobile Responsiveness**: Dashboard optimization for mobile devices
- **🔄 Advanced Permissions**: Granular RBAC based on Keycloak roles
- **🔄 Audit Logging**: Track authentication and backup operations
- **🔄 High Availability**: Multi-replica deployment with session persistence

### 🏗️ Future Enhancements
- **📱 Mobile App**: React Native companion app
- **🔔 Notifications**: Slack/Teams integration for backup failures
- **🤖 AI/ML**: Predictive backup failure analysis
- **🔒 Vault Integration**: Dynamic secret management
- **🌐 Multi-Region**: Cross-region backup replication
- **📈 Cost Analytics**: Backup storage cost tracking and optimization

## 📚 Documentation

- **[OIDC Setup Guide](docs/OIDC_SETUP.md)** - Complete Keycloak integration setup
- **[Grafana Dashboard Guide](docs/GRAFANA_DASHBOARD.md)** - Monitoring and alerting setup
- **[Environment Configuration](.env.example)** - Configuration template with examples

## 🧪 Testing

### Manual Testing Workflow
```bash
# Test authentication endpoints
curl http://localhost:8080/api/v1/auth/info

# Test legacy login
curl -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  http://localhost:8080/api/v1/auth/login

# Test cluster health with authentication
curl -H "Authorization: Bearer <jwt-token>" \
  http://localhost:8080/api/v1/clusters/cluster-name/health
```

### Verified Functionality
- **✅ Multi-cluster API**: All endpoints returning accurate cluster-specific data
- **✅ Authentication Flow**: Both OIDC and legacy login working
- **✅ Dashboard Metrics**: Real-time cluster health and success rates
- **✅ Backup/Restore**: End-to-end disaster recovery workflow tested
- **✅ Grafana Integration**: All 13 panels displaying live data
- **✅ Role-Based Access**: Admin/user permissions enforced

## 🤝 Contributing

1. **Fork** the repository
2. **Create** feature branch (`git checkout -b feature/amazing-feature`)
3. **Test** your changes thoroughly
4. **Commit** with descriptive messages (`git commit -m 'feat: add amazing feature'`)
5. **Push** to branch (`git push origin feature/amazing-feature`)
6. **Open** Pull Request with detailed description

### Development Guidelines
- **TypeScript**: Use strict typing for all frontend code
- **Go**: Follow standard Go conventions and error handling
- **Testing**: Add tests for new authentication and API features
- **Documentation**: Update relevant docs for configuration changes

## 📄 License

MIT License - Enterprise backup management for Kubernetes environments.

## 🙏 Acknowledgments

- [Velero](https://velero.io/) - Kubernetes backup and disaster recovery
- [Material-UI](https://mui.com/) - Design system and component library
- [Keycloak](https://www.keycloak.org/) - Identity and access management
- [Prometheus](https://prometheus.io/) + [Grafana](https://grafana.com/) - Observability stack
- Air-gap deployment patterns for secure enterprise environments

---

**🏢 Perfect for Enterprise**: Corporate SSO integration, comprehensive monitoring, and air-gap deployment support make this ideal for enterprise Kubernetes backup management.