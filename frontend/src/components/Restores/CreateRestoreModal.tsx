import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api.ts';
import './CreateRestoreModal.css';

interface CreateRestoreModalProps {
  onClose: () => void;
}

const CreateRestoreModal: React.FC<CreateRestoreModalProps> = ({ onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    backupName: '',
    includedNamespaces: '',
    excludedNamespaces: '',
    namespaceMapping: '',
    restorePVs: true,
    includeClusterResources: true,
  });
  const [availableBackups, setAvailableBackups] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch available backups
    const fetchBackups = async () => {
      try {
        const response = await apiService.getBackups();
        const backupNames = response.backups?.map((b) => b.name) || [];
        setAvailableBackups(backupNames);
      } catch (err) {
        console.error('Failed to fetch backups:', err);
      }
    };

    fetchBackups();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const restoreConfig = {
        name: formData.name,
        backupName: formData.backupName,
        includedNamespaces: formData.includedNamespaces
          ? formData.includedNamespaces.split(',').map((s) => s.trim())
          : undefined,
        excludedNamespaces: formData.excludedNamespaces
          ? formData.excludedNamespaces.split(',').map((s) => s.trim())
          : undefined,
        namespaceMapping: formData.namespaceMapping
          ? JSON.parse(formData.namespaceMapping)
          : undefined,
        restorePVs: formData.restorePVs,
        includeClusterResources: formData.includeClusterResources,
      };

      await apiService.createRestore(restoreConfig);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create restore');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="create-restore-modal-overlay" onClick={handleOverlayClick}>
      <div className="create-restore-modal">
        <div className="create-restore-modal-header">
          <h3>Create New Restore</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="create-restore-modal-content">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="name">Restore Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="e.g., my-restore-20240820"
              />
            </div>

            <div className="form-group">
              <label htmlFor="backupName">Backup to Restore *</label>
              <select
                id="backupName"
                name="backupName"
                value={formData.backupName}
                onChange={handleInputChange}
                required
              >
                <option value="">Select a backup...</option>
                {availableBackups.map((backup) => (
                  <option key={backup} value={backup}>
                    {backup}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="includedNamespaces">Included Namespaces</label>
              <input
                type="text"
                id="includedNamespaces"
                name="includedNamespaces"
                value={formData.includedNamespaces}
                onChange={handleInputChange}
                placeholder="Comma-separated list (e.g., default,kube-system)"
              />
              <small>Leave empty to restore all namespaces from backup</small>
            </div>

            <div className="form-group">
              <label htmlFor="excludedNamespaces">Excluded Namespaces</label>
              <input
                type="text"
                id="excludedNamespaces"
                name="excludedNamespaces"
                value={formData.excludedNamespaces}
                onChange={handleInputChange}
                placeholder="Comma-separated list (e.g., kube-system,kube-public)"
              />
            </div>

            <div className="form-group">
              <label htmlFor="namespaceMapping">Namespace Mapping (JSON)</label>
              <textarea
                id="namespaceMapping"
                name="namespaceMapping"
                value={formData.namespaceMapping}
                onChange={handleInputChange}
                placeholder='{"old-namespace": "new-namespace"}'
                rows={3}
              />
              <small>JSON object to map namespaces during restore</small>
            </div>

            <div className="form-group-row">
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="restorePVs"
                  name="restorePVs"
                  checked={formData.restorePVs}
                  onChange={handleInputChange}
                />
                <label htmlFor="restorePVs">Restore Persistent Volumes</label>
              </div>

              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="includeClusterResources"
                  name="includeClusterResources"
                  checked={formData.includeClusterResources}
                  onChange={handleInputChange}
                />
                <label htmlFor="includeClusterResources">Include Cluster Resources</label>
              </div>
            </div>
          </div>

          <div className="create-restore-modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !formData.name || !formData.backupName}
            >
              {loading ? 'Creating...' : 'Create Restore'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRestoreModal;
