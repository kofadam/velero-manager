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

  if (loading) {
    return (
      <Modal title={`Describe - ${backup.name}`} onClose={onClose} size="large">
        <div className="describe-loading">
          <LoadingSpinner />
          <span>Loading backup details...</span>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Describe - ${backup.name}`} onClose={onClose} size="large">
      <div className="describe-modal">
        <div className="describe-section">
          <h3>📋 General Information</h3>
          <div className="describe-grid">
            <div className="describe-item">
              <label>Name:</label>
              <span>{backup.name}</span>
            </div>
            <div className="describe-item">
              <label>Namespace:</label>
              <span>{backup.namespace}</span>
            </div>
            <div className="describe-item">
              <label>Status:</label>
              <span className={`status-badge ${backup.status.phase.toLowerCase()}`}>
                {backup.status.phase}
              </span>
            </div>
            <div className="describe-item">
              <label>Storage Location:</label>
              <span>{backup.spec.storageLocation || 'default'}</span>
            </div>
          </div>
        </div>

        <div className="describe-section">
          <h3>⏰ Timing</h3>
          <div className="describe-grid">
            <div className="describe-item">
              <label>Created:</label>
              <span>{formatTimestamp(backup.creationTimestamp)}</span>
            </div>
            <div className="describe-item">
              <label>Started:</label>
              <span>{formatTimestamp(backup.status.startTimestamp)}</span>
            </div>
            <div className="describe-item">
              <label>Completed:</label>
              <span>{formatTimestamp(backup.status.completionTimestamp)}</span>
            </div>
            <div className="describe-item">
              <label>Duration:</label>
              <span>{formatDuration(backup.status.startTimestamp, backup.status.completionTimestamp)}</span>
            </div>
            <div className="describe-item">
              <label>Expires:</label>
              <span>{formatTimestamp(backup.status.expiration)}</span>
            </div>
          </div>
        </div>

        <div className="describe-section">
          <h3>📊 Statistics</h3>
          <div className="describe-grid">
            <div className="describe-item">
              <label>Total Items:</label>
              <span>{backup.status.progress?.totalItems || 0}</span>
            </div>
            <div className="describe-item">
              <label>Items Backed Up:</label>
              <span>{backup.status.progress?.itemsBackedUp || 0}</span>
            </div>
            <div className="describe-item">
              <label>Errors:</label>
              <span className={backup.status.errors ? 'text-error' : ''}>{backup.status.errors || 0}</span>
            </div>
            <div className="describe-item">
              <label>Warnings:</label>
              <span className={backup.status.warnings ? 'text-warning' : ''}>{backup.status.warnings || 0}</span>
            </div>
          </div>
        </div>

        <div className="describe-section">
          <h3>🎯 Scope</h3>
          <div className="describe-grid">
            <div className="describe-item">
              <label>Included Namespaces:</label>
              <span>{backup.spec.includedNamespaces?.join(', ') || 'All namespaces'}</span>
            </div>
            <div className="describe-item">
              <label>Excluded Namespaces:</label>
              <span>{backup.spec.excludedNamespaces?.join(', ') || 'None'}</span>
            </div>
            <div className="describe-item">
              <label>TTL:</label>
              <span>{backup.spec.ttl || '720h0m0s'}</span>
            </div>
          </div>
        </div>

        {backup.labels && Object.keys(backup.labels).length > 0 && (
          <div className="describe-section">
            <h3>🏷️ Labels</h3>
            <div className="labels-grid">
              {Object.entries(backup.labels).map(([key, value]) => (
                <div key={key} className="label-item">
                  <code>{key}={value}</code>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default DescribeModal;
