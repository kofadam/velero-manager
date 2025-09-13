import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  Button,
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
} from '@mui/material';
import {
  CloudSync as CloudSyncIcon,
  Security as SecurityIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { apiService } from '../../services/api.ts';
import {
  OrchestrationStatus,
  TokenRotationStatus,
  GitopsSyncStatus,
} from '../../services/types.ts';

export default function OrchestrationDashboard() {
  const [orchestrationStatus, setOrchestrationStatus] = useState<OrchestrationStatus | null>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenRotationStatus | null>(null);
  const [gitopsStatus, setGitopsStatus] = useState<GitopsSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [orchestration, tokens, gitops] = await Promise.allSettled([
        apiService.getOrchestrationStatus(),
        apiService.getTokenRotationStatus(),
        apiService.getGitopsSyncStatus(),
      ]);

      if (orchestration.status === 'fulfilled') {
        setOrchestrationStatus(orchestration.value);
      } else {
        console.error('Failed to load orchestration status:', orchestration.reason);
      }

      if (tokens.status === 'fulfilled') {
        setTokenStatus(tokens.value);
      } else {
        console.error('Failed to load token status:', tokens.reason);
      }

      if (gitops.status === 'fulfilled') {
        setGitopsStatus(gitops.value);
      } else {
        console.error('Failed to load GitOps status:', gitops.reason);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orchestration data');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSchedule = async (scheduleName: string) => {
    setTriggering(scheduleName);
    try {
      await apiService.triggerBackupSchedule(scheduleName);
      // Refresh data after triggering
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger backup schedule');
    } finally {
      setTriggering(null);
    }
  };

  const handleTokenRotation = async () => {
    setTriggering('token-rotation');
    try {
      await apiService.triggerTokenRotation();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger token rotation');
    } finally {
      setTriggering(null);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
        return 'success';
      case 'degraded':
      case 'warning':
        return 'warning';
      case 'failed':
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
        return <CheckCircleIcon />;
      case 'degraded':
      case 'warning':
        return <WarningIcon />;
      case 'failed':
      case 'error':
        return <ErrorIcon />;
      default:
        return <InfoIcon />;
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Multi-Cluster Orchestration
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchData}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Overview Cards */}
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
                    {orchestrationStatus && getStatusIcon(orchestrationStatus.overall_status)}
                    <Chip
                      label={orchestrationStatus?.overall_status || 'Unknown'}
                      color={getStatusColor(orchestrationStatus?.overall_status || '')}
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
                Clusters
              </Typography>
              <Typography variant="h5">
                {orchestrationStatus?.healthy_clusters || 0} /{' '}
                {orchestrationStatus?.total_clusters || 0}
              </Typography>
              <Typography color="textSecondary" variant="body2">
                Healthy clusters
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Schedules
              </Typography>
              <Typography variant="h5">{orchestrationStatus?.active_schedules || 0}</Typography>
              <Typography color="textSecondary" variant="body2">
                Backup schedules running
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Recent Backups
              </Typography>
              <Typography variant="h5">{orchestrationStatus?.recent_backups || 0}</Typography>
              <Typography color="textSecondary" variant="body2">
                Last 24 hours
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* GitOps Status */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
                <Typography variant="h6" gutterBottom>
                  GitOps Status
                </Typography>
                <Chip
                  label={gitopsStatus?.overall_status || 'Unknown'}
                  color={getStatusColor(gitopsStatus?.overall_status || '')}
                  size="small"
                />
              </Box>

              {gitopsStatus && (
                <>
                  <Box mb={2}>
                    <Typography variant="body2" color="textSecondary">
                      Applications Synced
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(gitopsStatus.synced / gitopsStatus.total_applications) * 100}
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="caption">
                      {gitopsStatus.synced} / {gitopsStatus.total_applications}
                    </Typography>
                  </Box>

                  <Box mb={2}>
                    <Typography variant="body2" color="textSecondary">
                      Health Status
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(gitopsStatus.healthy / gitopsStatus.total_applications) * 100}
                      color="success"
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="caption">{gitopsStatus.healthy} healthy</Typography>
                  </Box>

                  {gitopsStatus.applications.map((app) => (
                    <Box
                      key={app.app_name}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      py={1}
                    >
                      <Box>
                        <Typography variant="body2">{app.app_name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {app.sync_path}
                        </Typography>
                      </Box>
                      <Box display="flex" gap={1}>
                        <Chip
                          label={app.sync_status}
                          color={getStatusColor(app.sync_status)}
                          size="small"
                        />
                        <Chip
                          label={app.health_status}
                          color={getStatusColor(app.health_status)}
                          size="small"
                        />
                      </Box>
                    </Box>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Token Rotation Status */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" gutterBottom>
                  Token Rotation
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SecurityIcon />}
                  onClick={handleTokenRotation}
                  disabled={triggering === 'token-rotation'}
                >
                  {triggering === 'token-rotation' ? 'Rotating...' : 'Rotate Now'}
                </Button>
              </Box>

              {tokenStatus ? (
                <>
                  <Box mb={2}>
                    <Chip
                      label={tokenStatus.enabled ? 'Enabled' : 'Disabled'}
                      color={tokenStatus.enabled ? 'success' : 'error'}
                      size="small"
                    />
                    <Chip
                      label={tokenStatus.rotation_status}
                      color={getStatusColor(tokenStatus.rotation_status)}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </Box>

                  <Typography variant="body2" color="textSecondary">
                    Clusters: {tokenStatus.clusters_rotated}
                  </Typography>

                  {tokenStatus.last_rotation && (
                    <Typography variant="body2" color="textSecondary">
                      Last: {new Date(tokenStatus.last_rotation).toLocaleDateString()}
                    </Typography>
                  )}

                  {tokenStatus.next_rotation && (
                    <Typography variant="body2" color="textSecondary">
                      Next: {new Date(tokenStatus.next_rotation).toLocaleDateString()}
                    </Typography>
                  )}

                  {tokenStatus.failed_rotations && tokenStatus.failed_rotations.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      Failed rotations: {tokenStatus.failed_rotations.join(', ')}
                    </Alert>
                  )}
                </>
              ) : (
                <Typography color="textSecondary">Token rotation not configured</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Cluster Status */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cluster Health
              </Typography>

              {orchestrationStatus?.clusters.map((cluster) => (
                <Box key={cluster.name} py={1}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2">{cluster.name}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        Token: {cluster.token_status}
                      </Typography>
                    </Box>
                    <Box display="flex" gap={1}>
                      <Chip
                        label={cluster.status}
                        color={getStatusColor(cluster.status)}
                        size="small"
                      />
                      <Typography variant="caption">{cluster.backup_count_24h} backups</Typography>
                    </Box>
                  </Box>
                  {cluster.error_count_24h > 0 && (
                    <Typography variant="caption" color="error">
                      {cluster.error_count_24h} errors in 24h
                    </Typography>
                  )}
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Backup Schedules Table */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Backup Schedules
          </Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Schedule Name</TableCell>
                  <TableCell>Cluster</TableCell>
                  <TableCell>Frequency</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Run</TableCell>
                  <TableCell>Next Run</TableCell>
                  <TableCell>Success Rate</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orchestrationStatus?.schedules.map((schedule) => (
                  <TableRow key={schedule.name}>
                    <TableCell>{schedule.name}</TableCell>
                    <TableCell>{schedule.cluster_name}</TableCell>
                    <TableCell>{schedule.schedule}</TableCell>
                    <TableCell>
                      <Chip
                        label={schedule.status}
                        color={getStatusColor(schedule.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {schedule.last_execution
                        ? new Date(schedule.last_execution).toLocaleString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {schedule.next_execution
                        ? new Date(schedule.next_execution).toLocaleString()
                        : 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {schedule.success_count + schedule.failure_count > 0
                        ? `${Math.round(
                            (schedule.success_count /
                              (schedule.success_count + schedule.failure_count)) *
                              100
                          )}%`
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Trigger backup now">
                        <IconButton
                          size="small"
                          onClick={() => handleTriggerSchedule(schedule.name)}
                          disabled={triggering === schedule.name}
                        >
                          {triggering === schedule.name ? (
                            <CircularProgress size={20} />
                          ) : (
                            <PlayArrowIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
