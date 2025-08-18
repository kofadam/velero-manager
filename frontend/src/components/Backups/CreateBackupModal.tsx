import React, { useState } from 'react';
import { apiService } from '../../services/api.ts';
import Modal from '../Common/Modal.tsx';

interface CreateBackupModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateBackupModal: React.FC<CreateBackupModalProps> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    includedNamespaces: '',
    excludedNamespaces: '',
    storageLocation: 'default',
    ttl: '720h0m0s'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const namespaces = formData.includedNamespaces
        .split(',')
        .map(ns => ns.trim())
        .filter(ns => ns.length > 0);

      const excludedNamespaces = formData.excludedNamespaces
        .split(',')
        .map(ns => ns.trim())
        .filter(ns => ns.length > 0);

      await apiService.createBackup({
        name: formData.name,
        spec: {
          includedNamespaces: namespaces.length > 0 ? namespaces : undefined,
          excludedNamespaces: excludedNamespaces.length > 0 ? excludedNamespaces : undefined,
          storageLocation: formData.storageLocation,
          ttl: formData.ttl
        }
      });

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create backup');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Modal title="Create Backup" onClose={onClose}>
      <form onSubmit={handleSubmit} className="create-backup-form">
        <div className="form-group">
          <label htmlFor="backup-name">Backup Name *</label>
          <input
            id="backup-name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="my-backup"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="included-namespaces">Included Namespaces</label>
          <input
            id="included-namespaces"
            type="text"
            value={formData.includedNamespaces}
            onChange={(e) => handleChange('includedNamespaces', e.target.value)}
            placeholder="default, kube-system (or * for all)"
            disabled={loading}
          />
          <small>Comma-separated list of namespaces to include</small>
        </div>

        <div className="form-group">
          <label htmlFor="excluded-namespaces">Excluded Namespaces</label>
          <input
            id="excluded-namespaces"
            type="text"
            value={formData.excludedNamespaces}
            onChange={(e) => handleChange('excludedNamespaces', e.target.value)}
            placeholder="kube-system, velero"
            disabled={loading}
          />
          <small>Comma-separated list of namespaces to exclude</small>
        </div>

        <div className="form-group">
          <label htmlFor="storage-location">Storage Location</label>
          <input
            id="storage-location"
            type="text"
            value={formData.storageLocation}
            onChange={(e) => handleChange('storageLocation', e.target.value)}
            placeholder="default"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="ttl">TTL (Time to Live)</label>
          <input
            id="ttl"
            type="text"
            value={formData.ttl}
            onChange={(e) => handleChange('ttl', e.target.value)}
            placeholder="720h0m0s"
            disabled={loading}
          />
          <small>How long to keep the backup (e.g., 720h0m0s = 30 days)</small>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Backup'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateBackupModal;
