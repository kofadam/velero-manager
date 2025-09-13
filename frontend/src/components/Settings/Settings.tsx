import React, { useState, useEffect } from 'react';
import UserManagement from './UserManagement.tsx';
import OIDCSettings from './OIDCSettings.tsx';
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import { Refresh, Settings as SettingsIcon, People, Computer, Security } from '@mui/icons-material';

interface MultiClusterStatus {
  discovered_clusters: Array<{
    name: string;
    display_name: string;
    api_endpoint: string;
    token_secret_name: string;
    status: string;
    last_seen: string;
  }>;
  connected_clusters: Array<{
    name: string;
    status: string;
    lastSeen: string;
  }>;
  cache_stats: {
    total_entries: number;
    expired_entries: number;
    active_entries: number;
    cluster_counts: Record<string, number>;
    cache_ttl: string;
  };
  total_discovered: number;
  total_connected: number;
}

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('clusters');
  const [multiClusterStatus, setMultiClusterStatus] = useState<MultiClusterStatus | null>(null);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    fetchClusters();
    fetchMultiClusterStatus();
  }, []);

  const fetchClusters = async () => {
    // This function is kept for potential future use
    // Currently we get cluster info from multi-cluster status
  };

  const fetchMultiClusterStatus = async () => {
    try {
      const response = await fetch('/api/v1/clusters/status');
      if (response.ok) {
        const data = await response.json();
        setMultiClusterStatus(data);
      }
    } catch (err: any) {
      console.log('Multi-cluster status not available:', err.message);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <SettingsIcon /> Settings
          </Typography>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            aria-label="settings tabs"
          >
            <Tab icon={<Computer />} iconPosition="start" label="Clusters" value="clusters" />
            <Tab icon={<People />} iconPosition="start" label="Users" value="users" />
            <Tab icon={<Security />} iconPosition="start" label="OIDC / SSO" value="oidc" />
          </Tabs>
        </Box>

        {activeTab === 'clusters' && (
          <Box>
            <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Computer /> Multi-Cluster Overview
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              View and monitor clusters connected to this Velero Manager instance.
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 3 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  fetchClusters();
                  fetchMultiClusterStatus();
                }}
                startIcon={<Refresh />}
              >
                Refresh
              </Button>
            </Box>

            {loading && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 200,
                }}
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

            {/* Multi-Cluster Status Cards */}
            {multiClusterStatus && (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Discovered Clusters
                      </Typography>
                      <Typography variant="h4">{multiClusterStatus.total_discovered}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Connected Clusters
                      </Typography>
                      <Typography variant="h4">{multiClusterStatus.total_connected}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Cached Backups
                      </Typography>
                      <Typography variant="h4">
                        {multiClusterStatus.cache_stats.active_entries}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Cache TTL
                      </Typography>
                      <Typography variant="h6">
                        {multiClusterStatus.cache_stats.cache_ttl}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {!loading && !error && (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Cluster Name</TableCell>
                      <TableCell>Connection Status</TableCell>
                      <TableCell>Backup Count</TableCell>
                      <TableCell>Last Backup</TableCell>
                      <TableCell>API Endpoint</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {multiClusterStatus && multiClusterStatus.discovered_clusters.length > 0 ? (
                      multiClusterStatus.discovered_clusters.map((cluster) => {
                        const connectedCluster = multiClusterStatus.connected_clusters.find(
                          (c) => c.name === cluster.name
                        );
                        const backupCount =
                          multiClusterStatus.cache_stats.cluster_counts[cluster.name] || 0;
                        return (
                          <TableRow key={cluster.name}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>
                                {cluster.display_name || cluster.name}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={connectedCluster ? connectedCluster.status : 'Disconnected'}
                                color={connectedCluster?.status === 'healthy' ? 'success' : 'error'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{backupCount}</TableCell>
                            <TableCell>
                              {connectedCluster?.lastSeen ? (
                                new Date(connectedCluster.lastSeen).toLocaleString()
                              ) : (
                                <Typography color="text.secondary">Never</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {cluster.api_endpoint || 'Not configured'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography color="text.secondary">No clusters discovered</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {activeTab === 'users' && <UserManagement />}

        {activeTab === 'oidc' && <OIDCSettings />}
      </Paper>
    </Box>
  );
};

export default Settings;
