import React, { useState } from 'react';
import { Backup } from '../../services/types.ts';

interface BackupActionsProps {
  backup: Backup;
  onDelete: (backupName: string) => Promise<void>;
  onRefresh: () => void;
}

const BackupActions: React.FC<BackupActionsProps> = ({ backup, onDelete, onRefresh }) => {
  const [isDeleting, setIsDeleting] = useState(false);

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
    // TODO: Implement logs modal
    alert(`Logs for ${backup.name} - Coming soon!`);
  };

  const handleDescribe = () => {
    // TODO: Implement describe modal
    alert(`Describe ${backup.name} - Coming soon!`);
  };

  const handleRestore = () => {
    // TODO: Implement restore modal
    alert(`Restore from ${backup.name} - Coming soon!`);
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
    </div>
  );
};

export default BackupActions;
