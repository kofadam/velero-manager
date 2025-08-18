import React, { useState, useEffect } from 'react';
import BackupTable from './BackupTable.tsx';
import CreateBackupModal from './CreateBackupModal.tsx';
import { useBackups } from '../../hooks/useBackups.ts';
import './BackupList.css';

const BackupList: React.FC = () => {
  const { backups, loading, error, refreshBackups, deleteBackup } = useBackups();
  const [selectedBackups, setSelectedBackups] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleSelectBackup = (backupName: string, selected: boolean) => {
    if (selected) {
      setSelectedBackups([...selectedBackups, backupName]);
    } else {
      setSelectedBackups(selectedBackups.filter(name => name !== backupName));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedBackups(backups.map(b => b.name));
    } else {
      setSelectedBackups([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (window.confirm(`Delete ${selectedBackups.length} selected backups?`)) {
      for (const backupName of selectedBackups) {
        try {
          await deleteBackup(backupName);
        } catch (err) {
          console.error(`Failed to delete backup ${backupName}:`, err);
        }
      }
      setSelectedBackups([]);
      refreshBackups();
    }
  };

  return (
    <div className="backup-list">
      <div className="backup-header">
        <div className="backup-actions">
          <button 
            className="btn btn-primary"
            onClick={refreshBackups}
            disabled={loading}
          >
            List Backups
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Create Backup
          </button>
          <button 
            className="btn btn-danger"
            onClick={handleDeleteSelected}
            disabled={selectedBackups.length === 0}
          >
            Delete Selected
          </button>
        </div>
      </div>

      {loading && <div className="loading">Loading backups...</div>}
      {error && <div className="error">Error: {error}</div>}
      
      {!loading && !error && (
        <BackupTable
          backups={backups}
          selectedBackups={selectedBackups}
          onSelectBackup={handleSelectBackup}
          onSelectAll={handleSelectAll}
          onDeleteBackup={deleteBackup}
          onRefresh={refreshBackups}
        />
      )}

      {showCreateModal && (
        <CreateBackupModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            refreshBackups();
          }}
        />
      )}
    </div>
  );
};

export default BackupList;
