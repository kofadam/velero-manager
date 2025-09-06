import React from 'react';
import { translateCronExpression } from '../../utils/cronUtils.ts';
import { formatDateShort } from '../../utils/dateUtils.ts';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  Box,
  IconButton,
  Tooltip,
  Link,
} from '@mui/material';
import { PlayArrow, Pause, Edit, Delete, FlashOn } from '@mui/icons-material';

interface ScheduleTableProps {
  schedules: any[];
  onDeleteSchedule: (scheduleName: string) => Promise<void>;
  onToggleSchedule: (scheduleName: string, paused: boolean) => Promise<void>;
  onCreateBackupNow: (scheduleName: string) => Promise<void>;
  onRefresh: () => void;
  onViewDetails: (schedule: any) => void;
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({
  schedules,
  onDeleteSchedule,
  onToggleSchedule,
  onCreateBackupNow,
  onRefresh,
  onViewDetails,
}) => {
  const getScheduleStatus = (
    schedule: any
  ): { status: string; color: 'success' | 'info' | 'error' | 'warning' | 'default' } => {
    const isSuspended = schedule.spec?.suspend === true;
    const hasValidationErrors = schedule.status?.validationErrors?.length > 0;

    if (hasValidationErrors) {
      return { status: 'Error', color: 'error' };
    }
    if (isSuspended) {
      return { status: 'Paused', color: 'warning' };
    }
    return { status: 'Active', color: 'success' };
  };

  const getLastBackupInfo = (schedule: any): string => {
    const lastBackup = schedule.status?.lastBackup;
    if (!lastBackup) return 'No backups yet';

    try {
      const date = new Date(lastBackup);
      return formatDateShort(date.toISOString());
    } catch {
      return 'Invalid date';
    }
  };

  const handleDelete = async (scheduleName: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete schedule "${scheduleName}"?\n\nThis will stop all future automated backups for this schedule.`
      )
    ) {
      try {
        await onDeleteSchedule(scheduleName);
        onRefresh();
      } catch (error) {
        console.error('Failed to delete schedule:', error);
      }
    }
  };

  const handleToggle = async (scheduleName: string, currentlyPaused: boolean) => {
    const action = currentlyPaused ? 'enable' : 'pause';
    if (window.confirm(`Are you sure you want to ${action} schedule "${scheduleName}"?`)) {
      try {
        await onToggleSchedule(scheduleName, !currentlyPaused);
        onRefresh();
      } catch (error) {
        console.error(`Failed to ${action} schedule:`, error);
      }
    }
  };

  if (schedules.length === 0) {
    return (
      <TableContainer component={Paper} elevation={2}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 400,
            flexDirection: 'column',
            p: 4,
          }}
        >
          <Typography variant="h2" sx={{ mb: 2, opacity: 0.5 }}>
            ⏰
          </Typography>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
            No Backup Schedules
          </Typography>
          <Typography color="text.secondary" variant="body1" sx={{ mb: 3, textAlign: 'center' }}>
            Create your first backup schedule to automate regular backups
          </Typography>
          <Box sx={{ textAlign: 'left', mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              💡 Schedule Ideas:
            </Typography>
            <Box component="ul" sx={{ pl: 2, '& li': { mb: 1 } }}>
              <li>
                <Typography variant="body2">
                  🌙 <strong>Daily at 2 AM</strong> - For critical daily backups
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  🏢 <strong>Weekdays at 6 PM</strong> - For business applications
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  📅 <strong>Weekly on Sunday</strong> - For less critical data
                </Typography>
              </li>
            </Box>
          </Box>
        </Box>
      </TableContainer>
    );
  }

  return (
    <TableContainer component={Paper} elevation={2}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Cluster</TableCell>
            <TableCell>Schedule</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Last Backup</TableCell>
            <TableCell>Namespaces</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {schedules.map((schedule) => {
            const statusInfo = getScheduleStatus(schedule);
            const isSuspended = schedule.spec?.suspend === true;
            const cronExpression = schedule.spec?.schedule || '';
            const cronDescription = translateCronExpression(cronExpression);

            return (
              <TableRow
                key={schedule.name}
                hover
                sx={{
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => onViewDetails(schedule)}
                      sx={{
                        fontWeight: 600,
                        color: 'primary.main',
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline',
                          color: 'primary.dark',
                        },
                      }}
                    >
                      {schedule.name}
                    </Link>
                    {isSuspended && (
                      <Chip
                        label="PAUSED"
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ fontSize: '0.625rem', height: '20px' }}
                      />
                    )}
                  </Box>
                </TableCell>

                <TableCell>
                  <Chip
                    label={schedule.cluster || 'unknown'}
                    size="small"
                    variant="outlined"
                    sx={{
                      backgroundColor: 'background.paper',
                      color: 'text.primary',
                      borderColor: 'divider',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  />
                </TableCell>

                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      backgroundColor: 'action.hover',
                      color: 'text.primary',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      fontSize: '0.75rem',
                    }}
                  >
                    {cronExpression}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {cronDescription}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Chip
                    label={statusInfo.status}
                    color={statusInfo.color}
                    size="small"
                    sx={{
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                      letterSpacing: '0.5px',
                    }}
                  />
                </TableCell>

                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getLastBackupInfo(schedule)}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      maxWidth: 150,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {schedule.spec?.template?.includedNamespaces?.join(', ') || 'All namespaces'}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDateShort(schedule.creationTimestamp)}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Create Backup Now">
                      <IconButton
                        size="small"
                        onClick={() => onCreateBackupNow(schedule.name)}
                        sx={{ color: 'warning.main' }}
                      >
                        <FlashOn fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title={isSuspended ? 'Resume Schedule' : 'Pause Schedule'}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggle(schedule.name, isSuspended)}
                        sx={{ color: isSuspended ? 'success.main' : 'warning.main' }}
                      >
                        {isSuspended ? <PlayArrow fontSize="small" /> : <Pause fontSize="small" />}
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Edit Schedule">
                      <IconButton
                        size="small"
                        onClick={() => alert('Edit functionality coming soon!')}
                        sx={{ color: 'info.main' }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Delete Schedule">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(schedule.name)}
                        sx={{ color: 'error.main' }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ScheduleTable;
