import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api.ts';
import './DescribeModal.css';

interface DescribeModalProps {
  restoreName: string;
  onClose: () => void;
}

const DescribeModal: React.FC<DescribeModalProps> = ({ restoreName, onClose }) => {
  const [description, setDescription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDescription = async () => {
      try {
        setLoading(true);
        const response = await apiService.describeRestore(restoreName);
        setDescription(response);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch restore details');
      } finally {
        setLoading(false);
      }
    };

    fetchDescription();
  }, [restoreName]);

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
          <h3>Restore Details: {restoreName}</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="describe-modal-content">
          {loading ? (
            <div className="describe-loading">Loading restore details...</div>
          ) : error ? (
            <div className="describe-error">Error: {error}</div>
          ) : (
            <div className="describe-details">
              {renderSection('Metadata', description?.metadata)}
              {renderSection('Spec', description?.spec)}
              {renderSection('Status', description?.status)}
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
