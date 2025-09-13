#!/bin/bash
# Connect minikube to microk8s management cluster

set -euo pipefail

echo "🔗 Connecting clusters..."

# Step 1: Extract minikube credentials
echo "📤 Extracting minikube credentials..."
kubectl config use-context minikube

TOKEN=$(kubectl get secret velero-remote-trigger-token -n velero -o jsonpath='{.data.token}' | base64 -d)
CA_CERT=$(kubectl get secret velero-remote-trigger-token -n velero -o jsonpath='{.data.ca\.crt}')
MINIKUBE_IP=$(minikube ip)
MINIKUBE_PORT="8443"  # Default Kubernetes API port for minikube

# Step 2: Create secret on management cluster
echo "📥 Creating secret on management cluster..."
kubectl config use-context microk8s

cat > minikube-cluster-secret.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: minikube-sa-token
  namespace: velero
  labels:
    type: cluster-token
    cluster: minikube
    environment: test
type: Opaque
data:
  token: $(echo -n "$TOKEN" | base64 -w0)
  ca.crt: $CA_CERT
stringData:
  server: "https://${MINIKUBE_IP}:${MINIKUBE_PORT}"
  cluster-name: "minikube"
EOF

kubectl apply -f minikube-cluster-secret.yaml

echo "✅ Secret created on management cluster"

# Step 3: Create test backup CronJob
cat > test-backup-cronjob.yaml << 'EOF'
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-minikube-test
  namespace: velero
spec:
  schedule: "*/10 * * * *"  # Every 10 minutes for testing
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: default
          containers:
          - name: backup-trigger
            image: bitnami/kubectl:latest
            command:
            - /bin/bash
            - -c
            - |
              set -euo pipefail
              echo "🎯 Triggering backup on minikube..."

              # Load credentials
              TOKEN=$(cat /secrets/token)
              CA_CERT=$(cat /secrets/ca.crt | base64 -d)
              SERVER=$(cat /secrets/server)

              # Setup kubeconfig
              cat > /tmp/kubeconfig <<KUBECONFIG
              apiVersion: v1
              kind: Config
              clusters:
              - cluster:
                  certificate-authority-data: $(cat /secrets/ca.crt)
                  server: $SERVER
                name: minikube
              contexts:
              - context:
                  cluster: minikube
                  user: velero-sa
                name: minikube
              current-context: minikube
              users:
              - name: velero-sa
                user:
                  token: $TOKEN
              KUBECONFIG

              export KUBECONFIG=/tmp/kubeconfig

              # Test connection
              echo "Testing connection to minikube..."
              kubectl get ns || exit 1

              echo "✅ Connection successful!"

              # Create a test backup using kubectl
              BACKUP_NAME="test-$(date +%Y%m%d-%H%M%S)"

              kubectl create -n velero -f - <<BACKUP
              apiVersion: velero.io/v1
              kind: Backup
              metadata:
                name: $BACKUP_NAME
                namespace: velero
              spec:
                includedNamespaces:
                - default
                storageLocation: default
                ttl: 24h0m0s
              BACKUP

              echo "✅ Backup $BACKUP_NAME created!"
            volumeMounts:
            - name: cluster-secrets
              mountPath: /secrets
              readOnly: true
          volumes:
          - name: cluster-secrets
            secret:
              secretName: minikube-sa-token
          restartPolicy: OnFailure
EOF

echo "📝 Created test backup CronJob"
echo ""
echo "To deploy the test CronJob:"
echo "kubectl apply -f test-backup-cronjob.yaml"
echo ""
echo "To trigger immediately:"
echo "kubectl create job --from=cronjob/backup-minikube-test test-backup-manual -n velero"
echo ""
echo "To check logs:"
echo "kubectl logs -n velero -l job-name=test-backup-manual"
