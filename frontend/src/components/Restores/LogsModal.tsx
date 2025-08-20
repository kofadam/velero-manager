import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api.ts';
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

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="logs-modal-overlay" onClick={handleOverlayClick}>
      <div className="logs-modal">
        <div className="logs-modal-header">
          <h3>Restore Logs: {restoreName}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="logs-modal-content">
          {loading ? (
            <div className="logs-loading">Loading logs...</div>
          ) : error ? (
            <div className="logs-error">Error: {error}</div>
          ) : (
            <pre className="logs-text">{logs}</pre>
          )}
        </div>
        
        <div className="logs-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogsModal;
