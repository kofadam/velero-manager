import React, { useState } from 'react';
import Modal from '../Common/Modal.tsx';
import { Backup } from '../../services/types.ts';
import './RestoreModal.css';

interface RestoreModalProps {
  backup: Backup;
  onClose: () => void;
  onRestore: (restoreConfig: any) => Promise<void>;
}

const RestoreModal: React.FC<RestoreModalProps> = ({ backup, onClose, onRestore }) => {
  const [formData, setFormData] = useState({
    restoreName: `restore-${backup.name}-${Date.now()}`,
    includedNamespaces: backup.spec.includedNamespaces?.join(', ') || '',
    excludedNamespaces: '',
    namespaceMapping: '',
    restorePVs: true,
    includeClusterResources: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const restoreConfig = {
        name: formData.restoreName,
        backupName: backup.name,
        includedNamespaces: formData.includedNamespaces.split(',').map(ns => ns.trim()).filter(ns => ns.length > 0),
        excludedNamespaces: formData.excludedNamespaces.split(',').map(ns => ns.trim()).filter(ns => ns.length > 0),
        namespaceMapping: formData.namespaceMapping ? Object.fromEntries(
          formData.namespaceMapping.split(',').map(mapping => {
            const [from, to] = mapping.split(':').map(s => s.trim());
            return [from, to];
          })
        ) : {},
        restorePVs: formData.restorePVs,
        includeClusterResources: formData.includeClusterResources
      };

      await onRestore(restoreConfig);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create restore');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`🔄 Restore from ${backup.name}`} onClose={onClose} size="large">
      <div className="restore-modal">
        <div className="restore-warning">
          <div className="warning-icon">⚠️</div>
          <div>
            <strong>Important:</strong> This will create a restore operation from backup "{backup.name}".
            Make sure you understand the implications before proceeding.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="restore-form">
          <div className="form-section">
            <h3>📋 Restore Configuration</h3>
            
            <div className="form-group">
              <label htmlFor="restore-name">Restore Name *</label>
              <input
                id="restore-name"
                type="text"
                value={formData.restoreName}
                onChange={(e) => handleChange('restoreName', e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-section">
            <h3>🎯 Scope</h3>
            
            <div className="form-group">
              <label htmlFor="included-namespaces">Included Namespaces</label>
              <input
                id="included-namespaces"
                type="text"
                value={formData.includedNamespaces}
                onChange={(e) => handleChange('includedNamespaces', e.target.value)}
                placeholder="default, app-namespace (leave empty for all)"
                disabled={loading}
              />
              <small>Comma-separated list of namespaces to restore</small>
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
              <label htmlFor="namespace-mapping">Namespace Mapping</label>
              <input
                id="namespace-mapping"
                type="text"
                value={formData.namespaceMapping}
                onChange={(e) => handleChange('namespaceMapping', e.target.value)}
                placeholder="old-ns:new-ns, app:app-restored"
                disabled={loading}
              />
              <small>Map old namespaces to new ones (format: old:new, old2:new2)</small>
            </div>
          </div>

          <div className="form-section">
            <h3>⚙️ Options</h3>
            
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.restorePVs}
                  onChange={(e) => handleChange('restorePVs', e.target.checked)}
                  disabled={loading}
                />
                <span>Restore Persistent Volumes</span>
              </label>
              <small>Restore PVs and PVCs from backup</small>
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.includeClusterResources}
                  onChange={(e) => handleChange('includeClusterResources', e.target.checked)}
                  disabled={loading}
                />
                <span>Include Cluster Resources</span>
              </label>
              <small>Restore cluster-scoped resources</small>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary restore-btn" disabled={loading}>
              {loading ? 'Creating Restore...' : '🔄 Start Restore'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default RestoreModal;
