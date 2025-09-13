#!/bin/bash
# Complete deployment script for secure Velero backup system

set -euo pipefail

# Configuration
MANAGEMENT_CLUSTER="${MANAGEMENT_CLUSTER:-management-cluster}"
NAMESPACE="velero"
HARBOR_REGISTRY="${HARBOR_REGISTRY:-harbor.mydomain.local}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi

    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster."
        exit 1
    fi

    # Check if velero namespace exists
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        log_warn "Namespace $NAMESPACE doesn't exist. Creating..."
        kubectl create namespace $NAMESPACE
        kubectl label namespace $NAMESPACE \
            pod-security.kubernetes.io/enforce=privileged \
            pod-security.kubernetes.io/enforce-version=latest
    fi

    log_info "Prerequisites check completed."
}

# Deploy RBAC configuration
deploy_rbac() {
    log_info "Deploying RBAC configuration..."

    kubectl apply -f velero-remote-backup-rbac.yaml

    log_info "RBAC configuration deployed."
}

# Deploy token rotation system
deploy_token_rotation() {
    log_info "Deploying token rotation system..."

    kubectl apply -f token-rotation-cronjob.yaml

    # Label existing secrets for rotation
    kubectl get secrets -n $NAMESPACE -o name | grep -- -sa-token | while read secret; do
        kubectl label $secret type=cluster-token --overwrite
    done

    log_info "Token rotation system deployed."
}

# Deploy HA backup controller
deploy_ha_controller() {
    log_info "Deploying HA backup controller..."

    kubectl apply -f ha-backup-controller.yaml

    # Wait for deployment to be ready
    kubectl rollout status deployment/backup-controller -n $NAMESPACE --timeout=300s

    log_info "HA backup controller deployed."
}

# Deploy audit system
deploy_audit_system() {
    log_info "Deploying audit system..."

    kubectl apply -f backup-audit-system.yaml

    # Check if Elasticsearch is available
    if kubectl get service elasticsearch -n monitoring &> /dev/null; then
        log_info "Elasticsearch found. Audit logs will be shipped."
    else
        log_warn "Elasticsearch not found. Audit logs will only be available locally."
    fi

    log_info "Audit system deployed."
}

# Deploy monitoring and alerting
deploy_monitoring() {
    log_info "Deploying monitoring and alerting..."

    kubectl apply -f backup-monitoring-alerts.yaml

    # Check if Prometheus Operator is installed
    if kubectl get crd prometheusrules.monitoring.coreos.com &> /dev/null; then
        log_info "Prometheus Operator found. Alerts configured."
    else
        log_warn "Prometheus Operator not found. Alerts won't be active."
    fi

    log_info "Monitoring and alerting deployed."
}

# Add a guest cluster
add_guest_cluster() {
    local cluster_name=$1
    local cluster_context=$2

    log_info "Adding guest cluster: $cluster_name"

    # Deploy RBAC on guest cluster
    kubectl config use-context $cluster_context
    kubectl apply -f velero-remote-backup-rbac.yaml

    # Create token secret
    kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: velero-remote-trigger-token
  namespace: velero
  annotations:
    kubernetes.io/service-account.name: velero-remote-trigger
type: kubernetes.io/service-account-token
EOF

    sleep 5

    # Extract credentials
    TOKEN=$(kubectl get secret velero-remote-trigger-token -n velero -o jsonpath='{.data.token}' | base64 -d)
    CA_CERT=$(kubectl get secret velero-remote-trigger-token -n velero -o jsonpath='{.data.ca\.crt}')
    SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')

    # Switch to management cluster
    kubectl config use-context $MANAGEMENT_CLUSTER

    # Create secret on management cluster
    kubectl create secret generic "${cluster_name}-sa-token" \
        --from-literal=token="$TOKEN" \
        --from-literal=ca.crt="$CA_CERT" \
        --from-literal=server="$SERVER" \
        --from-literal=cluster-name="$cluster_name" \
        -n $NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -

    # Label the secret for token rotation
    kubectl label secret "${cluster_name}-sa-token" type=cluster-token -n $NAMESPACE

    log_info "Guest cluster $cluster_name added successfully."
}

# Validate deployment
validate_deployment() {
    log_info "Validating deployment..."

    local errors=0

    # Check backup controller
    if ! kubectl get deployment backup-controller -n $NAMESPACE &> /dev/null; then
        log_error "Backup controller not found"
        ((errors++))
    fi

    # Check token rotation cronjob
    if ! kubectl get cronjob token-rotation-controller -n $NAMESPACE &> /dev/null; then
        log_error "Token rotation cronjob not found"
        ((errors++))
    fi

    # Check service accounts
    if ! kubectl get serviceaccount backup-controller -n $NAMESPACE &> /dev/null; then
        log_error "Backup controller service account not found"
        ((errors++))
    fi

    # Check for cluster secrets
    secret_count=$(kubectl get secrets -n $NAMESPACE -l type=cluster-token --no-headers | wc -l)
    if [[ $secret_count -eq 0 ]]; then
        log_warn "No cluster secrets found. Add guest clusters to enable backups."
    else
        log_info "Found $secret_count cluster secret(s)"
    fi

    if [[ $errors -gt 0 ]]; then
        log_error "Validation failed with $errors error(s)"
        return 1
    else
        log_info "Validation completed successfully"
        return 0
    fi
}

# Main deployment function
main() {
    log_info "Starting Velero secure backup system deployment"

    # Parse arguments
    case "${1:-}" in
        add-cluster)
            if [[ $# -lt 3 ]]; then
                log_error "Usage: $0 add-cluster <cluster-name> <cluster-context>"
                exit 1
            fi
            add_guest_cluster "$2" "$3"
            ;;
        deploy-all)
            check_prerequisites
            deploy_rbac
            deploy_token_rotation
            deploy_ha_controller
            deploy_audit_system
            deploy_monitoring
            validate_deployment

            log_info "
🎉 Deployment Complete!

Next steps:
1. Add guest clusters: $0 add-cluster <name> <context>
2. Configure backup schedules in ConfigMap 'backup-schedules'
3. Access Grafana dashboard for monitoring
4. Review audit logs in Elasticsearch

Security improvements implemented:
✅ Minimal RBAC (no cluster-admin)
✅ Token rotation system
✅ High availability controller
✅ Comprehensive audit logging
✅ Monitoring and alerting
            "
            ;;
        validate)
            validate_deployment
            ;;
        *)
            echo "Usage: $0 {deploy-all|add-cluster|validate}"
            echo "  deploy-all              - Deploy complete secure backup system"
            echo "  add-cluster <name> <ctx> - Add a guest cluster"
            echo "  validate                - Validate deployment"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
