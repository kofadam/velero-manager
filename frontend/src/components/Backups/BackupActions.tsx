import React, { useState } from 'react';
import { Backup } from '../../services/types.ts';
import { apiService } from '../../services/api.ts';
import DescribeModal from './DescribeModal.tsx';
import RestoreModal from './RestoreModal.tsx';
import { Box, IconButton, Tooltip } from '@mui/material';
import { Description, Delete, Restore } from '@mui/icons-material';

interface BackupActionsProps {
  backup: Backup;
  onDelete: (backupName: string) => Promise<void>;
  onRefresh: () => void;
}

const BackupActions: React.FC<BackupActionsProps> = ({ backup, onDelete, onRefresh }) => {
  const [isDeleting, setIsDeleting] = useState(false);
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

  const handleDescribe = () => {
    setShowDescribe(true);
  };

  const handleRestore = () => {
    setShowRestore(true);
  };

  const handleRestoreSubmit = async (restoreConfig: any) => {
    try {
      await apiService.createRestore(restoreConfig);
      alert(
        `✅ Restore "${restoreConfig.name}" created successfully!\n\n🔄 Velero is now restoring from backup "${backup.name}"\n\nCheck the Velero logs to monitor progress.`
      );
      onRefresh(); // Refresh the backup list
    } catch (error: any) {
      console.error('Restore failed:', error);
      const errorMessage = error.response?.data?.details || error.message || 'Unknown error';
      alert(`❌ Failed to create restore:\n\n${errorMessage}`);
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="Describe Backup">
          <IconButton size="small" onClick={handleDescribe} sx={{ color: 'info.main' }}>
            <Description fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Restore Backup">
          <IconButton size="small" onClick={handleRestore} sx={{ color: 'success.main' }}>
            <Restore fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Delete Backup">
          <IconButton
            size="small"
            onClick={handleDelete}
            disabled={isDeleting}
            sx={{ color: 'error.main' }}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {showDescribe && <DescribeModal backup={backup} onClose={() => setShowDescribe(false)} />}
      {showRestore && (
        <RestoreModal
          backup={backup}
          onClose={() => setShowRestore(false)}
          onRestore={handleRestoreSubmit}
        />
      )}
    </>
  );
};

export default BackupActions;
