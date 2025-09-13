# Velero Manager - Multi-Cluster Orchestration

This directory contains configurations and scripts for deploying and managing Velero across multiple Kubernetes clusters with enhanced security and monitoring.

## 📁 Directory Structure

- **security/** - Security enhancements
  - `rbac/` - Minimal RBAC configurations replacing cluster-admin
  - `audit/` - Audit logging for backup operations
  - `monitoring/` - Prometheus rules and Grafana dashboards
- **high-availability/** - HA configurations for backup controllers

- **gitops/** - GitOps deployment configurations

  - `argocd/` - ArgoCD applications
  - `examples/` - Example GitOps workflows

- **scripts/** - Deployment and setup scripts

  - Setup scripts for MinIO, cluster connections, etc.

- **examples/** - Example configurations and CronJobs

## 🚀 Quick Start

### 1. Deploy Security Improvements

```bash
cd security/rbac
./deploy-minimal-rbac.sh <cluster-name> <context>
```

### 2. Setup HA Controller

```bash
kubectl apply -f high-availability/ha-backup-controller.yaml
```

### 3. Configure GitOps

```bash
kubectl apply -f gitops/argocd/bootstrap-app.yaml
```

## 🔒 Security Improvements

This implementation addresses the following security concerns:

- ✅ Replaces cluster-admin with minimal RBAC
- ✅ Implements automatic token rotation
- ✅ Adds comprehensive audit logging
- ✅ Provides HA backup orchestration
- ✅ Includes monitoring and alerting

## 🧪 Test Environment

Tested with:

- Management Cluster: microk8s
- Guest Cluster: minikube
- Storage: MinIO
- GitOps: ArgoCD
- Auth: Keycloak

## 📝 Related Documentation

- [Multi-Cluster Setup Guide](examples/multi-cluster-setup.md)
- [Security Best Practices](security/README.md)
- [GitOps Workflow](gitops/README.md)
- [Complete Deployment Guide](VELERO_DEPLOYMENT_GUIDE.md)
- [Quick Reference](QUICK_REFERENCE.md)
