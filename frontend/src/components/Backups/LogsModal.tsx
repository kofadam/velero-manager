import React, { useState, useEffect } from 'react';
import Modal from '../Common/Modal.tsx';
import { Backup } from '../../services/types.ts';
import LoadingSpinner from '../Common/LoadingSpinner.tsx';
import './LogsModal.css';

interface LogsModalProps {
  backup: Backup;
  onClose: () => void;
}

const LogsModal: React.FC<LogsModalProps> = ({ backup, onClose }) => {
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [backup.name]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      // Simulate fetching logs - in real implementation, this would call the backend
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Backup logs explanation
      const mockLogs = `Backup logs for '${
        backup.name
      }' are not directly accessible through the API.

To view detailed backup logs, use the Velero CLI:
velero backup logs ${backup.name}

Or check the Velero pod logs:
kubectl logs -n velero deployment/velero

Current backup status: ${backup.status.phase}
Started: ${backup.status.startTimestamp || 'N/A'}
Completed: ${backup.status.completionTimestamp || 'N/A'}
Format Version: ${backup.status.formatVersion || 'N/A'}

Created: ${backup.creationTimestamp}
Storage Location: ${backup.spec.storageLocation}`;

      setLogs(mockLogs);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Logs - ${backup.name}`} onClose={onClose} size="xlarge">
      <div className="logs-modal">
        <div className="logs-header">
          <div className="backup-info">
            <span className="backup-name">{backup.name}</span>
            <span className="backup-status">{backup.status.phase}</span>
          </div>
          <button onClick={fetchLogs} disabled={loading} className="refresh-btn">
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>

        <div className="logs-content">
          {loading && (
            <div className="logs-loading">
              <LoadingSpinner />
              <span>Loading logs...</span>
            </div>
          )}

          {error && (
            <div className="logs-error">
              <span>❌ Error: {error}</span>
              <button onClick={fetchLogs}>Try Again</button>
            </div>
          )}

          {!loading && !error && <pre className="logs-text">{logs}</pre>}
        </div>
      </div>
    </Modal>
  );
};

export default LogsModal;
