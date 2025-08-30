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

interface DashboardMetrics {
  clusters: {
    total: number;
    healthy: number;
    critical: number;
    details: { [key: string]: ClusterHealthDetails };
  };
  backups: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  restores: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  schedules: {
    total: number;
  };
  recentActivity: {
    backups: RecentActivity[];
    restores: RecentActivity[];
  };
  updatedAt: string;
}

interface ClusterHealthDetails {
  cluster: string;
  status: 'healthy' | 'warning' | 'critical' | 'no-backups';
  backups: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    lastSuccessful?: string;
    lastFailed?: string;
    last?: string;
  };
  restores: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  recentActivity: RecentActivity[];
  updatedAt: string;
}

interface RecentActivity {
  name: string;
  status: string;
  time: string;
  cluster: string;
  backupName?: string;
}

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
  const [dashboardData, setDashboardData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Keep legacy state for backwards compatibility
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

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh dashboard every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to use new enhanced dashboard metrics endpoint
      const data = await apiService.getDashboardMetrics();
      setDashboardData(data);
      
      // Update legacy stats for backwards compatibility
      setStats({
        totalBackups: data.backups.total,
        totalRestores: data.restores.total,
        totalSchedules: data.schedules.total,
        failedBackups: data.backups.failed,
        failedRestores: data.restores.failed
      });
      
      // Set recent activity
      setRecentBackups(data.recentActivity.backups?.slice(0, 5) || []);
      setRecentRestores(data.recentActivity.restores?.slice(0, 3) || []);
      
      // Convert cluster details to legacy format
      const legacyClusters = Object.entries(data.clusters.details).map(([name, details]: [string, any]) => ({
        name,
        health: {
          cluster: name,
          status: details.status,
          backupCount: details.backups.total,
          lastBackup: details.backups.last
        }
      }));
      setClusters(legacyClusters);
      
    } catch (err: any) {
      // Fallback to original method if new endpoint fails
      console.warn('Enhanced dashboard endpoint failed, falling back to legacy method:', err.message);
      await fetchLegacyDashboardData();
    } finally {
      setLoading(false);
    }
  };
  
  const fetchLegacyDashboardData = async () => {
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
        <Box>
          <Typography variant="h4" component="h1">
            Dashboard
          </Typography>
          {dashboardData && (
            <Typography variant="caption" color="textSecondary">
              Last updated: {new Date(dashboardData.updatedAt).toLocaleTimeString()} (auto-refreshes every 30s)
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchDashboardData}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
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
          <Box display="flex" gap={1}>
            {dashboardData && (
              <>
                <Chip 
                  label={`${dashboardData.clusters.healthy} healthy`}
                  color="success"
                  variant="outlined"
                  size="small"
                />
                {dashboardData.clusters.critical > 0 && (
                  <Chip 
                    label={`${dashboardData.clusters.critical} critical`}
                    color="error"
                    variant="outlined"
                    size="small"
                  />
                )}
              </>
            )}
            <Chip 
              label={`${clusters.length} total`}
              color="primary" 
              variant="outlined" 
              size="small"
            />
          </Box>
        </Box>
        {clusters.length > 0 ? (
          <Grid container spacing={2}>
            {Object.entries(dashboardData?.clusters.details || {}).map(([clusterName, details]: [string, any]) => (
              <Grid item xs={12} md={6} lg={4} key={clusterName}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Typography variant="h6" component="h3">
                        {clusterName}
                      </Typography>
                      <Chip
                        label={details.status}
                        color={
                          details.status === 'healthy' ? 'success' : 
                          details.status === 'warning' ? 'warning' :
                          details.status === 'critical' ? 'error' : 'default'
                        }
                        size="small"
                      />
                    </Box>
                    <Grid container spacing={2} mb={2}>
                      <Grid item xs={6}>
                        <Typography variant="h4" component="div">
                          {details.backups?.total || 0}
                        </Typography>
                        <Typography color="textSecondary" variant="body2">
                          Total Backups
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="h4" component="div" color={
                          details.backups?.successRate >= 90 ? 'success.main' :
                          details.backups?.successRate >= 70 ? 'warning.main' : 'error.main'
                        }>
                          {details.backups?.successRate ? `${Math.round(details.backups.successRate)}%` : 'N/A'}
                        </Typography>
                        <Typography color="textSecondary" variant="body2">
                          Success Rate
                        </Typography>
                      </Grid>
                    </Grid>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="success.main">
                          ✓ {details.backups?.successful || 0} successful
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="error.main">
                          ✗ {details.backups?.failed || 0} failed
                        </Typography>
                      </Grid>
                    </Grid>
                    {details.restores?.total > 0 && (
                      <Box mt={1} pt={1} borderTop="1px solid" borderColor="divider">
                        <Typography variant="body2" color="textSecondary">
                          Restores: {details.restores.successful}/{details.restores.total} successful 
                          ({Math.round(details.restores.successRate || 0)}%)
                        </Typography>
                      </Box>
                    )}
                    {details.backups?.last && (
                      <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                        Last backup: {formatDate(details.backups.last)}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
            {/* Fallback to legacy cluster display if no enhanced data */}
            {(!dashboardData || Object.keys(dashboardData.clusters.details).length === 0) && clusters.map((cluster) => (
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

      {/* Enhanced Recent Activity Timeline */}
      {dashboardData && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" component="h2" mb={2}>
            Recent Activity (Last 7 Days)
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={6}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <BackupIcon color="primary" />
                <Typography variant="h6" component="h3">
                  Recent Backups
                </Typography>
                <Chip label={dashboardData.recentActivity.backups?.length || 0} size="small" color="primary" />
              </Box>
              {dashboardData.recentActivity.backups?.length > 0 ? (
                <Box>
                  {dashboardData.recentActivity.backups.slice(0, 5).map((backup: any) => (
                    <Box key={backup.name} display="flex" justifyContent="space-between" alignItems="center" py={1}
                         sx={{ borderLeft: '3px solid', borderColor: backup.status === 'Completed' ? 'success.main' : 'error.main', pl: 1, mb: 1 }}>
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {backup.name}
                        </Typography>
                        <Box display="flex" gap={1} alignItems="center">
                          <Chip label={backup.cluster || 'Unknown'} size="small" variant="outlined" />
                          <Typography variant="caption" color="textSecondary">
                            {formatDate(backup.time)}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip
                        label={backup.status || 'Unknown'}
                        color={backup.status === 'Completed' ? 'success' : 
                               backup.status === 'Failed' || backup.status === 'FailedValidation' ? 'error' : 'default'}
                        size="small"
                      />
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box textAlign="center" py={4}>
                  <Typography variant="body2" color="textSecondary">
                    No recent backups in the last 7 days
                  </Typography>
                </Box>
              )}
            </Grid>
            <Grid item xs={12} lg={6}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <RestoreIcon color="secondary" />
                <Typography variant="h6" component="h3">
                  Recent Restores
                </Typography>
                <Chip label={dashboardData.recentActivity.restores?.length || 0} size="small" color="secondary" />
              </Box>
              {dashboardData.recentActivity.restores?.length > 0 ? (
                <Box>
                  {dashboardData.recentActivity.restores.slice(0, 5).map((restore: any) => (
                    <Box key={restore.name} display="flex" justifyContent="space-between" alignItems="center" py={1}
                         sx={{ borderLeft: '3px solid', borderColor: restore.status === 'Completed' ? 'success.main' : 'error.main', pl: 1, mb: 1 }}>
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {restore.name}
                        </Typography>
                        <Box display="flex" gap={1} alignItems="center">
                          <Chip label={restore.cluster || 'Unknown'} size="small" variant="outlined" />
                          <Typography variant="caption" color="textSecondary">
                            from {restore.backupName}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="textSecondary">
                          {formatDate(restore.time)}
                        </Typography>
                      </Box>
                      <Chip
                        label={restore.status || 'Unknown'}
                        color={restore.status === 'Completed' ? 'success' : 
                               restore.status === 'Failed' ? 'error' : 'default'}
                        size="small"
                      />
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box textAlign="center" py={4}>
                  <Typography variant="body2" color="textSecondary">
                    No recent restores in the last 7 days
                  </Typography>
                </Box>
              )}
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Fallback Legacy Recent Activity */}
      {!dashboardData && (
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
      )}
    </Box>
  );
};

export default Dashboard;
