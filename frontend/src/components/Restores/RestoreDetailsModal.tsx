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
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import RestoreIcon from '@mui/icons-material/Restore';
import { Restore } from '../../services/types.ts';
import { formatDate } from '../../utils/dateUtils.ts';
import { apiService } from '../../services/api.ts';

interface RestoreDetailsModalProps {
  open: boolean;
  restore: Restore | null;
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

const RestoreDetailsModal: React.FC<RestoreDetailsModalProps> = ({ open, restore, onClose }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [detailedInfo, setDetailedInfo] = useState<any>(null);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && restore) {
      fetchRestoreDetails();
    }
  }, [open, restore]);

  const fetchRestoreDetails = async () => {
    if (!restore) return;

    setLoading(true);
    try {
      // Fetch detailed restore information
      const details = await apiService.describeRestore(restore.name);
      setDetailedInfo(details);

      // Fetch logs if available
      const logsData = await apiService.getRestoreLogs(restore.name);
      setLogs(logsData.logs || '');
    } catch (error) {
      console.error('Failed to fetch restore details:', error);
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
    switch (phase.toLowerCase()) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'failed':
      case 'partiallyfailed':
        return <ErrorIcon color="error" />;
      case 'inprogress':
        return <InfoIcon color="info" />;
      default:
        return <WarningIcon color="warning" />;
    }
  };

  const getStatusColor = (phase: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
    switch (phase.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'failed':
      case 'partiallyfailed':
        return 'error';
      case 'inprogress':
        return 'info';
      default:
        return 'warning';
    }
  };

  if (!restore) return null;

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
            <RestoreIcon color="primary" />
            <Box>
              <Typography variant="h6" component="div" fontWeight="bold">
                Restore: {restore.name}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Cluster: {restore.cluster} • From backup: {restore.spec.backupName} • Created{' '}
                {formatDate(restore.creationTimestamp)}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title="Refresh details">
              <IconButton onClick={fetchRestoreDetails} disabled={loading}>
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
          <Tab label="Configuration" />
          <Tab label="Logs" />
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
                        icon={getStatusIcon(restore.status.phase)}
                        label={restore.status.phase}
                        color={getStatusColor(restore.status.phase)}
                      />
                      <Typography variant="body2" color="textSecondary">
                        {restore.status.phase.toLowerCase() === 'inprogress'
                          ? 'Restore in progress...'
                          : `Completed ${formatDate(
                              restore.status.completionTimestamp || restore.creationTimestamp
                            )}`}
                      </Typography>
                    </Box>

                    {restore.status.progress && (
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          Progress: {restore.status.progress.itemsRestored}/
                          {restore.status.progress.totalItems} items
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={
                            (restore.status.progress.itemsRestored /
                              restore.status.progress.totalItems) *
                            100
                          }
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                    )}

                    <Stack direction="row" spacing={2}>
                      <Box>
                        <Typography variant="h4" color="success.main">
                          {restore.status.progress?.itemsRestored || 0}
                        </Typography>
                        <Typography variant="caption">Items Restored</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h4" color="error.main">
                          {restore.status.errors || 0}
                        </Typography>
                        <Typography variant="caption">Errors</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h4" color="warning.main">
                          {restore.status.warnings || 0}
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
                    Restore Details
                  </Typography>
                  <Stack spacing={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Source Backup:
                      </Typography>
                      <Typography variant="body2" fontFamily="monospace">
                        {restore.spec.backupName}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Restore PVs:
                      </Typography>
                      <Chip
                        label={restore.spec.restorePVs ? 'Yes' : 'No'}
                        size="small"
                        color={restore.spec.restorePVs ? 'success' : 'default'}
                      />
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Include Cluster Resources:
                      </Typography>
                      <Chip
                        label={restore.spec.includeClusterResources ? 'Yes' : 'No'}
                        size="small"
                        color={restore.spec.includeClusterResources ? 'success' : 'default'}
                      />
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Started:
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(restore.status.startTimestamp || restore.creationTimestamp)}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              {/* Expandable sections */}
              {restore.spec.includedNamespaces && restore.spec.includedNamespaces.length > 0 && (
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
                        Included Namespaces ({restore.spec.includedNamespaces.length})
                      </Typography>
                      {expandedSections.has('namespaces') ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </Box>
                    <Collapse in={expandedSections.has('namespaces')}>
                      <Box sx={{ mt: 2 }}>
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                          {restore.spec.includedNamespaces.map((namespace: string) => (
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

              {restore.spec.namespaceMapping &&
                Object.keys(restore.spec.namespaceMapping).length > 0 && (
                  <Card sx={{ mt: 2 }}>
                    <CardContent>
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ cursor: 'pointer' }}
                        onClick={() => toggleSection('namespaceMapping')}
                      >
                        <Typography variant="h6">
                          Namespace Mapping ({Object.keys(restore.spec.namespaceMapping).length})
                        </Typography>
                        {expandedSections.has('namespaceMapping') ? (
                          <ExpandLessIcon />
                        ) : (
                          <ExpandMoreIcon />
                        )}
                      </Box>
                      <Collapse in={expandedSections.has('namespaceMapping')}>
                        <Box sx={{ mt: 2 }}>
                          <Stack spacing={1}>
                            {Object.entries(restore.spec.namespaceMapping).map(([from, to]) => (
                              <Box key={from} display="flex" alignItems="center" gap={2}>
                                <Chip label={from} size="small" variant="outlined" />
                                <Typography>→</Typography>
                                <Chip label={to as string} size="small" color="primary" />
                              </Box>
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
            Restored Resources
          </Typography>
          {detailedInfo?.resources ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Resource Type</TableCell>
                    <TableCell align="center">Count</TableCell>
                    <TableCell>Namespaces</TableCell>
                    <TableCell>Status</TableCell>
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
                        <TableCell>
                          <Chip
                            label={data.status || 'Unknown'}
                            size="small"
                            color={data.status === 'Restored' ? 'success' : 'default'}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">Loading resource details...</Alert>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          {/* Configuration Tab */}
          <Typography variant="h6" gutterBottom>
            Restore Configuration
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Source Configuration
                  </Typography>
                  <Stack spacing={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Backup Name:
                      </Typography>
                      <Typography variant="body2" fontFamily="monospace">
                        {restore.spec.backupName}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Restore PVs:
                      </Typography>
                      <Typography variant="body2">
                        {restore.spec.restorePVs ? 'Enabled' : 'Disabled'}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Include Cluster Resources:
                      </Typography>
                      <Typography variant="body2">
                        {restore.spec.includeClusterResources ? 'Yes' : 'No'}
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
                    Labels & Metadata
                  </Typography>
                  {restore.labels && Object.keys(restore.labels).length > 0 ? (
                    <Stack spacing={1}>
                      {Object.entries(restore.labels).map(([key, value]) => (
                        <Box key={key} display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="textSecondary">
                            {key}:
                          </Typography>
                          <Typography variant="body2">{value}</Typography>
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
          {/* Logs Tab */}
          <Typography variant="h6" gutterBottom>
            Restore Logs
          </Typography>
          <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto', backgroundColor: 'grey.50' }}>
            <Typography
              component="pre"
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                lineHeight: 1.4,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {logs || 'No logs available for this restore.'}
            </Typography>
          </Paper>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default RestoreDetailsModal;
