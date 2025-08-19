import React, { useState } from 'react';
import { Backup } from '../../services/types.ts';
import { apiService } from '../../services/api.ts';
import LogsModal from './LogsModal.tsx';
import DescribeModal from './DescribeModal.tsx';
import RestoreModal from './RestoreModal.tsx';

interface BackupActionsProps {
  backup: Backup;
  onDelete: (backupName: string) => Promise<void>;
  onRefresh: () => void;
}

const BackupActions: React.FC<BackupActionsProps> = ({ backup, onDelete, onRefresh }) => {
const [isDeleting, setIsDeleting] = useState(false);
const [showLogs, setShowLogs] = useState(false);
const [showDescribe, setShowDescribe] = useState(false);
const [showRestore, setShowRestore] = useState(false);

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete backup "${backup.name}"?`)) {
      setIsDeleting(true);
      try {
        await onDelete(backup.name);
        onRefresh();
      } catch (error) {
        console.error('Failed to delete backup:', error);
        alert('Failed to delete backup. Please try again.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleLogs = () => {
    setShowLogs(true);
  };

  const handleDescribe = () => {
    setShowDescribe(true);
  };

  const handleRestore = () => {
    setShowRestore(true);
  };

  const handleRestoreSubmit = async (restoreConfig: any) => {
    try {
      const result = await apiService.createRestore(restoreConfig);
      alert(`✅ Restore "${restoreConfig.name}" created successfully!\n\n🔄 Velero is now restoring from backup "${backup.name}"\n\nCheck the Velero logs to monitor progress.`);
      onRefresh(); // Refresh the backup list
    } catch (error: any) {
      console.error('Restore failed:', error);
      const errorMessage = error.response?.data?.details || error.message || 'Unknown error';
      alert(`❌ Failed to create restore:\n\n${errorMessage}`);
    }
  };

  return (
    <div className="backup-actions">
      <button 
        className="action-btn logs-btn"
        onClick={handleLogs}
        title="View Logs"
      >
        Logs
      </button>
      <button 
        className="action-btn describe-btn"
        onClick={handleDescribe}
        title="Describe Backup"
      >
        Describe
      </button>
      <button 
        className="action-btn delete-btn"
        onClick={handleDelete}
        disabled={isDeleting}
        title="Delete Backup"
      >
        {isDeleting ? '...' : 'Delete'}
      </button>
      <button 
        className="action-btn restore-btn"
        onClick={handleRestore}
        title="Restore Backup"
      >
        Restore
      </button>
            
      {showLogs && (
        <LogsModal
          backup={backup}
          onClose={() => setShowLogs(false)}
        />
      )}
      {showDescribe && (
        <DescribeModal
          backup={backup}
          onClose={() => setShowDescribe(false)}
        />
      )}
      {showRestore && (
        <RestoreModal
          backup={backup}
          onClose={() => setShowRestore(false)}
          onRestore={handleRestoreSubmit}
        />
      )}
    </div>
  );
};

export default BackupActions;
