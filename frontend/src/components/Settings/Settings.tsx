import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api.ts';
import './Settings.css';

interface StorageLocation {
  name: string;
  namespace: string;
  spec: {
    provider: string;
    default?: boolean;
    objectStorage: {
      bucket: string;
      prefix?: string;
    };
    config?: Record<string, string>;
  };
  status?: {
    phase: string;
    lastSyncedTime?: string;
  };
}

const Settings: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    provider: 'aws',
    bucket: '',
    prefix: '',
    s3Url: '',
    region: 'minio',
    s3ForcePathStyle: 'true'
  });

  useEffect(() => {
    fetchStorageLocations();
  }, []);

  const fetchStorageLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getStorageLocations();
      setStorageLocations(response.locations || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch storage locations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const config: Record<string, string> = {
        region: formData.region,
        s3ForcePathStyle: formData.s3ForcePathStyle
      };
      
      if (formData.s3Url) {
        config.s3Url = formData.s3Url;
      }

      await apiService.createStorageLocation({
        name: formData.name,
        provider: formData.provider,
        bucket: formData.bucket,
        prefix: formData.prefix,
        config
      });
      
      setShowCreateModal(false);
      setFormData({
        name: '',
        provider: 'aws',
        bucket: '',
        prefix: '',
        s3Url: '',
        region: 'minio',
        s3ForcePathStyle: 'true'
      });
      fetchStorageLocations();
    } catch (err: any) {
      alert(`Failed to create storage location: ${err.message}`);
    }
  };

  const handleDeleteLocation = async (name: string) => {
    if (window.confirm(`Delete storage location "${name}"?`)) {
      try {
        await apiService.deleteStorageLocation(name);
        fetchStorageLocations();
      } catch (err: any) {
        alert(`Failed to delete: ${err.message}`);
      }
    }
  };
  return (
    <div className="settings">
      <div className="settings-header">
        <h1>⚙️ Settings</h1>
      </div>

      <div className="settings-section">
        <h2>📍 Backup Storage Locations</h2>
        <p>Manage backup storage locations for your Velero backups.</p>
        
        <div className="actions-bar">
          <button 
            className="btn btn-secondary"
            onClick={fetchStorageLocations}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            ➕ Create Storage Location
          </button>
        </div>

        {loading && <div className="loading">Loading storage locations...</div>}
        {error && <div className="error">Error: {error}</div>}
        
        {!loading && !error && (
          <div className="storage-locations-list">
            <table className="storage-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Provider</th>
                  <th>Bucket</th>
                  <th>Status</th>
                  <th>Default</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {storageLocations.map((location) => (
                  <tr key={location.name}>
                    <td>{location.name}</td>
                    <td>{location.spec.provider}</td>
                    <td>{location.spec.objectStorage.bucket}</td>
                    <td>
                      <span className={`status ${location.status?.phase === 'Available' ? 'status-available' : 'status-unavailable'}`}>
                        {location.status?.phase || 'Unknown'}
                      </span>
                    </td>
                    <td>{location.spec.default ? '✓' : '-'}</td>
                    <td>
                      {location.name !== 'default' && (
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteLocation(location.name)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Backup Location</h3>
              <button 
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateLocation}>
                <div className="form-group">
                  <label htmlFor="locationName">Location Name *</label>
                  <input
                    type="text"
                    id="locationName"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., dept3-storage"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="provider">Provider *</label>
                  <select 
                    id="provider" 
                    value={formData.provider}
                    onChange={(e) => setFormData({...formData, provider: e.target.value})}
                    required
                  >
                    <option value="aws">AWS S3 / MinIO</option>
                    <option value="gcp">Google Cloud Storage</option>
                    <option value="azure">Azure Blob Storage</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="bucket">Bucket Name *</label>
                  <input
                    type="text"
                    id="bucket"
                    value={formData.bucket}
                    onChange={(e) => setFormData({...formData, bucket: e.target.value})}
                    placeholder="e.g., dept3-backups"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="s3Url">S3 URL (for MinIO)</label>
                  <input
                    type="text"
                    id="s3Url"
                    value={formData.s3Url}
                    onChange={(e) => setFormData({...formData, s3Url: e.target.value})}
                    placeholder="http://10.100.102.110:9000"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="prefix">Prefix (optional)</label>
                  <input
                    type="text"
                    id="prefix"
                    value={formData.prefix}
                    onChange={(e) => setFormData({...formData, prefix: e.target.value})}
                    placeholder="e.g., velero/"
                  />
                </div>
                
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Location
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
