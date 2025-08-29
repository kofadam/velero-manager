import React, { useState } from 'react';
import './Settings.css';

const Settings: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  return (
    <div className="settings">
      <div className="settings-header">
        <h1>⚙️ Settings</h1>
      </div>

      <div className="settings-section">
        <h2>📍 Backup Locations</h2>
        <p>Manage backup storage locations for your Velero backups.</p>
        
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          ➕ Create Backup Location
        </button>
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
              <form>
                <div className="form-group">
                  <label htmlFor="locationName">Location Name *</label>
                  <input
                    type="text"
                    id="locationName"
                    placeholder="e.g., aws-s3-backup"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="provider">Provider *</label>
                  <select id="provider" required>
                    <option value="">Select a provider</option>
                    <option value="aws">AWS S3</option>
                    <option value="gcp">Google Cloud Storage</option>
                    <option value="azure">Azure Blob Storage</option>
                    <option value="minio">MinIO</option>
                  </select>
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
