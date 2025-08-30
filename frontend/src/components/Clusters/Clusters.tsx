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
  Chip
} from '@mui/material';
import { Refresh, Add } from '@mui/icons-material';

interface Cluster {
  name: string;
  backupCount: number;
  lastBackup: string;
}

const Clusters: React.FC = () => {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

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

  const getHealthStatus = (lastBackup: string, backupCount: number) => {
    if (!lastBackup) {
      // No backups yet, but cluster is configured
      return { label: 'Configured', color: 'success' as const };
    }
    
    const lastBackupDate = new Date(lastBackup);
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

  const filteredClusters = clusters.filter(cluster =>
    cluster.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          mb: 3,
          flexWrap: 'wrap'
        }}>
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
            <Button
              variant="contained"
              onClick={() => setShowAddModal(true)}
              startIcon={<Add />}
            >
              Add Cluster
            </Button>
          </Box>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
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
                  <TableCell>API Endpoint</TableCell>
                  <TableCell>Storage Location</TableCell>
                  <TableCell align="center">Total Backups</TableCell>
                  <TableCell>Last Backup</TableCell>
                  <TableCell align="center">Health Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredClusters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
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
                    const health = getHealthStatus(cluster.lastBackup, cluster.backupCount);
                    return (
                      <TableRow 
                        key={cluster.name}
                        hover
                        sx={{ 
                          '&:hover': { 
                            backgroundColor: 'action.hover',
                          } 
                        }}
                      >
                        <TableCell>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 600,
                              color: 'primary.main'
                            }}
                          >
                            {cluster.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography 
                            color="text.secondary" 
                            variant="body2"
                            sx={{ fontStyle: 'italic' }}
                          >
                            Not configured
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontFamily: 'monospace',
                              color: 'text.secondary',
                              fontSize: '0.875rem'
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
                              color: cluster.backupCount > 0 ? 'success.main' : 'text.secondary'
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
                              whiteSpace: 'nowrap'
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
                              letterSpacing: '0.5px'
                            }}
                          />
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
    </Box>
  );
};

export default Clusters;