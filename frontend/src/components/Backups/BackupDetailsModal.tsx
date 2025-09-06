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
  Collapse,
  Stack,
  LinearProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { Backup } from '../../services/types.ts';
import { formatDate } from '../../utils/dateUtils.ts';
import { BACKUP_PHASES } from '../../utils/constants.ts';
import { apiService } from '../../services/api.ts';

interface BackupDetailsModalProps {
  open: boolean;
  backup: Backup | null;
  onClose: () => void;
  onDownload: (backup: Backup) => void;
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

const BackupDetailsModal: React.FC<BackupDetailsModalProps> = ({
  open,
  backup,
  onClose,
  onDownload,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [detailedInfo, setDetailedInfo] = useState<any>(null);
  const [describeInfo, setDescribeInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && backup) {
      fetchBackupDetails();
    }
  }, [open, backup]);

  const fetchBackupDetails = async () => {
    if (!backup) return;

    setLoading(true);
    try {
      // Fetch detailed backup information
      const details = await apiService.getBackupDetails(backup.cluster, backup.name);
      setDetailedInfo(details);

      // Fetch describe information (equivalent to velero backup describe --details)
      const describe = await apiService.describeBackup(backup.name);
      setDescribeInfo(describe);
    } catch (error) {
      console.error('Failed to fetch backup details:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getStatusIcon = (phase: string) => {
    switch (phase) {
      case BACKUP_PHASES.COMPLETED:
        return <CheckCircleIcon color="success" />;
      case BACKUP_PHASES.FAILED:
      case BACKUP_PHASES.PARTIALLY_FAILED:
        return <ErrorIcon color="error" />;
      case BACKUP_PHASES.IN_PROGRESS:
        return <InfoIcon color="info" />;
      default:
        return <WarningIcon color="warning" />;
    }
  };

  const getStatusColor = (phase: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
    switch (phase) {
      case BACKUP_PHASES.COMPLETED:
        return 'success';
      case BACKUP_PHASES.FAILED:
      case BACKUP_PHASES.PARTIALLY_FAILED:
        return 'error';
      case BACKUP_PHASES.IN_PROGRESS:
        return 'info';
      default:
        return 'warning';
    }
  };

  if (!backup) return null;

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
            {getStatusIcon(backup.status.phase)}
            <Box>
              <Typography variant="h6" component="div" fontWeight="bold">
                Backup: {backup.name}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Cluster: {backup.cluster} • Created {formatDate(backup.creationTimestamp)}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title="Refresh details">
              <IconButton onClick={fetchBackupDetails} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {backup.status.phase === BACKUP_PHASES.COMPLETED && (
              <Tooltip title="Download backup">
                <IconButton onClick={() => onDownload(backup)} color="success">
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            )}
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
          <Tab label="Resources" />
          <Tab label="Storage & Config" />
          <Tab label="Details" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          {/* Overview Tab */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Status & Progress
                  </Typography>
                  <Stack spacing={2}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Chip
                        icon={getStatusIcon(backup.status.phase)}
                        label={backup.status.phase}
                        color={getStatusColor(backup.status.phase)}
                      />
                      <Typography variant="body2" color="textSecondary">
                        {backup.status.phase === BACKUP_PHASES.IN_PROGRESS
                          ? 'Backup in progress...'
                          : `Completed ${formatDate(
                              backup.status.completionTimestamp || backup.creationTimestamp
                            )}`}
                      </Typography>
                    </Box>

                    {backup.status.progress && (
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          Progress: {backup.status.progress.totalItems} items
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={
                            (backup.status.progress.itemsBackedUp /
                              backup.status.progress.totalItems) *
                            100
                          }
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                    )}

                    <Stack direction="row" spacing={2}>
                      <Box>
                        <Typography variant="h4" color="success.main">
                          {backup.status.itemsBackedUp || 0}
                        </Typography>
                        <Typography variant="caption">Items Backed Up</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h4" color="error.main">
                          {backup.status.errors || 0}
                        </Typography>
                        <Typography variant="caption">Errors</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h4" color="warning.main">
                          {backup.status.warnings || 0}
                        </Typography>
                        <Typography variant="caption">Warnings</Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Backup Details
                  </Typography>
                  <Stack spacing={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        TTL:
                      </Typography>
                      <Typography variant="body2">{backup.spec.ttl || '720h0m0s'}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Storage Location:
                      </Typography>
                      <Typography variant="body2">
                        {backup.spec.storageLocation || 'default'}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Snapshot Volumes:
                      </Typography>
                      <Chip
                        label={backup.spec.snapshotVolumes ? 'Yes' : 'No'}
                        size="small"
                        color={backup.spec.snapshotVolumes ? 'success' : 'default'}
                      />
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Include Cluster Resources:
                      </Typography>
                      <Chip
                        label={backup.spec.includeClusterResources ? 'Yes' : 'No'}
                        size="small"
                        color={backup.spec.includeClusterResources ? 'success' : 'default'}
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              {/* Expandable sections */}
              {backup.spec.includedNamespaces && backup.spec.includedNamespaces.length > 0 && (
                <Card>
                  <CardContent>
                    <Box
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ cursor: 'pointer' }}
                      onClick={() => toggleSection('namespaces')}
                    >
                      <Typography variant="h6">
                        Included Namespaces ({backup.spec.includedNamespaces.length})
                      </Typography>
                      {expandedSections.has('namespaces') ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </Box>
                    <Collapse in={expandedSections.has('namespaces')}>
                      <Box sx={{ mt: 2 }}>
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                          {backup.spec.includedNamespaces.map((namespace: string) => (
                            <Chip
                              key={namespace}
                              label={namespace}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Stack>
                      </Box>
                    </Collapse>
                  </CardContent>
                </Card>
              )}
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {/* Resources Tab */}
          <Typography variant="h6" gutterBottom>
            Backup Resources
          </Typography>
          {detailedInfo ? (
            detailedInfo.resources ? (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Resource Type</TableCell>
                      <TableCell align="center">Count</TableCell>
                      <TableCell>Namespaces</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(detailedInfo.resources).map(
                      ([resourceType, data]: [string, any]) => (
                        <TableRow key={resourceType}>
                          <TableCell>{resourceType}</TableCell>
                          <TableCell align="center">{data.count || 0}</TableCell>
                          <TableCell>
                            {data.namespaces?.map((ns: string) => (
                              <Chip
                                key={ns}
                                label={ns}
                                size="small"
                                variant="outlined"
                                sx={{ mr: 0.5 }}
                              />
                            ))}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">
                {detailedInfo.message ||
                  'No detailed resource information available for this backup.'}
              </Alert>
            )
          ) : (
            <Alert severity="info">Loading resource details...</Alert>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          {/* Storage & Config Tab */}
          <Typography variant="h6" gutterBottom>
            Storage Configuration
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Storage Settings
                  </Typography>
                  <Stack spacing={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Location:
                      </Typography>
                      <Typography variant="body2">
                        {backup.spec.storageLocation || 'default'}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Volume Snapshots:
                      </Typography>
                      <Typography variant="body2">
                        {backup.spec.snapshotVolumes ? 'Enabled' : 'Disabled'}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Default Volumes to Restic:
                      </Typography>
                      <Typography variant="body2">
                        {backup.spec.defaultVolumesToRestic ? 'Yes' : 'No'}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Labels & Annotations
                  </Typography>
                  {backup.metadata?.labels && Object.keys(backup.metadata.labels).length > 0 ? (
                    <Stack spacing={1}>
                      {Object.entries(backup.metadata.labels).map(([key, value]) => (
                        <Box key={key} display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="textSecondary">
                            {key}:
                          </Typography>
                          <Typography variant="body2">{value as string}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No labels
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          {/* Details Tab */}
          <Typography variant="h6" gutterBottom>
            Detailed Backup Information
          </Typography>
          {describeInfo ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      Backup Details
                    </Typography>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Name:
                        </Typography>
                        <Typography variant="body2">{describeInfo.name}</Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Namespace:
                        </Typography>
                        <Typography variant="body2">{describeInfo.namespace}</Typography>
                      </Box>
                      {describeInfo.details?.version && (
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="textSecondary">
                            Version:
                          </Typography>
                          <Typography variant="body2">{describeInfo.details.version}</Typography>
                        </Box>
                      )}
                      {describeInfo.details?.formatVersion && (
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="textSecondary">
                            Format Version:
                          </Typography>
                          <Typography variant="body2">
                            {describeInfo.details.formatVersion}
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
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      Specification
                    </Typography>
                    {describeInfo.spec && (
                      <Paper
                        sx={{
                          p: 2,
                          maxHeight: 300,
                          overflow: 'auto',
                          backgroundColor: '#1e1e1e',
                          border: '1px solid #333',
                        }}
                      >
                        <Typography
                          component="pre"
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            lineHeight: 1.4,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: '#e0e0e0',
                          }}
                        >
                          {JSON.stringify(describeInfo.spec, null, 2)}
                        </Typography>
                      </Paper>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      Status Information
                    </Typography>
                    {describeInfo.status && (
                      <Paper
                        sx={{
                          p: 2,
                          maxHeight: 300,
                          overflow: 'auto',
                          backgroundColor: '#1e1e1e',
                          border: '1px solid #333',
                        }}
                      >
                        <Typography
                          component="pre"
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            lineHeight: 1.4,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: '#e0e0e0',
                          }}
                        >
                          {JSON.stringify(describeInfo.status, null, 2)}
                        </Typography>
                      </Paper>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">Loading detailed information...</Alert>
          )}
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose}>Close</Button>
        {backup.status.phase === BACKUP_PHASES.COMPLETED && (
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => onDownload(backup)}
            color="success"
          >
            Download Backup
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BackupDetailsModal;
