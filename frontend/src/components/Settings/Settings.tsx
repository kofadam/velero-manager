import React from 'react';
import './Settings.css';

const Settings: React.FC = () => {
  return (
    <div className="settings">
      <div className="settings-header">
        <h1>⚙️ Settings</h1>
      </div>

      <div className="settings-section">
        <h2>📍 Backup Locations</h2>
        <p>Manage backup storage locations for your Velero backups.</p>
        
        <button className="btn btn-primary">
          ➕ Create Backup Location
        </button>
      </div>
    </div>
  );
};

export default Settings;
