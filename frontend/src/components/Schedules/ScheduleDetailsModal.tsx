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
import ScheduleIcon from '@mui/icons-material/Schedule';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import { formatDate } from '../../utils/dateUtils.ts';
import { translateCronExpression } from '../../utils/cronUtils.ts';

interface Schedule {
  name: string;
  cluster: string;
  namespace: string;
  creationTimestamp: string;
  spec: {
    schedule: string;
    suspend?: boolean;
    template: {
      includedNamespaces?: string[];
      excludedNamespaces?: string[];
      storageLocation?: string;
      ttl?: string;
      snapshotVolumes?: boolean;
      includeClusterResources?: boolean;
    };
  };
  status?: {
    phase?: string;
    lastBackup?: string;
    validationErrors?: string[];
  };
  labels?: Record<string, string>;
}

interface ScheduleDetailsModalProps {
  open: boolean;
  schedule: Schedule | null;
  onClose: () => void;
  onToggleSchedule?: (scheduleName: string, paused: boolean) => Promise<void>;
  onCreateBackupNow?: (scheduleName: string) => Promise<void>;
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

const ScheduleDetailsModal: React.FC<ScheduleDetailsModalProps> = ({
  open,
  schedule,
  onClose,
  onToggleSchedule,
  onCreateBackupNow,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [detailedInfo, setDetailedInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && schedule) {
      fetchScheduleDetails();
    }
  }, [open, schedule]);

  const fetchScheduleDetails = async () => {
    if (!schedule) return;

    setLoading(true);
    try {
      // Mock detailed information - in real implementation, call API
      const mockDetails = {
        recentBackups: [
          {
            name: `${schedule.name}-20240904200000`,
            status: 'Completed',
            size: '156 MB',
            created: '2024-09-04T20:00:00Z',
            duration: '2m 34s',
          },
          {
            name: `${schedule.name}-20240903200000`,
            status: 'Completed',
            size: '148 MB',
            created: '2024-09-03T20:00:00Z',
            duration: '2m 12s',
          },
          {
            name: `${schedule.name}-20240902200000`,
            status: 'Failed',
            size: '0 B',
            created: '2024-09-02T20:00:00Z',
            duration: '45s',
            error: 'Storage location unavailable',
          },
        ],
        statistics: {
          totalBackups: 28,
          successfulBackups: 26,
          failedBackups: 2,
          averageSize: '152 MB',
          averageDuration: '2m 18s',
          nextRun: getNextRunTime(schedule.spec.schedule),
        },
        configuration: {
          cronExpression: schedule.spec.schedule,
          description: translateCronExpression(schedule.spec.schedule),
          timezone: 'UTC',
        },
      };
      setDetailedInfo(mockDetails);
    } catch (error) {
      console.error('Failed to fetch schedule details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNextRunTime = (cronExpression: string): string => {
    // This is a simplified calculation - in real implementation use a proper cron library
    const now = new Date();
    const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow same time
    return nextRun.toISOString();
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

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'active':
        return <CheckCircleIcon color="success" />;
      case 'failed':
      case 'error':
        return <ErrorIcon color="error" />;
      case 'paused':
        return <PauseIcon color="warning" />;
      default:
        return <WarningIcon color="warning" />;
    }
  };

  const getStatusColor = (status: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'active':
        return 'success';
      case 'failed':
      case 'error':
        return 'error';
      case 'paused':
        return 'warning';
      default:
        return 'default';
    }
  };

