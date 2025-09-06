import React, { useState } from 'react';
import RestoreTable from './RestoreTable.tsx';
import CreateRestoreModal from './CreateRestoreModal.tsx';
import RestoreDetailsModal from './RestoreDetailsModal.tsx';
import { useRestores } from '../../hooks/useRestores.ts';
import { Restore } from '../../services/types.ts';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Typography,
} from '@mui/material';
import { Refresh, Add, Delete } from '@mui/icons-material';

const RestoreList: React.FC = () => {
  const { restores, loading, error, refreshRestores, deleteRestore } = useRestores();
  const [selectedRestores, setSelectedRestores] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRestore, setSelectedRestore] = useState<Restore | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [clusterFilter, setClusterFilter] = useState('all');

  // Get unique clusters from restores
  const availableClusters = React.useMemo(() => {
    const clusters = Array.from(
      new Set(restores.map((restore) => restore.cluster).filter(Boolean))
    );
    return clusters.sort();
  }, [restores]);

  const handleSelectRestore = (restoreName: string, selected: boolean) => {
    if (selected) {
      setSelectedRestores([...selectedRestores, restoreName]);
    } else {
      setSelectedRestores(selectedRestores.filter((name) => name !== restoreName));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedRestores(restores.map((r) => r.name));
    } else {
      setSelectedRestores([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (window.confirm(`Delete ${selectedRestores.length} selected restores?`)) {
      for (const restoreName of selectedRestores) {
        try {
          await deleteRestore(restoreName);
        } catch (error) {
          console.error(`Failed to delete restore ${restoreName}:`, error);
        }
      }
      setSelectedRestores([]);
    }
  };

  const handleCreateRestore = () => {
    setShowCreateModal(true);
  };

  const handleModalClose = () => {
    setShowCreateModal(false);
    refreshRestores();
  };

  const handleViewDetails = (restore: Restore) => {
    setSelectedRestore(restore);
    setShowDetailsModal(true);
  };

  const filteredRestores = restores.filter((restore) => {
    // Search filter
    const matchesSearch =
      restore.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      restore.status.phase.toLowerCase().includes(searchFilter.toLowerCase()) ||
      restore.spec.backupName.toLowerCase().includes(searchFilter.toLowerCase());

    // Cluster filter
    const matchesCluster = clusterFilter === 'all' || restore.cluster === clusterFilter;

    return matchesSearch && matchesCluster;
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading restores...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Error: {error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'center' },
            gap: 2,
            mb: 3,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              flex: 1,
              flexDirection: { xs: 'column', sm: 'row' },
            }}
          >
            <TextField
              placeholder="Search restores by name, status, or backup..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              variant="outlined"
              size="small"
              sx={{ minWidth: 300 }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Cluster</InputLabel>
              <Select
                value={clusterFilter}
                onChange={(e) => setClusterFilter(e.target.value)}
                label="Cluster"
              >
                <MenuItem value="all">All Clusters</MenuItem>
                {availableClusters.map((cluster) => (
                  <MenuItem key={cluster} value={cluster}>
                    {cluster}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Button
              variant="outlined"
              onClick={refreshRestores}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button variant="contained" onClick={handleCreateRestore} startIcon={<Add />}>
              Create Restore
            </Button>
            {selectedRestores.length > 0 && (
              <Button
                variant="contained"
                color="error"
                onClick={handleDeleteSelected}
                startIcon={<Delete />}
              >
                Delete Selected ({selectedRestores.length})
              </Button>
            )}
          </Box>
        </Box>

        <RestoreTable
          restores={filteredRestores}
          selectedRestores={selectedRestores}
          onSelectRestore={handleSelectRestore}
          onSelectAll={handleSelectAll}
          onDeleteRestore={deleteRestore}
          onRefresh={refreshRestores}
          onViewDetails={handleViewDetails}
        />

        {showCreateModal && <CreateRestoreModal onClose={handleModalClose} />}

        <RestoreDetailsModal
          open={showDetailsModal}
          restore={selectedRestore}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedRestore(null);
          }}
        />
      </Paper>
    </Box>
  );
};

export default RestoreList;
