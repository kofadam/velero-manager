import React, { useState, useEffect } from 'react';
import BackupTable from './BackupTable.tsx';
import CreateBackupModal from './CreateBackupModal.tsx';
import { useBackups } from '../../hooks/useBackups.ts';
import './BackupList.css';

const BackupList: React.FC = () => {
  const { backups, loading, error, refreshBackups, deleteBackup } = useBackups();
  const [selectedBackups, setSelectedBackups] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

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

  const filteredBackups = backups.filter(backup =>
    backup.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    backup.status.phase.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (backup.spec.includedNamespaces && backup.spec.includedNamespaces.some(ns => 
      ns.toLowerCase().includes(searchFilter.toLowerCase())
    ))
  );

  return (
    <div className="backup-list">
      <div className="backup-header">
        <div className="backup-search">
          <input
            type="text"
            placeholder="Search backups by name, status, or namespace..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="search-input"
          />
        </div>
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
          backups={filteredBackups}
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
