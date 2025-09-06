import React from 'react';
import { Backup } from '../../services/types.ts';
import BackupActions from './BackupActions.tsx';
import { formatDateShort } from '../../utils/dateUtils.ts';
import { BACKUP_PHASES } from '../../utils/constants.ts';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Chip,
  Typography,
  Box,
  TableSortLabel,
  IconButton,
  Tooltip,
  Link,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';

interface BackupTableProps {
  backups: Backup[];
  selectedBackups: string[];
  onSelectBackup: (backupName: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onDeleteBackup: (backupName: string) => Promise<void>;
  onRefresh: () => void;
  onViewDetails: (backup: Backup) => void;
  onDownload: (backup: Backup) => void;
}

type SortField = 'name' | 'cluster' | 'status' | 'created';
type SortDirection = 'asc' | 'desc';

const BackupTable: React.FC<BackupTableProps> = ({
  backups,
  selectedBackups,
  onSelectBackup,
  onSelectAll,
  onDeleteBackup,
  onRefresh,
  onViewDetails,
  onDownload,
}) => {
  const [sortField, setSortField] = React.useState<SortField>('created');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');

  const allSelected = backups.length > 0 && selectedBackups.length === backups.length;
  const someSelected = selectedBackups.length > 0 && selectedBackups.length < backups.length;

  const getStatusColor = (phase: string): 'success' | 'info' | 'error' | 'warning' | 'default' => {
    switch (phase) {
      case BACKUP_PHASES.COMPLETED:
        return 'success';
      case BACKUP_PHASES.FAILED:
      case BACKUP_PHASES.FAILED_VALIDATION:
        return 'error';
      case BACKUP_PHASES.IN_PROGRESS:
        return 'info';
      default:
        return 'default';
    }
  };

  const getNamespaceDisplay = (namespaces?: string[]) => {
    if (!namespaces || namespaces.length === 0) return '<none>';
    if (namespaces.includes('*')) return 'All namespaces';
    if (namespaces.length === 1) return namespaces[0];
    return `${namespaces[0]} +${namespaces.length - 1} more`;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedBackups = [...backups].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'cluster':
        comparison = a.cluster.localeCompare(b.cluster);
        break;
      case 'status':
        comparison = a.status.phase.localeCompare(b.status.phase);
        break;
      case 'created':
        comparison =
          new Date(a.creationTimestamp).getTime() - new Date(b.creationTimestamp).getTime();
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <TableContainer component={Paper} elevation={2}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                sx={{ color: 'primary.main' }}
              />
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === 'name'}
                direction={sortField === 'name' ? sortDirection : 'asc'}
                onClick={() => handleSort('name')}
              >
                Name
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === 'cluster'}
                direction={sortField === 'cluster' ? sortDirection : 'asc'}
                onClick={() => handleSort('cluster')}
              >
                Cluster
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === 'status'}
                direction={sortField === 'status' ? sortDirection : 'asc'}
                onClick={() => handleSort('status')}
              >
                Status
              </TableSortLabel>
            </TableCell>
            <TableCell align="center">Errors</TableCell>
            <TableCell align="center">Warnings</TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === 'created'}
                direction={sortField === 'created' ? sortDirection : 'asc'}
                onClick={() => handleSort('created')}
              >
                Created
              </TableSortLabel>
            </TableCell>
            <TableCell>Expires</TableCell>
            <TableCell>Selector</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedBackups.map((backup) => (
            <TableRow
              key={backup.name}
              hover
              sx={{
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedBackups.includes(backup.name)}
                  onChange={(e) => onSelectBackup(backup.name, e.target.checked)}
                  sx={{ color: 'primary.main' }}
                />
              </TableCell>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => onViewDetails(backup)}
                    sx={{
                      fontWeight: 600,
                      color: 'primary.main',
                      textDecoration: 'none',
                      maxWidth: 180,
                      wordBreak: 'break-word',
                      cursor: 'pointer',
                      '&:hover': {
                        textDecoration: 'underline',
                        color: 'primary.dark',
                      },
                    }}
                  >
                    {backup.name}
                  </Link>
                  {backup.status.phase === BACKUP_PHASES.COMPLETED && (
                    <Tooltip title="Download backup">
                      <IconButton
                        size="small"
                        onClick={() => onDownload(backup)}
                        sx={{
                          opacity: 0.7,
                          '&:hover': { opacity: 1, color: 'success.main' },
                        }}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </TableCell>
              <TableCell>
                <Chip
                  label={backup.cluster}
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
                <Chip
                  label={backup.status.phase}
                  color={getStatusColor(backup.status.phase)}
                  size="small"
                  sx={{
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                    letterSpacing: '0.5px',
                  }}
                />
              </TableCell>
              <TableCell align="center">
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color:
                      (backup.status.validationErrors?.length || backup.status.errors || 0) > 0
                        ? 'error.main'
                        : 'text.secondary',
                  }}
                >
                  {backup.status.validationErrors?.length || backup.status.errors || 0}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: (backup.status.warnings || 0) > 0 ? 'warning.main' : 'text.secondary',
                  }}
                >
                  {backup.status.warnings || 0}
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
                  {formatDateShort(backup.creationTimestamp)}
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
                  {backup.status.expiration ? formatDateShort(backup.status.expiration) : '-'}
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
                  {getNamespaceDisplay(backup.spec.includedNamespaces)}
                </Typography>
              </TableCell>
              <TableCell>
                <BackupActions backup={backup} onDelete={onDeleteBackup} onRefresh={onRefresh} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {backups.length === 0 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 200,
            flexDirection: 'column',
          }}
        >
          <Typography color="text.secondary" variant="h6">
            No backups found
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Create your first backup to get started
          </Typography>
        </Box>
      )}
    </TableContainer>
  );
};

export default BackupTable;
