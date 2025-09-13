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
  TextField,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TerminalIcon from '@mui/icons-material/Terminal';
import BugReportIcon from '@mui/icons-material/BugReport';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Backup } from '../../services/types.ts';
import { formatDate } from '../../utils/dateUtils.ts';
import { BACKUP_PHASES } from '../../utils/constants.ts';
import { apiService } from '../../services/api.ts';

interface BackupDetailsModalProps {
  open: boolean;
  backup: Backup | null;
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

const BackupDetailsModal: React.FC<BackupDetailsModalProps> = ({ open, backup, onClose }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [detailedInfo, setDetailedInfo] = useState<any>(null);
  const [describeInfo, setDescribeInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [restoreOptions, setRestoreOptions] = useState({
    namespaceMappings: '',
    includeNamespaces: '',
    includeResources: '',
    excludeResources: '',
    labelSelector: '',
    restorePVs: true,
    preserveNodePorts: false,
  });

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

  const fetchBackupLogs = async () => {
    if (!backup) return;

    setLogsLoading(true);
    try {
      const logsResponse = await apiService.getBackupLogs(backup.cluster, backup.name);
      setLogs(logsResponse.logs || 'No logs available for this backup.');
    } catch (error) {
      console.error('Failed to fetch backup logs:', error);
      setLogs('Failed to fetch backup logs. Please try again later.');
    } finally {
      setLogsLoading(false);
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

  const generateRestoreCommand = () => {
    const baseCommand = `velero restore create --from-backup ${backup.name}`;
    const parts = [baseCommand];

    // Handle namespace mappings with automatic include-namespaces
    if (restoreOptions.namespaceMappings.trim()) {
      parts.push(`--namespace-mappings ${restoreOptions.namespaceMappings.trim()}`);
    }

    // Handle include-namespaces (combine manual input with auto-extracted from mappings)
    const combinedNamespaces = new Set<string>();

    // Add explicitly specified namespaces
    if (restoreOptions.includeNamespaces.trim()) {
      restoreOptions.includeNamespaces
        .split(',')
        .map((ns) => ns.trim())
        .filter((ns) => ns)
        .forEach((ns) => combinedNamespaces.add(ns));
    }

    // Add source namespaces from mappings
    if (restoreOptions.namespaceMappings.trim()) {
      restoreOptions.namespaceMappings
        .split(',')
        .map((mapping) => mapping.trim().split(':')[0])
        .filter((ns) => ns)
        .forEach((ns) => combinedNamespaces.add(ns));
    }

    // Add include-namespaces if any namespaces are specified
    if (combinedNamespaces.size > 0) {
      parts.push(`--include-namespaces ${Array.from(combinedNamespaces).join(',')}`);
    }

    if (restoreOptions.includeResources.trim()) {
      parts.push(`--include-resources ${restoreOptions.includeResources.trim()}`);
    }

    if (restoreOptions.excludeResources.trim()) {
      parts.push(`--exclude-resources ${restoreOptions.excludeResources.trim()}`);
    }

    if (restoreOptions.labelSelector.trim()) {
      parts.push(`--selector ${restoreOptions.labelSelector.trim()}`);
    }

    if (!restoreOptions.restorePVs) {
      parts.push(`--restore-volumes=false`);
    }

    if (restoreOptions.preserveNodePorts) {
      parts.push(`--preserve-nodeports`);
    }

    return parts.join(' \\\n  ');
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const hasProblems = () => {
    return (
      backup.status.phase === BACKUP_PHASES.FAILED ||
      backup.status.phase === BACKUP_PHASES.PARTIALLY_FAILED ||
      (backup.status.errors && backup.status.errors > 0) ||
      (backup.status.warnings && backup.status.warnings > 0)
    );
  };

  // Calculate tab indices dynamically based on whether diagnostics tab is shown
  const getTabIndex = (tabName: string) => {
    const baseIndices = {
      overview: 0,
      resources: 1,
      storage: 2,
      restore: 3,
    };

    if (!hasProblems()) {
      return { ...baseIndices, details: 4 };
    } else {
      return { ...baseIndices, diagnostics: 4, details: 5 };
    }
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
          <Tab icon={<TerminalIcon />} label="Restore Commands" />
          {(backup.status.phase === BACKUP_PHASES.FAILED ||
            backup.status.phase === BACKUP_PHASES.PARTIALLY_FAILED ||
            (backup.status.errors && backup.status.errors > 0) ||
            (backup.status.warnings && backup.status.warnings > 0)) && (
            <Tab
              icon={<BugReportIcon />}
              label="Diagnostics"
              sx={{
                color: backup.status.phase === BACKUP_PHASES.FAILED ? 'error.main' : 'warning.main',
                '&.Mui-selected': {
                  color:
                    backup.status.phase === BACKUP_PHASES.FAILED ? 'error.main' : 'warning.main',
                },
              }}
            />
          )}
          <Tab label="Details" />
        </Tabs>

        <TabPanel value={activeTab} index={getTabIndex('overview').overview}>
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

        <TabPanel value={activeTab} index={getTabIndex('resources').resources}>
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

        <TabPanel value={activeTab} index={getTabIndex('storage').storage}>
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

        <TabPanel value={activeTab} index={getTabIndex('restore').restore}>
          {/* Restore Commands Tab */}
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <TerminalIcon />
            Restore Command Generator
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Generate velero CLI restore commands for cluster administrators. Customize the restore
            options below and copy the generated command.
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Restore Options
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      label="Namespace Mappings"
                      size="small"
                      value={restoreOptions.namespaceMappings}
                      onChange={(e) =>
                        setRestoreOptions({ ...restoreOptions, namespaceMappings: e.target.value })
                      }
                      placeholder="source-namespace:target-namespace,..."
                      helperText="Syntax: current-namespace-to-restore:new-namespace-location (comma-separated). Auto-includes source namespaces in restore."
                      fullWidth
                    />

                    <TextField
                      label="Include Namespaces"
                      size="small"
                      value={restoreOptions.includeNamespaces}
                      onChange={(e) =>
                        setRestoreOptions({ ...restoreOptions, includeNamespaces: e.target.value })
                      }
                      placeholder="namespace1,namespace2,..."
                      helperText="Additional namespaces to include in restore (combined with namespace mappings sources)"
                      fullWidth
                    />

                    <TextField
                      label="Include Resources"
                      size="small"
                      value={restoreOptions.includeResources}
                      onChange={(e) =>
                        setRestoreOptions({ ...restoreOptions, includeResources: e.target.value })
                      }
                      placeholder="pods,configmaps,secrets"
                      helperText="Specific resource types to include (comma-separated)"
                      fullWidth
                    />

                    <TextField
                      label="Exclude Resources"
                      size="small"
                      value={restoreOptions.excludeResources}
                      onChange={(e) =>
                        setRestoreOptions({ ...restoreOptions, excludeResources: e.target.value })
                      }
                      placeholder="events,pods/log"
                      helperText="Resource types to exclude from restore (comma-separated)"
                      fullWidth
                    />

                    <TextField
                      label="Label Selector"
                      size="small"
                      value={restoreOptions.labelSelector}
                      onChange={(e) =>
                        setRestoreOptions({ ...restoreOptions, labelSelector: e.target.value })
                      }
                      placeholder="app=myapp,version=v1.0"
                      helperText="Only restore resources matching these labels"
                      fullWidth
                    />

                    <Stack spacing={1}>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Typography variant="body2">Restore Persistent Volumes</Typography>
                        <Chip
                          label={restoreOptions.restorePVs ? 'Yes' : 'No'}
                          color={restoreOptions.restorePVs ? 'success' : 'default'}
                          size="small"
                          onClick={() =>
                            setRestoreOptions({
                              ...restoreOptions,
                              restorePVs: !restoreOptions.restorePVs,
                            })
                          }
                          sx={{ cursor: 'pointer' }}
                        />
                      </Box>

                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Typography variant="body2">Preserve NodePorts</Typography>
                        <Chip
                          label={restoreOptions.preserveNodePorts ? 'Yes' : 'No'}
                          color={restoreOptions.preserveNodePorts ? 'success' : 'default'}
                          size="small"
                          onClick={() =>
                            setRestoreOptions({
                              ...restoreOptions,
                              preserveNodePorts: !restoreOptions.preserveNodePorts,
                            })
                          }
                          sx={{ cursor: 'pointer' }}
                        />
                      </Box>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Generated Command
                  </Typography>
                  <Paper
                    sx={{
                      p: 2,
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      position: 'relative',
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={() => copyToClipboard(generateRestoreCommand())}
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        color: '#888',
                      }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                    <Typography
                      component="pre"
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        lineHeight: 1.4,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: '#e0e0e0',
                        pr: 4, // Make room for copy button
                      }}
                    >
                      {generateRestoreCommand()}
                    </Typography>
                  </Paper>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Usage:</strong> Run this command on the target cluster where you want
                      to restore the backup. Make sure you have velero CLI installed and configured
                      to access the target cluster.
                    </Typography>
                  </Alert>

                  {restoreOptions.namespaceMappings.trim() && (
                    <Alert severity="success" sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        <strong>Smart Namespace Filtering:</strong> When using namespace mappings,
                        the command automatically includes --include-namespaces to restore only the
                        specified source namespaces, preventing full-cluster restoration when you
                        only want specific namespaces remapped.
                      </Typography>
                    </Alert>
                  )}

                  <Alert severity="warning" sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      <strong>Note:</strong> Test restores in non-production environments first.
                      Consider backup compatibility and target cluster state before restoring.
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Quick Commands
                  </Typography>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" gutterBottom color="textSecondary">
                        Basic restore (all namespaces and resources):
                      </Typography>
                      <Paper
                        sx={{
                          p: 1.5,
                          backgroundColor: '#1a1a1a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography
                          component="code"
                          sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#e0e0e0' }}
                        >
                          velero restore create --from-backup {backup.name}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() =>
                            copyToClipboard(`velero restore create --from-backup ${backup.name}`)
                          }
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Paper>
                    </Box>

                    <Box>
                      <Typography variant="body2" gutterBottom color="textSecondary">
                        Check restore status:
                      </Typography>
                      <Paper
                        sx={{
                          p: 1.5,
                          backgroundColor: '#1a1a1a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography
                          component="code"
                          sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#e0e0e0' }}
                        >
                          velero restore get
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard('velero restore get')}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Paper>
                    </Box>

                    <Box>
                      <Typography variant="body2" gutterBottom color="textSecondary">
                        Describe specific restore:
                      </Typography>
                      <Paper
                        sx={{
                          p: 1.5,
                          backgroundColor: '#1a1a1a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography
                          component="code"
                          sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#e0e0e0' }}
                        >
                          velero restore describe &lt;restore-name&gt;
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard('velero restore describe <restore-name>')}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Paper>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {hasProblems() && (
          <TabPanel value={activeTab} index={getTabIndex('diagnostics').diagnostics}>
            {/* Diagnostics Tab */}
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <BugReportIcon
                color={backup.status.phase === BACKUP_PHASES.FAILED ? 'error' : 'warning'}
              />
              Backup Diagnostics
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Investigate backup failures and warnings. Review logs and error details to
              troubleshoot issues.
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      fontWeight="bold"
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <ErrorIcon color="error" />
                      Issue Summary
                    </Typography>
                    <Stack spacing={2}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="textSecondary">
                          Status:
                        </Typography>
                        <Chip
                          icon={getStatusIcon(backup.status.phase)}
                          label={backup.status.phase}
                          color={getStatusColor(backup.status.phase)}
                          size="small"
                        />
                      </Box>

                      {backup.status.errors && backup.status.errors > 0 && (
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" color="textSecondary">
                            Errors:
                          </Typography>
                          <Chip
                            label={`${backup.status.errors} errors`}
                            color="error"
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      )}

                      {backup.status.warnings && backup.status.warnings > 0 && (
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" color="textSecondary">
                            Warnings:
                          </Typography>
                          <Chip
                            label={`${backup.status.warnings} warnings`}
                            color="warning"
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      )}

                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="textSecondary">
                          Items Processed:
                        </Typography>
                        <Typography variant="body2">
                          {backup.status.itemsBackedUp || 0} /{' '}
                          {backup.status.progress?.totalItems || 'N/A'}
                        </Typography>
                      </Box>

                      {backup.status.failureReason && (
                        <Box>
                          <Typography variant="body2" color="textSecondary" gutterBottom>
                            Failure Reason:
                          </Typography>
                          <Alert severity="error" sx={{ mt: 1 }}>
                            <Typography variant="body2">{backup.status.failureReason}</Typography>
                          </Alert>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      fontWeight="bold"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <VisibilityIcon />
                        Backup Logs
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={fetchBackupLogs}
                        disabled={logsLoading}
                        startIcon={logsLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
                      >
                        {logs ? 'Refresh' : 'Load'} Logs
                      </Button>
                    </Typography>

                    {logs ? (
                      <Paper
                        sx={{
                          p: 2,
                          maxHeight: 300,
                          overflow: 'auto',
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          position: 'relative',
                        }}
                      >
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(logs)}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            color: '#888',
                          }}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                        <Typography
                          component="pre"
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            lineHeight: 1.4,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: logs.includes('level=error')
                              ? '#ff6b6b'
                              : logs.includes('level=warning')
                                ? '#ffa500'
                                : '#e0e0e0',
                            pr: 4, // Make room for copy button
                          }}
                        >
                          {logs}
                        </Typography>
                      </Paper>
                    ) : (
                      <Alert severity="info">
                        Click "Load Logs" to view detailed backup logs for troubleshooting.
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      Troubleshooting Tips
                    </Typography>
                    <Stack spacing={2}>
                      {backup.status.phase === BACKUP_PHASES.FAILED && (
                        <Alert severity="error">
                          <Typography variant="body2">
                            <strong>Backup Failed:</strong> This backup did not complete
                            successfully. Check the logs above for specific error messages. Common
                            causes include:
                            <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 16 }}>
                              <li>Storage location connectivity issues</li>
                              <li>Insufficient permissions (RBAC)</li>
                              <li>Resource conflicts or locks</li>
                              <li>Cluster resource constraints</li>
                            </ul>
                          </Typography>
                        </Alert>
                      )}

                      {backup.status.phase === BACKUP_PHASES.PARTIALLY_FAILED && (
                        <Alert severity="warning">
                          <Typography variant="body2">
                            <strong>Partial Backup:</strong> Some resources were successfully backed
                            up, but others failed. This may be acceptable depending on your
                            requirements. Review the logs to understand which resources failed.
                          </Typography>
                        </Alert>
                      )}

                      {backup.status.warnings && backup.status.warnings > 0 && (
                        <Alert severity="warning">
                          <Typography variant="body2">
                            <strong>Warnings Detected:</strong> The backup completed but with
                            warnings. While not critical, these may indicate potential issues that
                            should be investigated.
                          </Typography>
                        </Alert>
                      )}

                      <Alert severity="info">
                        <Typography variant="body2">
                          <strong>For further investigation:</strong>
                          <ul style={{ marginTop: 4, marginBottom: 0, paddingLeft: 16 }}>
                            <li>
                              Check Velero pod logs:{' '}
                              <code>kubectl logs -n velero deployment/velero</code>
                            </li>
                            <li>
                              Describe this backup:{' '}
                              <code>velero backup describe {backup.name} --details</code>
                            </li>
                            <li>
                              Check storage location status: <code>velero backup-location get</code>
                            </li>
                            <li>Verify cluster connectivity and permissions</li>
                          </ul>
                        </Typography>
                      </Alert>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>
        )}

        <TabPanel
          value={activeTab}
          index={hasProblems() ? getTabIndex('details').details : getTabIndex('details').details}
        >
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
      </DialogActions>
    </Dialog>
  );
};

export default BackupDetailsModal;
