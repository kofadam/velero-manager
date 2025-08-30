import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import BackupTable from './BackupTable.tsx';
import CreateBackupModal from './CreateBackupModal.tsx';
import { useBackups } from '../../hooks/useBackups.ts';

const BackupList: React.FC = () => {
  const { backups, loading, error, refreshBackups, deleteBackup } = useBackups();
  const [selectedBackups, setSelectedBackups] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [clusterFilter, setClusterFilter] = useState('all');
  
  const availableClusters = React.useMemo(() => {
    const clusters = Array.from(new Set(backups.map(backup => backup.cluster).filter(Boolean)));
    return clusters.sort();
  }, [backups]);

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

  const filteredBackups = backups.filter(backup => {
    const matchesSearch = backup.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      backup.status.phase.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (backup.spec.includedNamespaces && backup.spec.includedNamespaces.some(ns => 
        ns.toLowerCase().includes(searchFilter.toLowerCase())
      ));
    
    const matchesCluster = clusterFilter === 'all' || backup.cluster === clusterFilter;
    
    return matchesSearch && matchesCluster;
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Search backups..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Cluster</InputLabel>
            <Select
              value={clusterFilter}
              label="Cluster"
              onChange={(e) => setClusterFilter(e.target.value)}
            >
              <MenuItem value="all">All Clusters</MenuItem>
              {availableClusters.map(cluster => (
                <MenuItem key={cluster} value={cluster}>{cluster}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowCreateModal(true)}
            >
              Create Backup
            </Button>
            <IconButton onClick={refreshBackups} color="primary">
              <RefreshIcon />
            </IconButton>
            {selectedBackups.length > 0 && (
              <IconButton onClick={handleDeleteSelected} color="error">
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
        </Box>
      </Paper>

      <Paper>
        <BackupTable
          backups={filteredBackups}
          selectedBackups={selectedBackups}
          onSelectBackup={handleSelectBackup}
          onSelectAll={handleSelectAll}
          onDeleteBackup={deleteBackup}
          onRefresh={refreshBackups}
        />
      </Paper>

      {showCreateModal && (
        <CreateBackupModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            refreshBackups();
          }}
        />
      )}
    </Box>
  );
};

export default BackupList;