import React from 'react';
import { Backup } from '../../services/types.ts';
import BackupActions from './BackupActions.tsx';
import { formatDate, formatDateShort } from '../../utils/dateUtils.ts';
import { BACKUP_PHASES } from '../../utils/constants.ts';
import './BackupTable.css';

interface BackupTableProps {
  backups: Backup[];
  selectedBackups: string[];
  onSelectBackup: (backupName: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onDeleteBackup: (backupName: string) => Promise<void>;
  onRefresh: () => void;
}

type SortField = 'name' | 'cluster' | 'status' | 'created';
type SortDirection = 'asc' | 'desc';

const BackupTable: React.FC<BackupTableProps> = ({
  backups,
  selectedBackups,
  onSelectBackup,
  onSelectAll,
  onDeleteBackup,
  onRefresh
}) => {
  const [sortField, setSortField] = React.useState<SortField>('created');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');
  
  const allSelected = backups.length > 0 && selectedBackups.length === backups.length;
  const someSelected = selectedBackups.length > 0 && selectedBackups.length < backups.length;

  const getStatusClass = (phase: string) => {
    switch (phase) {
      case BACKUP_PHASES.COMPLETED:
        return 'status-completed';
      case BACKUP_PHASES.FAILED:
      case BACKUP_PHASES.FAILED_VALIDATION:
        return 'status-failed';
      case BACKUP_PHASES.IN_PROGRESS:
        return 'status-in-progress';
      default:
        return 'status-unknown';
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
        comparison = new Date(a.creationTimestamp).getTime() - new Date(b.creationTimestamp).getTime();
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="backup-table-container">
      <table className="backup-table">
        <thead>
          <tr>
            <th className="select-col">
              <input
                type="checkbox"
                checked={allSelected}
                ref={input => {
                  if (input) input.indeterminate = someSelected;
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            </th>
            <th className="sortable" onClick={() => handleSort('name')}>
              NAME {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th className="sortable" onClick={() => handleSort('cluster')}>
              CLUSTER {sortField === 'cluster' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th className="sortable" onClick={() => handleSort('status')}>
              STATUS {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th>ERRORS</th>
            <th>WARNINGS</th>
            <th className="sortable" onClick={() => handleSort('created')}>
              CREATED {sortField === 'created' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th>EXPIRES</th>
            <th>SELECTOR</th>
            <th>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {sortedBackups.map((backup) => (
            <tr key={backup.name}>
              <td className="select-col">
                <input
                  type="checkbox"
                  checked={selectedBackups.includes(backup.name)}
                  onChange={(e) => onSelectBackup(backup.name, e.target.checked)}
                />
              </td>
              <td className="name-col">
                <span className="backup-name">{backup.name}</span>
              </td>
              <td className="cluster-col">
                <span className="cluster-badge">{backup.cluster}</span>
              </td>
              <td>
                <span className={`status ${getStatusClass(backup.status.phase)}`}>
                  {backup.status.phase}
                </span>
              </td>
              <td className="number-col">
                <span className={backup.status.errors || backup.status.validationErrors?.length ? 'error-count' : ''}>
                  {backup.status.validationErrors?.length || backup.status.errors || 0}
                </span>
              </td>
              <td className="number-col">
                <span className={backup.status.warnings ? 'warning-count' : ''}>
                  {backup.status.warnings || 0}
                </span>
              </td>
              <td className="date-col">
                {formatDateShort(backup.creationTimestamp)}
              </td>
              <td className="date-col">
                {backup.status.expiration ? formatDateShort(backup.status.expiration) : '-'}
              </td>
              <td className="selector-col">
                {getNamespaceDisplay(backup.spec.includedNamespaces)}
              </td>
              <td className="actions-col">
                <BackupActions
                  backup={backup}
                  onDelete={onDeleteBackup}
                  onRefresh={onRefresh}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {backups.length === 0 && (
        <div className="empty-state">
          <p>No backups found</p>
          <p>Create your first backup to get started</p>
        </div>
      )}
    </div>
  );
};

export default BackupTable;
