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
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock logs for now
      const mockLogs = `
time="2025-08-19T12:00:00Z" level=info msg="Starting backup" backup=${backup.name}
time="2025-08-19T12:00:01Z" level=info msg="Backing up resource" resource=pods namespace=${backup.spec.includedNamespaces?.[0] || 'default'}
time="2025-08-19T12:00:02Z" level=info msg="Backing up resource" resource=services namespace=${backup.spec.includedNamespaces?.[0] || 'default'}
time="2025-08-19T12:00:03Z" level=info msg="Backing up resource" resource=deployments namespace=${backup.spec.includedNamespaces?.[0] || 'default'}
time="2025-08-19T12:00:05Z" level=info msg="Backup completed successfully" backup=${backup.name}
time="2025-08-19T12:00:05Z" level=info msg="Backup uploaded to storage" location=${backup.spec.storageLocation}
      `.trim();
      
      setLogs(mockLogs);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Logs - ${backup.name}`} onClose={onClose} size="large">
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
          
          {!loading && !error && (
            <pre className="logs-text">{logs}</pre>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default LogsModal;
