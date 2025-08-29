import React, { useState, useEffect } from 'react';
import Modal from '../Common/Modal.tsx';
import { Backup } from '../../services/types.ts';
import LoadingSpinner from '../Common/LoadingSpinner.tsx';
import './DescribeModal.css';

interface DescribeModalProps {
  backup: Backup;
  onClose: () => void;
}

const DescribeModal: React.FC<DescribeModalProps> = ({ backup, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (start?: string, end?: string) => {
    if (!start || !end) return 'N/A';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    return `${Math.round(duration / 1000)}s`;
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const renderSection = (title: string, data: any) => {
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return null;
    }

    return (
      <div className="describe-section">
        <h4>{title}</h4>
        <div className="describe-content">
          {typeof data === 'object' ? (
            Object.entries(data).map(([key, value]) => (
              <div key={key} className="describe-field">
                <span className="field-name">{key}:</span>
                <span className="field-value">{formatValue(value)}</span>
              </div>
            ))
          ) : (
            <div className="describe-field">
              <span className="field-value">{formatValue(data)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="describe-modal-overlay" onClick={handleOverlayClick}>
      <div className="describe-modal">
        <div className="describe-modal-header">
          <h3>Backup Details: {backup.name}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="describe-modal-content">
          {loading ? (
            <div className="describe-loading">Loading backup details...</div>
          ) : error ? (
            <div className="describe-error">Error: {error}</div>
          ) : (
            <div className="describe-details">
              {renderSection('Metadata', backup.metadata)}
              {renderSection('Spec', backup.spec)}
              {renderSection('Status', backup.status)}
            </div>
          )}
        </div>
        
        <div className="describe-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
        
  );
};

export default DescribeModal;
