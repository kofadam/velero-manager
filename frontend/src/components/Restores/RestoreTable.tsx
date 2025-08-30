import React, { useState } from 'react';
import { Restore } from '../../services/types.ts';
import RestoreActions from './RestoreActions.tsx';
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
  TableSortLabel
} from '@mui/material';

type SortField = 'name' | 'cluster' | 'creationTimestamp' | 'status';
type SortDirection = 'asc' | 'desc';

interface RestoreTableProps {
  restores: Restore[];
  selectedRestores: string[];
  onSelectRestore: (restoreName: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onDeleteRestore: (name: string) => Promise<void>;
  onRefresh: () => void;
}

const RestoreTable: React.FC<RestoreTableProps> = ({
  restores,
  selectedRestores,
  onSelectRestore,
  onSelectAll,
  onDeleteRestore,
  onRefresh,
}) => {
  const [sortField, setSortField] = useState<SortField>('creationTimestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (phase: string): 'success' | 'info' | 'error' | 'warning' | 'default' => {
    switch (phase.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'inprogress':
        return 'info';
      case 'failed':
        return 'error';
      case 'partiallyfailed':
        return 'warning';
      default:
        return 'default';
    }
  };

  const sortedRestores = [...restores].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'status':
        comparison = a.status.phase.localeCompare(b.status.phase);
        break;
      case 'cluster':
        comparison = (a.cluster || '').localeCompare(b.cluster || '');
        break;
      case 'creationTimestamp':
        comparison = new Date(a.creationTimestamp).getTime() - new Date(b.creationTimestamp).getTime();
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const allSelected = restores.length > 0 && selectedRestores.length === restores.length;
  const someSelected = selectedRestores.length > 0 && selectedRestores.length < restores.length;

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
            <TableCell>Backup</TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === 'creationTimestamp'}
                direction={sortField === 'creationTimestamp' ? sortDirection : 'asc'}
                onClick={() => handleSort('creationTimestamp')}
              >
                Created
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
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRestores.map((restore) => (
            <TableRow 
              key={restore.name}
              hover
              sx={{ 
                '&:hover': { 
                  backgroundColor: 'action.hover',
                } 
              }}
            >
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedRestores.includes(restore.name)}
                  onChange={(e) => onSelectRestore(restore.name, e.target.checked)}
                  sx={{ color: 'primary.main' }}
                />
              </TableCell>
              <TableCell>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 600,
                    color: 'primary.main',
                    maxWidth: 200,
                    wordBreak: 'break-word'
                  }}
                >
                  {restore.name}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip 
                  label={restore.cluster || 'UNKNOWN'} 
                  size="small"
                  variant="outlined"
                  sx={{ 
                    backgroundColor: 'grey.100',
                    color: 'text.primary',
                    borderColor: 'grey.300'
                  }}
                />
              </TableCell>
              <TableCell>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    color: 'text.secondary'
                  }}
                >
                  {restore.spec.backupName}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'text.secondary',
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {formatTimestamp(restore.creationTimestamp)}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip 
                  label={restore.status.phase}
                  color={getStatusColor(restore.status.phase)}
                  size="small"
                  sx={{ 
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                    letterSpacing: '0.5px'
                  }}
                />
              </TableCell>
              <TableCell align="center">
                <Typography 
                  variant="body2"
                  sx={{ 
                    fontWeight: 600,
                    color: (restore.status.errors || 0) > 0 ? 'error.main' : 'text.secondary'
                  }}
                >
                  {restore.status.errors || 0}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Typography 
                  variant="body2"
                  sx={{ 
                    fontWeight: 600,
                    color: (restore.status.warnings || 0) > 0 ? 'warning.main' : 'text.secondary'
                  }}
                >
                  {restore.status.warnings || 0}
                </Typography>
              </TableCell>
              <TableCell>
                <RestoreActions 
                  restore={restore}
                  onDelete={onDeleteRestore}
                  onRefresh={onRefresh}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {restores.length === 0 && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: 200,
          flexDirection: 'column'
        }}>
          <Typography color="text.secondary" variant="h6">
            No restores found
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Create your first restore to get started
          </Typography>
        </Box>
      )}
    </TableContainer>
  );
};

export default RestoreTable;
