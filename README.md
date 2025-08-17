# Velero Manager

A modern, clean web UI for managing Velero backups, schedules, and restores in Kubernetes clusters.

## Features

- 📦 **Backup Management** - Create, view, and delete backups
- ⏰ **Schedule Management** - Manage automated backup schedules  
- 🔄 **Restore Operations** - Easy restore with configuration options
- 📊 **Real-time Status** - Live updates on backup/restore progress
- 🎨 **Modern UI** - GitHub-style clean interface with Tailwind CSS

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Go with Kubernetes client-go
- **Deployment**: Single container for air-gap environments

## Quick Start

### Development Mode
```bash
# Start backend
cd backend
go mod tidy
go run main.go

# Start frontend (in another terminal)
cd frontend
npm install
npm run dev
```

### Production Build
```bash
# Build frontend
cd frontend
npm run build

# Build backend with embedded frontend
cd backend
go build -o velero-manager main.go

# Run
./velero-manager
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build manually
docker build -t velero-manager:latest .
docker run -p 8080:8080 -v ~/.kube/config:/root/.kube/config velero-manager:latest
```

## Development

### Prerequisites
- Go 1.21+
- Node.js 18+
- Kubernetes cluster with Velero installed
- kubectl configured with cluster access

### Backend Development
```bash
cd backend
go mod tidy
go run main.go
```
Backend runs on http://localhost:8080

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on http://localhost:3000 with API proxy to backend

### Testing
```bash
# Test backend
cd backend
go test ./...

# Test frontend
cd frontend
npm test

# Integration tests
make test
```

## Air-Gap Deployment

This application is designed for air-gapped Kubernetes environments:

- **No external dependencies** during runtime
- **Embedded frontend assets** in Go binary
- **Local authentication** (no external OAuth)
- **Direct Kubernetes API** communication only

### Kubernetes Deployment
```yaml
# Apply RBAC and deployment
kubectl apply -f k8s/

# Access via port-forward
kubectl port-forward deployment/velero-manager 8080:8080
```

## Configuration

### Environment Variables
```bash
# Kubernetes config (defaults to ~/.kube/config)
KUBECONFIG=/path/to/kubeconfig

# Server port (default: 8080)
PORT=8080

# Velero namespace (default: velero)
VELERO_NAMESPACE=velero

# Log level (default: info)
LOG_LEVEL=debug
```

### Build Configuration
```bash
# Build with custom tags
go build -tags production -o velero-manager main.go

# Build for different architectures
GOOS=linux GOARCH=amd64 go build -o velero-manager-linux main.go
```

## API Endpoints

### Backups
- `GET /api/v1/backups` - List all backups
- `POST /api/v1/backups` - Create new backup
- `GET /api/v1/backups/:name` - Get backup details
- `DELETE /api/v1/backups/:name` - Delete backup

### Schedules
- `GET /api/v1/schedules` - List all schedules
- `POST /api/v1/schedules` - Create new schedule
- `DELETE /api/v1/schedules/:name` - Delete schedule

### Restores
- `GET /api/v1/restores` - List all restores
- `POST /api/v1/restores` - Create new restore

### System
- `GET /api/v1/health` - Health check

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## Troubleshooting

### Common Issues

**Backend won't start:**
```bash
# Check Kubernetes connection
kubectl cluster-info

# Verify Velero installation
kubectl get pods -n velero
```

**Frontend build fails:**
```bash
# Clear node_modules and reinstall
rm -rf frontend/node_modules
cd frontend && npm install
```

**Permission errors:**
```bash
# Check RBAC permissions
kubectl auth can-i get backups.velero.io
kubectl auth can-i create backups.velero.io
```

### Debug Mode
```bash
# Run with debug logging
LOG_LEVEL=debug go run main.go

# Enable Kubernetes client debug
KUBERNETES_DEBUG=true go run main.go
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Velero](https://velero.io/) - The amazing backup tool this UI manages
- [Kubernetes](https://kubernetes.io/) - The platform we're running on
- Inspired by modern GitHub UI patterns