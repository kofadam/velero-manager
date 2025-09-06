import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api.ts';
import AddClusterModal from './AddClusterModal.tsx';
import {
  Box,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Refresh, Add, Edit, Delete } from '@mui/icons-material';

interface Cluster {
  name: string;
  backupCount: number;
  lastBackup: string;
  ip?: string;
  apiEndpoint?: string;
  description?: string;
  status?: 'healthy' | 'warning' | 'critical' | 'error';
}

const Clusters: React.FC = () => {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCluster, setEditingCluster] = useState<string | null>(null);
  const [newDescription, setNewDescription] = useState('');
  const [clusterToDelete, setClusterToDelete] = useState<string | null>(null);

  const fetchClusters = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getClusters();
      setClusters(data.clusters || []);
    } catch (err) {
      setError('Failed to fetch clusters');
      console.error('Error fetching clusters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClusters();
  }, []);

  const getHealthStatus = (cluster: Cluster) => {
    // Check if cluster has connection details configured
    if (!cluster.ip && !cluster.apiEndpoint) {
      return { label: 'Not Configured', color: 'error' as const };
    }

    if (!cluster.lastBackup) {
      // Configured but no backups yet
      return { label: 'Configured', color: 'info' as const };
    }

    const lastBackupDate = new Date(cluster.lastBackup);
    const hoursSinceBackup = (Date.now() - lastBackupDate.getTime()) / (1000 * 60 * 60);

    if (hoursSinceBackup < 25) return { label: 'Healthy', color: 'success' as const };
    if (hoursSinceBackup < 48) return { label: 'Warning', color: 'warning' as const };
    return { label: 'Critical', color: 'error' as const };
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const filteredClusters = clusters.filter((cluster) =>
    cluster.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleDeleteCluster = async (clusterName: string) => {
    setClusterToDelete(clusterName);
  };

  const confirmDeleteCluster = async () => {
    if (!clusterToDelete) return;

    try {
      await apiService.deleteCluster(clusterToDelete);
      setClusters((prev) => prev.filter((cluster) => cluster.name !== clusterToDelete));
      setClusterToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete cluster:', err);
      let errorMessage = 'Failed to delete cluster';
      if (err.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      setError(errorMessage);
    }
  };

  const handleUpdateDescription = async () => {
    if (!editingCluster) return;

    try {
      // Use apiService which includes proper authentication headers
      await apiService.updateClusterDescription(editingCluster, newDescription);

      // Update local state on success
      setClusters((prev) =>
        prev.map((cluster) =>
          cluster.name === editingCluster ? { ...cluster, description: newDescription } : cluster
        )
      );

      setEditingCluster(null);
      setNewDescription('');
    } catch (err: any) {
      console.error('Failed to update cluster description:', err);
      let errorMessage = 'Failed to update cluster description';
      if (err.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      setError(errorMessage);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
            mb: 3,
            flexWrap: 'wrap',
          }}
        >
          <TextField
            placeholder="Search clusters by name..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            variant="outlined"
            size="small"
            sx={{ minWidth: 300 }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={fetchClusters}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button variant="contained" onClick={() => setShowAddModal(true)} startIcon={<Add />}>
              Add Cluster
            </Button>
          </Box>
        </Box>

        {loading && (
          <Box
            sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}
          >
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Loading clusters...</Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Error: {error}
          </Alert>
        )}

        {!loading && !error && (
          <TableContainer component={Paper} elevation={2}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Cluster Name</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Storage Location</TableCell>
                  <TableCell align="center">Total Backups</TableCell>
                  <TableCell>Last Backup</TableCell>
                  <TableCell align="center">Health Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredClusters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Box sx={{ py: 4 }}>
                        <Typography color="text.secondary" variant="h6">
                          No clusters found
                        </Typography>
                        <Typography color="text.secondary" variant="body2">
                          Add your first cluster to get started
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClusters.map((cluster) => {
                    const health = getHealthStatus(cluster);
                    return (
                      <TableRow
                        key={cluster.name}
                        hover
                        sx={{
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          },
                        }}
                      >
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: 'primary.main',
                            }}
                          >
                            {cluster.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              color:
                                cluster.ip || cluster.apiEndpoint
                                  ? 'text.primary'
                                  : 'text.secondary',
                              fontStyle: cluster.ip || cluster.apiEndpoint ? 'normal' : 'italic',
                            }}
                          >
                            {cluster.ip || cluster.apiEndpoint || 'Not configured'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              color: cluster.description ? 'text.primary' : 'text.secondary',
                              fontStyle: cluster.description ? 'normal' : 'italic',
                              maxWidth: '200px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={cluster.description}
                          >
                            {cluster.description || 'No description'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              color: 'text.secondary',
                              fontSize: '0.875rem',
                            }}
                          >
                            {`${cluster.name}-storage`}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: cluster.backupCount > 0 ? 'success.main' : 'text.secondary',
                            }}
                          >
                            {cluster.backupCount}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'text.secondary',
                              fontSize: '0.875rem',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatDate(cluster.lastBackup)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={health.label}
                            color={health.color}
                            size="small"
                            sx={{
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              fontSize: '0.75rem',
                              letterSpacing: '0.5px',
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Edit Cluster">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingCluster(cluster.name);
                                  setNewDescription(cluster.description || '');
                                }}
                                sx={{ color: 'primary.main' }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Cluster">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteCluster(cluster.name)}
                                sx={{ color: 'error.main' }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {showAddModal && (
        <AddClusterModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchClusters();
          }}
        />
      )}

      {/* Edit Description Dialog */}
      <Dialog
        open={!!editingCluster}
        onClose={() => {
          setEditingCluster(null);
          setNewDescription('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Cluster Description</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Cluster: <strong>{editingCluster}</strong>
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Description"
            multiline
            rows={3}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Enter a description for this cluster..."
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditingCluster(null);
              setNewDescription('');
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={handleUpdateDescription}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!clusterToDelete}
        onClose={() => setClusterToDelete(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Cluster</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete cluster <strong>{clusterToDelete}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This will remove the cluster configuration and stop scheduled backups. This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClusterToDelete(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteCluster}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Clusters;
