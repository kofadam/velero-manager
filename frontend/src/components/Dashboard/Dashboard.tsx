import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import RefreshIcon from '@mui/icons-material/Refresh';
import BackupIcon from '@mui/icons-material/Backup';
import RestoreIcon from '@mui/icons-material/Restore';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { apiService } from '../../services/api.ts';
import { Cluster, ClusterHealth } from '../../services/types.ts';

interface DashboardStats {
  totalBackups: number;
  totalRestores: number;
  totalSchedules: number;
  failedBackups: number;
  failedRestores: number;
}

interface ClusterStats extends Cluster {
  health: ClusterHealth;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalBackups: 0,
    totalRestores: 0,
    totalSchedules: 0,
    failedBackups: 0,
    failedRestores: 0
  });
  const [clusters, setClusters] = useState<ClusterStats[]>([]);
  const [recentBackups, setRecentBackups] = useState<any[]>([]);
  const [recentRestores, setRecentRestores] = useState<any[]>([]);
  const [recentSchedules, setRecentSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [backupsRes, restoresRes, schedulesRes, clustersRes] = await Promise.all([
        apiService.getBackups(),
        apiService.getRestores(),
        apiService.getSchedules(),
        apiService.getClusters()
      ]);

      const backups = backupsRes.backups || [];
      const restores = restoresRes.restores || [];
      const schedules = schedulesRes.schedules || [];
      const clusterList = clustersRes.clusters || [];

      // Fetch health status for each cluster
      const clusterHealthPromises = clusterList.map(async (cluster: Cluster) => {
        try {
          const health = await apiService.getClusterHealth(cluster.name);
          return { ...cluster, health };
        } catch (err) {
          return { 
            ...cluster, 
            health: { 
              cluster: cluster.name, 
              status: 'error' as const, 
              backupCount: 0, 
              lastBackup: null 
            } 
          };
        }
      });

      const clustersWithHealth = await Promise.all(clusterHealthPromises);
      setClusters(clustersWithHealth);

      // Calculate stats
      const failedBackups = backups.filter((b: any) => 
        b.status?.phase === 'Failed' || b.status?.phase === 'FailedValidation'
      ).length;
      
      const failedRestores = restores.filter((r: any) => 
        r.status?.phase === 'Failed'
      ).length;

      setStats({
        totalBackups: backups.length,
        totalRestores: restores.length,
        totalSchedules: schedules.length,
        failedBackups,
        failedRestores
      });

      // Get recent items (last 3, sorted by creation time)
      const sortByDate = (items: any[]) => 
        items.sort((a, b) => new Date(b.creationTimestamp).getTime() - new Date(a.creationTimestamp).getTime());

      setRecentBackups(sortByDate([...backups]).slice(0, 5));
      setRecentRestores(sortByDate([...restores]).slice(0, 3));
      setRecentSchedules(sortByDate([...schedules]).slice(0, 3));

    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' + 
           new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusClass = (phase: string) => {
    switch (phase) {
      case 'Completed':
        return 'status-success';
      case 'Failed':
      case 'FailedValidation':
        return 'status-failed';
      case 'InProgress':
        return 'status-in-progress';
      default:
        return 'status-unknown';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="h5" color="error" gutterBottom>Error loading dashboard</Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>{error}</Typography>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={fetchDashboardData}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchDashboardData}
        >
          Refresh
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Backups
                  </Typography>
                  <Typography variant="h3" component="div">
                    {stats.totalBackups}
                  </Typography>
                  <Typography color={stats.failedBackups === 0 ? "success.main" : "error.main"} variant="body2">
                    {stats.failedBackups === 0 ? 'All successful' : `${stats.failedBackups} failed`}
                  </Typography>
                </Box>
                <BackupIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Restores
                  </Typography>
                  <Typography variant="h3" component="div">
                    {stats.totalRestores}
                  </Typography>
                  <Typography color={stats.failedRestores === 0 ? "success.main" : "error.main"} variant="body2">
                    {stats.failedRestores === 0 ? 'All successful' : `${stats.failedRestores} failed`}
                  </Typography>
                </Box>
                <RestoreIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Active Schedules
                  </Typography>
                  <Typography variant="h3" component="div">
                    {stats.totalSchedules}
                  </Typography>
                  <Typography color="info.main" variant="body2">
                    Automated
                  </Typography>
                </Box>
                <ScheduleIcon sx={{ fontSize: 40, color: 'info.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Success Rate
                  </Typography>
                  <Typography variant="h3" component="div">
                    {((stats.totalBackups - stats.failedBackups) / Math.max(stats.totalBackups, 1) * 100).toFixed(1)}%
                  </Typography>
                  <Typography color="success.main" variant="body2">
                    Excellent
                  </Typography>
                </Box>
                <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Cluster Overview */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" component="h2">
            Managed Clusters
          </Typography>
          <Chip 
            label={`${clusters.length} active cluster${clusters.length !== 1 ? 's' : ''}`} 
            color="primary" 
            variant="outlined" 
            size="small"
          />
        </Box>
        {clusters.length > 0 ? (
          <Grid container spacing={2}>
            {clusters.map((cluster) => (
              <Grid item xs={12} md={6} lg={4} key={cluster.name}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Typography variant="h6" component="h3">
                        {cluster.name}
                      </Typography>
                      <Chip
                        label={cluster.health.status}
                        color={cluster.health.status === 'healthy' ? 'success' : 'error'}
                        size="small"
                      />
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="h4" component="div">
                          {cluster.health.backupCount || 0}
                        </Typography>
                        <Typography color="textSecondary" variant="body2">
                          Total Backups
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body1" component="div">
                          {cluster.health.lastBackup ? 'Recent' : 'Never'}
                        </Typography>
                        <Typography color="textSecondary" variant="body2">
                          Last Activity
                        </Typography>
                      </Grid>
                    </Grid>
                    {cluster.health.lastBackup && (
                      <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                        Last backup: {formatDate(cluster.health.lastBackup)}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box textAlign="center" py={4}>
            <Typography variant="body1" color="textSecondary">
              No clusters configured
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <BackupIcon color="primary" />
              <Typography variant="h6" component="h3">
                Recent Backups
              </Typography>
            </Box>
            {recentBackups.length > 0 ? (
              <Box>
                {recentBackups.slice(0, 5).map((backup) => (
                  <Box key={backup.name} display="flex" justifyContent="space-between" alignItems="center" py={1}>
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {backup.name}
                      </Typography>
                      <Box display="flex" gap={1} alignItems="center">
                        <Chip label={backup.cluster} size="small" variant="outlined" />
                        <Typography variant="caption" color="textSecondary">
                          {formatDate(backup.creationTimestamp)}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label={backup.status?.phase || 'Unknown'}
                      color={backup.status?.phase === 'Completed' ? 'success' : 
                             backup.status?.phase === 'Failed' ? 'error' : 'default'}
                      size="small"
                    />
                  </Box>
                ))}
              </Box>
            ) : (
              <Box textAlign="center" py={4}>
                <Typography variant="body2" color="textSecondary">
                  No recent backups
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <RestoreIcon color="secondary" />
              <Typography variant="h6" component="h3">
                Recent Restores
              </Typography>
            </Box>
            {recentRestores.length > 0 ? (
              <Box>
                {recentRestores.map((restore) => (
                  <Box key={restore.name} display="flex" justifyContent="space-between" alignItems="center" py={1}>
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {restore.name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {formatDate(restore.creationTimestamp)}
                      </Typography>
                    </Box>
                    <Chip
                      label={restore.status?.phase || 'Unknown'}
                      color={restore.status?.phase === 'Completed' ? 'success' : 
                             restore.status?.phase === 'Failed' ? 'error' : 'default'}
                      size="small"
                    />
                  </Box>
                ))}
              </Box>
            ) : (
              <Box textAlign="center" py={4}>
                <Typography variant="body2" color="textSecondary">
                  No recent restores
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
