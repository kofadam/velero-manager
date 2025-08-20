import React, { useState } from 'react';
import { Restore } from '../../services/types.ts';
import LogsModal from './LogsModal.tsx';
import DescribeModal from './DescribeModal.tsx';

interface RestoreActionsProps {
  restore: Restore;
  onDelete: (name: string) => Promise<void>;
  onRefresh: () => void;
}

const RestoreActions: React.FC<RestoreActionsProps> = ({ 
  restore, 
  onDelete, 
  onRefresh 
}) => {
  const [showLogs, setShowLogs] = useState(false);
  const [showDescribe, setShowDescribe] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete restore "${restore.name}"?`)) {
      setIsDeleting(true);
      try {
        await onDelete(restore.name);
        onRefresh();
      } catch (error) {
        console.error('Failed to delete restore:', error);
        alert('Failed to delete restore. Please try again.');
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

  return (
    <div className="restore-actions">
      <button
        className="action-btn action-btn-info"
        onClick={handleLogs}
        title="View Logs"
      >
        📋 Logs
      </button>
      
      <button
        className="action-btn action-btn-secondary"
        onClick={handleDescribe}
        title="Describe"
      >
        📄 Describe
      </button>
      
      <button
        className="action-btn action-btn-danger"
        onClick={handleDelete}
        disabled={isDeleting}
        title="Delete Restore"
      >
        {isDeleting ? '⏳' : '🗑️'} Delete
      </button>

      {showLogs && (
        <LogsModal
          restoreName={restore.name}
          onClose={() => setShowLogs(false)}
        />
      )}

      {showDescribe && (
        <DescribeModal
          restoreName={restore.name}
          onClose={() => setShowDescribe(false)}
        />
      )}
    </div>
  );
};

export default RestoreActions;
