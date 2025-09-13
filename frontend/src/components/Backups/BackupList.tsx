import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import BackupTable from './BackupTable.tsx';
import BackupDetailsModal from './BackupDetailsModal.tsx';
import { useBackups } from '../../hooks/useBackups.ts';
import { Backup } from '../../services/types.ts';

const BackupList: React.FC = () => {
  const { backups, loading, error, refreshBackups } = useBackups();
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [clusterFilter, setClusterFilter] = useState('all');

  const availableClusters = React.useMemo(() => {
    const clusters = Array.from(new Set(backups.map((backup) => backup.cluster).filter(Boolean)));
    return clusters.sort();
  }, [backups]);

  const handleViewDetails = (backup: Backup) => {
    setSelectedBackup(backup);
    setShowDetailsModal(true);
  };

  const filteredBackups = backups.filter((backup) => {
    const matchesSearch =
      backup.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      backup.status.phase.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (backup.spec.includedNamespaces &&
        backup.spec.includedNamespaces.some((ns) =>
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
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3, color: '#fff' }}>
        Backup Catalog
      </Typography>
      <Typography variant="body1" sx={{ mb: 3, color: 'rgba(255, 255, 255, 0.7)' }}>
        Browse and manage your backup inventory across all clusters. Use the search and filter tools
        to find specific backups.
      </Typography>
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
              {availableClusters.map((cluster) => (
                <MenuItem key={cluster} value={cluster}>
                  {cluster}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <IconButton onClick={refreshBackups} color="primary">
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      <Paper>
        <BackupTable backups={filteredBackups} onViewDetails={handleViewDetails} />
      </Paper>

      <BackupDetailsModal
        open={showDetailsModal}
        backup={selectedBackup}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedBackup(null);
        }}
      />
    </Box>
  );
};

export default BackupList;
