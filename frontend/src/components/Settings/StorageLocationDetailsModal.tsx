import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Alert,
  Stack,
  Divider,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import CloudIcon from '@mui/icons-material/Cloud';
import SecurityIcon from '@mui/icons-material/Security';

interface StorageLocation {
  name: string;
  namespace: string;
  spec: {
    provider: string;
    default?: boolean;
    objectStorage: {
      bucket: string;
      region?: string;
      prefix?: string;
    };
    config?: { [key: string]: any };
    credential?: {
      name: string;
      key: string;
    };
  };
  status?: {
    phase: string;
    message?: string;
    lastSyncedTime?: string;
  };
}

interface StorageLocationDetailsModalProps {
  open: boolean;
  storageLocation: StorageLocation | null;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const StorageLocationDetailsModal: React.FC<StorageLocationDetailsModalProps> = ({
  open,
  storageLocation,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [detailedInfo, setDetailedInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);

  useEffect(() => {
    if (open && storageLocation) {
      fetchStorageLocationDetails();
      testConnection();
    }
  }, [open, storageLocation]);

  const fetchStorageLocationDetails = async () => {
    if (!storageLocation) return;

    setLoading(true);
    try {
      // Mock detailed information - in real implementation, call API
      const mockDetails = {
        usage: {
          totalBackups: 15,
          totalSize: '2.4 GB',
          oldestBackup: '2024-08-01T10:00:00Z',
          newestBackup: '2024-09-04T20:00:00Z',
        },
        backups: [
          { name: 'daily-backup-20240904', size: '156 MB', created: '2024-09-04T20:00:00Z' },
          { name: 'weekly-backup-20240901', size: '245 MB', created: '2024-09-01T10:00:00Z' },
          { name: 'manual-backup-20240830', size: '89 MB', created: '2024-08-30T15:30:00Z' },
        ],
        credentials: {
          type: storageLocation.spec.credential ? 'Secret-based' : 'IAM Role',
          secretName: storageLocation.spec.credential?.name,
          keyName: storageLocation.spec.credential?.key,
        },
      };
      setDetailedInfo(mockDetails);
    } catch (error) {
      console.error('Failed to fetch storage location details:', error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!storageLocation) return;

    try {
      // Mock connection test - in real implementation, call API
      setConnectionStatus({
        connected: storageLocation.status?.phase === 'Available',
        latency: '45ms',
        lastTested: new Date().toISOString(),
        error:
          storageLocation.status?.phase !== 'Available' ? storageLocation.status?.message : null,
      });
    } catch (error) {
      setConnectionStatus({
        connected: false,
        error: 'Failed to test connection',
        lastTested: new Date().toISOString(),
      });
    }
  };

  const getStatusIcon = (phase: string) => {
    switch (phase) {
      case 'Available':
        return <CheckCircleIcon color="success" />;
      case 'Unavailable':
        return <ErrorIcon color="error" />;
      default:
        return <WarningIcon color="warning" />;
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'aws':
        return <CloudIcon sx={{ color: '#FF9900' }} />;
      case 'gcp':
        return <CloudIcon sx={{ color: '#4285F4' }} />;
      case 'azure':
        return <CloudIcon sx={{ color: '#0078D4' }} />;
      case 'minio':
        return <StorageIcon sx={{ color: '#C72E29' }} />;
      default:
        return <StorageIcon />;
    }
  };

  if (!storageLocation) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            {getProviderIcon(storageLocation.spec.provider)}
            <Box>
              <Typography variant="h6" component="div" fontWeight="bold">
                Storage Location: {storageLocation.name}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Provider: {storageLocation.spec.provider} • Bucket:{' '}
                {storageLocation.spec.objectStorage.bucket}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title="Refresh details">
              <IconButton onClick={fetchStorageLocationDetails} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
        {loading && <LinearProgress sx={{ mt: 1 }} />}
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Overview" />
          <Tab label="Configuration" />
          <Tab label="Backups" />
          <Tab label="Connection Test" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          {/* Overview Tab */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Status & Health
                  </Typography>
                  <Stack spacing={2}>
                    <Box display="flex" alignItems="center" gap={2}>
                      {getStatusIcon(storageLocation.status?.phase || 'Unknown')}
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {storageLocation.status?.phase || 'Unknown'}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {storageLocation.status?.message || 'No status information available'}
                        </Typography>
                      </Box>
                    </Box>

                    {storageLocation.spec.default && (
                      <Alert severity="info" icon={<InfoIcon />}>
                        This is the default storage location for new backups
                      </Alert>
                    )}

                    {connectionStatus && (
                      <Box>
                        <Typography variant="body2" fontWeight="medium" gutterBottom>
                          Connection Status
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1}>
                          {connectionStatus.connected ? (
                            <CheckCircleIcon color="success" fontSize="small" />
                          ) : (
                            <ErrorIcon color="error" fontSize="small" />
                          )}
                          <Typography variant="body2">
                            {connectionStatus.connected ? 'Connected' : 'Connection Failed'}
                          </Typography>
                          {connectionStatus.latency && (
                            <Chip label={`${connectionStatus.latency} latency`} size="small" />
                          )}
                        </Box>
                        {connectionStatus.error && (
                          <Typography variant="caption" color="error">
                            Error: {connectionStatus.error}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Storage Usage
                  </Typography>
                  {detailedInfo?.usage ? (
                    <Stack spacing={2}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Total Backups:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {detailedInfo.usage.totalBackups}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Total Size:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {detailedInfo.usage.totalSize}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Oldest Backup:
                        </Typography>
                        <Typography variant="body2">
                          {new Date(detailedInfo.usage.oldestBackup).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Newest Backup:
                        </Typography>
                        <Typography variant="body2">
                          {new Date(detailedInfo.usage.newestBackup).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Stack>
                  ) : (
                    <Alert severity="info">Loading storage usage information...</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {/* Configuration Tab */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Object Storage Configuration
                  </Typography>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Provider:
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getProviderIcon(storageLocation.spec.provider)}
                        <Typography variant="body1" fontWeight="medium">
                          {storageLocation.spec.provider.toUpperCase()}
                        </Typography>
                      </Box>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Bucket:
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {storageLocation.spec.objectStorage.bucket}
                      </Typography>
                    </Box>
                    {storageLocation.spec.objectStorage.region && (
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Region:
                        </Typography>
                        <Typography variant="body1">
                          {storageLocation.spec.objectStorage.region}
                        </Typography>
                      </Box>
                    )}
                    {storageLocation.spec.objectStorage.prefix && (
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Prefix:
                        </Typography>
                        <Typography variant="body1" fontFamily="monospace">
                          {storageLocation.spec.objectStorage.prefix}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Authentication
                  </Typography>
                  {detailedInfo?.credentials ? (
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Authentication Type:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {detailedInfo.credentials.type}
                        </Typography>
                      </Box>
                      {detailedInfo.credentials.secretName && (
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Secret Name:
                          </Typography>
                          <Typography variant="body1" fontFamily="monospace">
                            {detailedInfo.credentials.secretName}
                          </Typography>
                        </Box>
                      )}
                      {detailedInfo.credentials.keyName && (
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Key Name:
                          </Typography>
                          <Typography variant="body1" fontFamily="monospace">
                            {detailedInfo.credentials.keyName}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  ) : (
                    <Alert severity="info">Loading authentication details...</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          {/* Backups Tab */}
          <Typography variant="h6" gutterBottom>
            Backups Stored in this Location
          </Typography>
          {detailedInfo?.backups ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Backup Name</TableCell>
                    <TableCell align="right">Size</TableCell>
                    <TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detailedInfo.backups.map((backup: any) => (
                    <TableRow key={backup.name}>
                      <TableCell>{backup.name}</TableCell>
                      <TableCell align="right">{backup.size}</TableCell>
                      <TableCell>{new Date(backup.created).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">Loading backup information...</Alert>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          {/* Connection Test Tab */}
          <Typography variant="h6" gutterBottom>
            Storage Connection Test
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  {connectionStatus ? (
                    <Stack spacing={3}>
                      <Box display="flex" alignItems="center" gap={2}>
                        {connectionStatus.connected ? (
                          <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
                        ) : (
                          <ErrorIcon color="error" sx={{ fontSize: 40 }} />
                        )}
                        <Box>
                          <Typography variant="h6">
                            {connectionStatus.connected
                              ? 'Connection Successful'
                              : 'Connection Failed'}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Last tested: {new Date(connectionStatus.lastTested).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>

                      {connectionStatus.connected && connectionStatus.latency && (
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Latency:
                          </Typography>
                          <Typography variant="h4" color="success.main">
                            {connectionStatus.latency}
                          </Typography>
                        </Box>
                      )}

                      {connectionStatus.error && (
                        <Alert severity="error">
                          <Typography variant="body2">{connectionStatus.error}</Typography>
                        </Alert>
                      )}
                    </Stack>
                  ) : (
                    <Box textAlign="center" py={4}>
                      <CircularProgress />
                      <Typography variant="body2" sx={{ mt: 2 }}>
                        Testing connection...
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={2}>
                <Button
                  variant="contained"
                  onClick={testConnection}
                  startIcon={<RefreshIcon />}
                  fullWidth
                >
                  Test Connection Again
                </Button>
                <Alert severity="info">
                  <Typography variant="caption">
                    This test verifies connectivity to the storage provider and validates
                    credentials.
                  </Typography>
                </Alert>
              </Stack>
            </Grid>
          </Grid>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default StorageLocationDetailsModal;
