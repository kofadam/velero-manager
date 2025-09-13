# GitOps Configuration for Velero Manager

## Overview

GitOps deployment using ArgoCD for declarative backup schedule management.

## Setup

1. **Install ArgoCD**

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

2. **Configure Repository**

```bash
argocd repo add https://github.com/kofadam/velero-manager
```

3. **Deploy Bootstrap Application**

```bash
kubectl apply -f argocd/bootstrap-app.yaml
```

## Benefits

- Version-controlled backup schedules
- Automated rollout and rollback
- Self-healing configurations
- Audit trail through Git history
