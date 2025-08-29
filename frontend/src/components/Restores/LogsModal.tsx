import React, { useState, useEffect } from 'react';
import Modal from '../Common/Modal.tsx';
import { apiService } from '../../services/api.ts';
import LoadingSpinner from '../Common/LoadingSpinner.tsx';
import './LogsModal.css';

interface LogsModalProps {
  restoreName: string;
  onClose: () => void;
}

const LogsModal: React.FC<LogsModalProps> = ({ restoreName, onClose }) => {
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const response = await apiService.getRestoreLogs(restoreName);
        setLogs(response.logs || 'No logs available');
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [restoreName]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiService.getRestoreLogs(restoreName);
      setLogs(response.logs || 'No logs available');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Logs - ${restoreName}`} onClose={onClose} size="xlarge">
      <div className="logs-modal">
        <div className="logs-header">
          <div className="restore-info">
            <span className="restore-name">{restoreName}</span>
            <span className="backup-status">RESTORE</span>
          </div>
          <button onClick={fetchLogs} disabled={loading} className="refresh-btn">
            {loading ? 'Refreshing...' : 'Refresh'}
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
            <pre className="logs-text">{logs.replace(/\\n/g, '\n')}</pre>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default LogsModal;
