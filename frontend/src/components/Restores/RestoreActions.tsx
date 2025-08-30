import React, { useState } from 'react';
import { Restore } from '../../services/types.ts';
import LogsModal from './LogsModal.tsx';
import DescribeModal from './DescribeModal.tsx';
import { Box, IconButton, Tooltip } from '@mui/material';
import { Article, Description, Delete } from '@mui/icons-material';

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
    <>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="View Logs">
          <IconButton 
            size="small"
            onClick={handleLogs}
            sx={{ color: 'info.main' }}
          >
            <Article fontSize="small" />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Describe Restore">
          <IconButton 
            size="small"
            onClick={handleDescribe}
            sx={{ color: 'info.main' }}
          >
            <Description fontSize="small" />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Delete Restore">
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
    </>
  );
};

export default RestoreActions;
