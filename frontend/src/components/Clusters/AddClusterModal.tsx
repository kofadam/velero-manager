import React, { useState } from 'react';
import './AddClusterModal.css';

interface AddClusterModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AddClusterModal: React.FC<AddClusterModalProps> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [clusterData, setClusterData] = useState({
    name: '',
    apiEndpoint: '',
    schedule: '0 2 * * *',
    storageLocation: 'default',
    ttl: '720h',
    token: '',
    caCert: '',
  });

  const generateCommands = () => {
    return `# Run these commands on the guest cluster:

kubectl create namespace velero --dry-run=client -o yaml | kubectl apply -f -
kubectl create serviceaccount velero-mgmt -n velero
kubectl create clusterrolebinding velero-mgmt-admin \\
  --clusterrole=cluster-admin \\
  --serviceaccount=velero:velero-mgmt

kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: velero-mgmt-token
  namespace: velero
  annotations:
    kubernetes.io/service-account.name: velero-mgmt
type: kubernetes.io/service-account-token
EOF

# Extract credentials:
echo "TOKEN:"
kubectl get secret velero-mgmt-token -n velero -o jsonpath='{.data.token}' | base64 -d
echo ""
echo "CA_CERT:"
kubectl get secret velero-mgmt-token -n velero -o jsonpath='{.data.ca\\.crt}'
echo ""
echo "API_SERVER:"
kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'`;
  };

  const handleSubmit = async () => {
    try {
      // Create secret and CronJob via API
      const response = await fetch('/api/v1/clusters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clusterData),
      });

      if (!response.ok) throw new Error('Failed to add cluster');

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding cluster:', error);
      alert('Failed to add cluster. Please check the logs.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Cluster</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {step === 1 && (
            <div className="step-content">
              <h3>Step 1: Cluster Information</h3>
              <div className="form-group">
                <label>Cluster Name</label>
                <input
                  type="text"
                  value={clusterData.name}
                  onChange={(e) => setClusterData({ ...clusterData, name: e.target.value })}
                  placeholder="e.g., production-cluster"
                />
              </div>
              <div className="form-group">
                <label>API Endpoint</label>
                <input
                  type="text"
                  value={clusterData.apiEndpoint}
                  onChange={(e) => setClusterData({ ...clusterData, apiEndpoint: e.target.value })}
                  placeholder="https://10.20.30.40:6443"
                />
              </div>
              <div className="form-group">
                <label>Backup Schedule (Cron)</label>
                <input
                  type="text"
                  value={clusterData.schedule}
                  onChange={(e) => setClusterData({ ...clusterData, schedule: e.target.value })}
                  placeholder="0 2 * * *"
                />
              </div>
              <div className="form-group">
                <label>Storage Location</label>
                <input
                  type="text"
                  value={clusterData.storageLocation}
                  onChange={(e) =>
                    setClusterData({ ...clusterData, storageLocation: e.target.value })
                  }
                  placeholder="default"
                />
              </div>
              <div className="form-group">
                <label>Backup TTL</label>
                <input
                  type="text"
                  value={clusterData.ttl}
                  onChange={(e) => setClusterData({ ...clusterData, ttl: e.target.value })}
                  placeholder="720h"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="step-content">
              <h3>Step 2: Run Commands on Guest Cluster</h3>
              <div className="commands-box">
                <pre>{generateCommands()}</pre>
                <button
                  className="copy-button"
                  onClick={() => navigator.clipboard.writeText(generateCommands())}
                >
                  Copy Commands
                </button>
              </div>
              <p className="info-text">
                Run these commands on the guest cluster, then paste the extracted credentials in the
                next step.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="step-content">
              <h3>Step 3: Enter Credentials</h3>
              <div className="form-group">
                <label>Service Account Token</label>
                <textarea
                  value={clusterData.token}
                  onChange={(e) => setClusterData({ ...clusterData, token: e.target.value })}
                  placeholder="Paste the extracted TOKEN here"
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label>CA Certificate (Base64)</label>
                <textarea
                  value={clusterData.caCert}
                  onChange={(e) => setClusterData({ ...clusterData, caCert: e.target.value })}
                  placeholder="Paste the extracted CA_CERT here (base64 encoded)"
                  rows={6}
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step > 1 && (
            <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
              Previous
            </button>
          )}
          {step < 3 ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && (!clusterData.name || !clusterData.apiEndpoint)}
            >
              Next
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!clusterData.token || !clusterData.caCert}
            >
              Add Cluster
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddClusterModal;
