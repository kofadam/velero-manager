import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  CloudSync as CloudSyncIcon,
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Launch as LaunchIcon,
  History as HistoryIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { apiService } from '../../services/api.ts';
import { GitopsSyncStatus, ArgocdApplicationStatus } from '../../services/types.ts';

export default function GitOpsManager() {
  const [syncStatus, setSyncStatus] = useState<GitopsSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<ArgocdApplicationStatus | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const status = await apiService.getGitopsSyncStatus();
      setSyncStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load GitOps data');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncApplication = async (appName: string) => {
    setSyncing(appName);
    try {
      await apiService.syncGitopsApplication(appName);
      // Refresh data after sync
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to sync ${appName}`);
    } finally {
      setSyncing(null);
    }
  };

  const handleShowDetails = (app: ArgocdApplicationStatus) => {
    setSelectedApp(app);
    setDetailsOpen(true);
  };

  useEffect(() => {
    fetchData();
    // Refresh data every 15 seconds (GitOps data changes less frequently)
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={fetchData}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status.toLowerCase()) {
      case 'synced':
      case 'healthy':
        return 'success';
      case 'outofsync':
      case 'degraded':
      case 'warning':
        return 'warning';
      case 'failed':
      case 'error':
      case 'suspended':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'synced':
      case 'healthy':
        return <CheckCircleIcon />;
      case 'outofsync':
      case 'degraded':
      case 'warning':
        return <WarningIcon />;
      case 'failed':
      case 'error':
      case 'suspended':
        return <ErrorIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const overallHealthy = syncStatus && syncStatus.overall_status === 'healthy';

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          GitOps Management
        </Typography>
        <Button variant="outlined" startIcon={<SyncIcon />} onClick={fetchData} disabled={loading}>
          Refresh Status
        </Button>
      </Box>

      {/* Overall Status Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CloudSyncIcon color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Overall Status
                  </Typography>
                  <Box display="flex" alignItems="center">
                    {syncStatus && getStatusIcon(syncStatus.overall_status)}
                    <Chip
                      label={syncStatus?.overall_status || 'Unknown'}
                      color={getStatusColor(syncStatus?.overall_status || '')}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Applications
              </Typography>
              <Typography variant="h5">{syncStatus?.total_applications || 0}</Typography>
              <Typography color="textSecondary" variant="body2">
                Total managed apps
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Sync Status
              </Typography>
              <Typography variant="h5">
                {syncStatus?.synced || 0} / {syncStatus?.total_applications || 0}
              </Typography>
              <Typography color="textSecondary" variant="body2">
                Applications synced
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Health Status
              </Typography>
              <Typography variant="h5">
                {syncStatus?.healthy || 0} / {syncStatus?.total_applications || 0}
              </Typography>
              <Typography color="textSecondary" variant="body2">
                Healthy applications
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Sync Status Alert */}
      {syncStatus && !overallHealthy && (
        <Alert severity={syncStatus.out_of_sync > 0 ? 'warning' : 'info'} sx={{ mb: 3 }}>
          {syncStatus.out_of_sync > 0 && `${syncStatus.out_of_sync} applications are out of sync. `}
          {syncStatus.healthy < syncStatus.total_applications &&
            `${syncStatus.total_applications - syncStatus.healthy} applications are unhealthy.`}
          Review the applications below and sync if needed.
        </Alert>
      )}

      {/* Applications Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ArgoCD Applications
          </Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Application</TableCell>
                  <TableCell>Sync Status</TableCell>
                  <TableCell>Health Status</TableCell>
                  <TableCell>Last Sync</TableCell>
                  <TableCell>Revision</TableCell>
                  <TableCell>Path</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {syncStatus?.applications.map((app) => (
                  <TableRow key={app.app_name}>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <CodeIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2" fontWeight="medium">
                          {app.app_name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={app.sync_status}
                        color={getStatusColor(app.sync_status)}
                        size="small"
                        icon={getStatusIcon(app.sync_status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={app.health_status}
                        color={getStatusColor(app.health_status)}
                        size="small"
                        icon={getStatusIcon(app.health_status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {app.last_sync ? new Date(app.last_sync).toLocaleString() : 'Never'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {app.sync_revision || 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {app.sync_path || 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <Tooltip title="Sync application">
                          <IconButton
                            size="small"
                            onClick={() => handleSyncApplication(app.app_name)}
                            disabled={syncing === app.app_name}
                            color={app.sync_status === 'OutOfSync' ? 'warning' : 'default'}
                          >
                            {syncing === app.app_name ? (
                              <CircularProgress size={20} />
                            ) : (
                              <SyncIcon />
                            )}
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="View details">
                          <IconButton size="small" onClick={() => handleShowDetails(app)}>
                            <InfoIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Application Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <CodeIcon sx={{ mr: 2 }} />
            Application Details: {selectedApp?.app_name}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedApp && (
            <List>
              <ListItem>
                <ListItemIcon>
                  <InfoIcon />
                </ListItemIcon>
                <ListItemText primary="Application Name" secondary={selectedApp.app_name} />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <SyncIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Sync Status"
                  secondary={
                    <Chip
                      label={selectedApp.sync_status}
                      color={getStatusColor(selectedApp.sync_status)}
                      size="small"
                    />
                  }
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Health Status"
                  secondary={
                    <Chip
                      label={selectedApp.health_status}
                      color={getStatusColor(selectedApp.health_status)}
                      size="small"
                    />
                  }
                />
              </ListItem>

              {selectedApp.last_sync && (
                <ListItem>
                  <ListItemIcon>
                    <HistoryIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Last Sync"
                    secondary={new Date(selectedApp.last_sync).toLocaleString()}
                  />
                </ListItem>
              )}

              {selectedApp.sync_revision && (
                <ListItem>
                  <ListItemIcon>
                    <CodeIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Sync Revision"
                    secondary={
                      <Typography sx={{ fontFamily: 'monospace' }}>
                        {selectedApp.sync_revision}
                      </Typography>
                    }
                  />
                </ListItem>
              )}

              {selectedApp.sync_path && (
                <ListItem>
                  <ListItemIcon>
                    <LaunchIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Sync Path"
                    secondary={
                      <Typography sx={{ fontFamily: 'monospace' }}>
                        {selectedApp.sync_path}
                      </Typography>
                    }
                  />
                </ListItem>
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          {selectedApp && (
            <Button
              startIcon={<SyncIcon />}
              onClick={() => {
                handleSyncApplication(selectedApp.app_name);
                setDetailsOpen(false);
              }}
              disabled={syncing === selectedApp.app_name}
              variant="contained"
            >
              Sync Application
            </Button>
          )}
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