  const handleToggle = async () => {
    if (!schedule || !onToggleSchedule) return;
    const isSuspended = schedule.spec.suspend === true;
    try {
      await onToggleSchedule(schedule.name, !isSuspended);
      // Refresh details after toggle
      setTimeout(() => fetchScheduleDetails(), 1000);
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
  };

  const handleCreateBackup = async () => {
    if (!schedule || !onCreateBackupNow) return;
    try {
      await onCreateBackupNow(schedule.name);
      // Refresh details after creating backup
      setTimeout(() => fetchScheduleDetails(), 2000);
    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  };

  if (!schedule) return null;

  const isSuspended = schedule.spec.suspend === true;
  const scheduleStatus = isSuspended ? 'Paused' : 'Active';

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
            <ScheduleIcon color="primary" />
            <Box>
              <Typography variant="h6" component="div" fontWeight="bold">
                Schedule: {schedule.name}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Cluster: {schedule.cluster} • Schedule: {schedule.spec.schedule} • Created{' '}
                {formatDate(schedule.creationTimestamp)}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            {onCreateBackupNow && (
              <Tooltip title="Create backup now">
                <IconButton onClick={handleCreateBackup} color="warning">
                  <FlashOnIcon />
                </IconButton>
              </Tooltip>
            )}
            {onToggleSchedule && (
              <Tooltip title={isSuspended ? 'Resume schedule' : 'Pause schedule'}>
                <IconButton onClick={handleToggle} color={isSuspended ? 'success' : 'warning'}>
                  {isSuspended ? <PlayArrowIcon /> : <PauseIcon />}
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Refresh details">
              <IconButton onClick={fetchScheduleDetails} disabled={loading}>
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
          <Tab label="Recent Backups" />
          <Tab label="Configuration" />
          <Tab label="Statistics" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          {/* Overview Tab */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Schedule Status
                  </Typography>
                  <Stack spacing={2}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Chip
                        icon={getStatusIcon(scheduleStatus)}
                        label={scheduleStatus}
                        color={getStatusColor(scheduleStatus)}
                      />
                      <Typography variant="body2" color="textSecondary">
                        {isSuspended ? 'Schedule is paused' : 'Schedule is running'}
                      </Typography>
                    </Box>

                    {schedule.status?.validationErrors &&
                      schedule.status.validationErrors.length > 0 && (
                        <Alert severity="error">
                          <Typography variant="body2">
                            Validation Errors: {schedule.status.validationErrors.join(', ')}
                          </Typography>
                        </Alert>
                      )}

                    <Box>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        Schedule Expression:
                      </Typography>
                      <Typography
                        variant="body1"
                        fontFamily="monospace"
                        sx={{
                          backgroundColor: 'action.hover',
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          display: 'inline-block',
                        }}
                      >
                        {schedule.spec.schedule}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        Description:
                      </Typography>
                      <Typography variant="body1">
                        {translateCronExpression(schedule.spec.schedule)}
                      </Typography>
                    </Box>

                    {detailedInfo?.statistics?.nextRun && (
                      <Box>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          Next Backup:
                        </Typography>
                        <Typography variant="body1" color="primary.main">
                          {formatDate(detailedInfo.statistics.nextRun)}
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
                    Quick Statistics
                  </Typography>
                  {detailedInfo?.statistics ? (
                    <Stack spacing={2}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Total Backups:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {detailedInfo.statistics.totalBackups}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Successful:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium" color="success.main">
                          {detailedInfo.statistics.successfulBackups}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Failed:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium" color="error.main">
                          {detailedInfo.statistics.failedBackups}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Average Size:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {detailedInfo.statistics.averageSize}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Average Duration:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {detailedInfo.statistics.averageDuration}
                        </Typography>
                      </Box>
                    </Stack>
                  ) : (
                    <Alert severity="info">Loading statistics...</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              {/* Expandable sections for namespaces */}
              {schedule.spec.template?.includedNamespaces &&
                schedule.spec.template.includedNamespaces.length > 0 && (
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
                          Included Namespaces ({schedule.spec.template.includedNamespaces.length})
                        </Typography>
                        {expandedSections.has('namespaces') ? (
                          <ExpandLessIcon />
                        ) : (
                          <ExpandMoreIcon />
                        )}
                      </Box>
                      <Collapse in={expandedSections.has('namespaces')}>
                        <Box sx={{ mt: 2 }}>
                          <Stack direction="row" flexWrap="wrap" gap={1}>
                            {schedule.spec.template.includedNamespaces.map((namespace: string) => (
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
          {/* Recent Backups Tab */}
          <Typography variant="h6" gutterBottom>
            Recent Backups from this Schedule
          </Typography>
          {detailedInfo?.recentBackups ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Backup Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Size</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Error</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detailedInfo.recentBackups.map((backup: any) => (
                    <TableRow key={backup.name}>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {backup.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={backup.status}
                          size="small"
                          color={getStatusColor(backup.status)}
                        />
                      </TableCell>
                      <TableCell align="right">{backup.size}</TableCell>
                      <TableCell>{backup.duration}</TableCell>
                      <TableCell>{formatDate(backup.created)}</TableCell>
                      <TableCell>
                        {backup.error ? (
                          <Typography variant="body2" color="error.main">
                            {backup.error}
                          </Typography>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">Loading recent backups...</Alert>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          {/* Configuration Tab */}
          <Typography variant="h6" gutterBottom>
            Schedule Configuration
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Backup Template Settings
                  </Typography>
                  <Stack spacing={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Storage Location:
                      </Typography>
                      <Typography variant="body2">
                        {schedule.spec.template?.storageLocation || 'default'}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        TTL:
                      </Typography>
                      <Typography variant="body2">
                        {schedule.spec.template?.ttl || '720h0m0s'}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Snapshot Volumes:
                      </Typography>
                      <Chip
                        label={schedule.spec.template?.snapshotVolumes ? 'Yes' : 'No'}
                        size="small"
                        color={schedule.spec.template?.snapshotVolumes ? 'success' : 'default'}
                      />
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Include Cluster Resources:
                      </Typography>
                      <Chip
                        label={schedule.spec.template?.includeClusterResources ? 'Yes' : 'No'}
                        size="small"
                        color={
                          schedule.spec.template?.includeClusterResources ? 'success' : 'default'
                        }
                      />
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
                  {schedule.labels && Object.keys(schedule.labels).length > 0 ? (
                    <Stack spacing={1}>
                      {Object.entries(schedule.labels).map(([key, value]) => (
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
          {/* Statistics Tab */}
          <Typography variant="h6" gutterBottom>
            Detailed Statistics
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="primary.main" gutterBottom>
                    {detailedInfo?.statistics?.totalBackups || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Backups Created
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="success.main" gutterBottom>
                    {detailedInfo?.statistics?.successfulBackups || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Successful Backups
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="error.main" gutterBottom>
                    {detailedInfo?.statistics?.failedBackups || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Failed Backups
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose}>Close</Button>
        {onCreateBackupNow && (
          <Button
            variant="contained"
            startIcon={<FlashOnIcon />}
            onClick={handleCreateBackup}
            color="warning"
          >
            Create Backup Now
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ScheduleDetailsModal;
