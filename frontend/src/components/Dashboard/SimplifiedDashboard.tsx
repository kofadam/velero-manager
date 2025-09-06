import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Button,
  IconButton,
  Tooltip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import BackupIcon from '@mui/icons-material/Backup';
import RestoreIcon from '@mui/icons-material/Restore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import FilterListIcon from '@mui/icons-material/FilterList';
import { apiService } from '../../services/api.ts';
import { Backup } from '../../services/types.ts';
import BackupDetailsModal from '../Backups/BackupDetailsModal.tsx';
import { formatDate } from '../../utils/dateUtils.ts';

interface DashboardMetrics {
  totalBackups: number;
  totalRestores: number;
  totalSchedules: number;
  failedBackups: number;
  successfulBackups: number;
  last24hBackups: Backup[];
}

const SimplifiedDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalBackups: 0,
    totalRestores: 0,
    totalSchedules: 0,
    failedBackups: 0,
    successfulBackups: 0,
    last24hBackups: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [clusterFilter, setClusterFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setError(null);
    if (metrics.totalBackups === 0) {
      setLoading(true);
    }

    try {
      // Fetch all data in parallel
      const [backupsRes, restoresRes, schedulesRes] = await Promise.all([
        apiService.getBackups(),
        apiService.getRestores(),
        apiService.getSchedules(),
      ]);

      const backups = backupsRes.backups || [];
      const restores = restoresRes.restores || [];
      const schedules = schedulesRes.schedules || schedulesRes.cronjobs || [];

      // Get backups from last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const last24hBackups = backups
        .filter((backup: Backup) => new Date(backup.creationTimestamp) > twentyFourHoursAgo)
        .sort(
          (a: Backup, b: Backup) =>
            new Date(b.creationTimestamp).getTime() - new Date(a.creationTimestamp).getTime()
        );

      // Calculate metrics
      const failedBackups = backups.filter(
        (b: Backup) => b.status?.phase === 'Failed' || b.status?.phase === 'FailedValidation'
      ).length;

      const successfulBackups = backups.filter(
        (b: Backup) => b.status?.phase === 'Completed'
      ).length;

      setMetrics({
        totalBackups: backups.length,
        totalRestores: restores.length,
        totalSchedules: schedules.length,
        failedBackups,
        successfulBackups,
        last24hBackups,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, [metrics.totalBackups]);

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const getStatusIcon = (phase: string) => {
    switch (phase) {
      case 'Completed':
        return <CheckCircleIcon color="success" fontSize="small" />;
      case 'Failed':
      case 'FailedValidation':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'InProgress':
        return <InfoIcon color="info" fontSize="small" />;
      default:
        return <WarningIcon color="warning" fontSize="small" />;
    }
  };

  const getStatusColor = (phase: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
    switch (phase) {
      case 'Completed':
        return 'success';
      case 'Failed':
      case 'FailedValidation':
        return 'error';
      case 'InProgress':
        return 'info';
      default:
        return 'warning';
    }
  };

  const handleViewDetails = (backup: Backup) => {
    setSelectedBackup(backup);
    setShowDetailsModal(true);
  };

  const handleDownload = async (backup: Backup) => {
    try {
      const result = await apiService.downloadBackup(backup.cluster, backup.name);
      if (result.success) {
        // Download will start automatically, just show success message
        alert(
          `Download started for backup "${backup.name}". The file will be saved to your downloads folder.`
        );
      }
    } catch (error: any) {
      console.error('Failed to download backup:', error);
      const errorMessage = error.message || 'Failed to download backup file.';
      alert(`Download failed: ${errorMessage}`);
    }
  };

  // Filter backups based on current filters
  const filteredBackups = metrics.last24hBackups.filter((backup: Backup) => {
    const matchesPhase = phaseFilter === 'all' || backup.status?.phase === phaseFilter;
    const matchesCluster = clusterFilter === 'all' || backup.cluster === clusterFilter;
    const matchesSearch =
      searchFilter === '' ||
      backup.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      backup.cluster.toLowerCase().includes(searchFilter.toLowerCase());

    return matchesPhase && matchesCluster && matchesSearch;
  });

  // Get unique clusters for filter
  const availableClusters = Array.from(
    new Set(metrics.last24hBackups.map((backup: Backup) => backup.cluster))
  ).sort();

  // Get unique phases for filter
  const availablePhases = Array.from(
    new Set(metrics.last24hBackups.map((backup: Backup) => backup.status?.phase).filter(Boolean))
  ).sort();

  if (loading && metrics.totalBackups === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading dashboard...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={4}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6">Error loading dashboard</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
        <Button variant="contained" startIcon={<RefreshIcon />} onClick={fetchDashboardData}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Simplified Header */}
      <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #2196f3 0%, #21cbf3 100%)' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold', mb: 1 }}>
              Velero Manager Dashboard
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
              Quick overview of your backup operations
            </Typography>
          </Box>
          <Tooltip title="Refresh data">
            <IconButton
              onClick={fetchDashboardData}
              disabled={loading}
              sx={{
                color: 'white',
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
              }}
            >
              <RefreshIcon sx={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Critical Alerts */}
      {metrics.failedBackups > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6">Attention Required</Typography>
          <Typography>
            {metrics.failedBackups} backup{metrics.failedBackups > 1 ? 's have' : ' has'} failed.
            Review the details below.
          </Typography>
        </Alert>
      )}

      {/* Key Metrics Cards - Simplified */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <BackupIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {metrics.totalBackups}
                  </Typography>
                  <Typography color="textSecondary" variant="caption">
                    Total Backups
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <RestoreIcon sx={{ fontSize: 32, color: 'secondary.main' }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {metrics.totalRestores}
                  </Typography>
                  <Typography color="textSecondary" variant="caption">
                    Total Restores
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <CheckCircleIcon sx={{ fontSize: 32, color: 'success.main' }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {metrics.successfulBackups}
                  </Typography>
                  <Typography color="textSecondary" variant="caption">
                    Successful
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <ErrorIcon sx={{ fontSize: 32, color: 'error.main' }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="error.main">
                    {metrics.failedBackups}
                  </Typography>
                  <Typography color="textSecondary" variant="caption">
                    Failed
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Backup Table - Front and Center */}
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" fontWeight="bold">
            Latest Backups (Last 24 Hours)
          </Typography>
          <Chip
            icon={<FilterListIcon />}
            label={`${filteredBackups.length} of ${metrics.last24hBackups.length} backups`}
            color="primary"
            variant="outlined"
          />
        </Box>

        {/* Filters */}
        <Box display="flex" gap={2} mb={3} flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Search backups..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={phaseFilter}
              label="Status"
              onChange={(e) => setPhaseFilter(e.target.value)}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              {availablePhases.map((phase) => (
                <MenuItem key={phase} value={phase}>
                  {phase}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
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
        </Box>

        {/* Backup Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Backup Name</TableCell>
                <TableCell>Cluster</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Namespaces</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBackups.length > 0 ? (
                filteredBackups.map((backup: Backup) => (
                  <TableRow
                    key={backup.name}
                    hover
                    onClick={() => handleViewDetails(backup)}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'action.hover' },
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
                        {backup.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={backup.cluster || 'Unknown'}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(backup.status?.phase || 'Unknown')}
                        label={backup.status?.phase || 'Unknown'}
                        color={getStatusColor(backup.status?.phase || 'Unknown')}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {formatDate(backup.creationTimestamp)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {backup.spec.includedNamespaces && backup.spec.includedNamespaces.length > 0
                          ? `${backup.spec.includedNamespaces.length} namespace${
                              backup.spec.includedNamespaces.length > 1 ? 's' : ''
                            }`
                          : 'All namespaces'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="textSecondary">
                      {metrics.last24hBackups.length === 0
                        ? 'No backups in the last 24 hours'
                        : 'No backups match your current filters'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Backup Details Modal */}
      <BackupDetailsModal
        open={showDetailsModal}
        backup={selectedBackup}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedBackup(null);
        }}
        onDownload={handleDownload}
      />
    </Box>
  );
};

export default SimplifiedDashboard;
