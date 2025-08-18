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

const BackupTable: React.FC<BackupTableProps> = ({
  backups,
  selectedBackups,
  onSelectBackup,
  onSelectAll,
  onDeleteBackup,
  onRefresh
}) => {
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
            <th>NAME</th>
            <th>STATUS</th>
            <th>ERRORS</th>
            <th>WARNINGS</th>
            <th>CREATED</th>
            <th>EXPIRES</th>
            <th>STORAGE LOCATION</th>
            <th>SELECTOR</th>
            <th>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {backups.map((backup) => (
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
              <td>
                <span className={`status ${getStatusClass(backup.status.phase)}`}>
                  {backup.status.phase}
                </span>
              </td>
              <td className="number-col">
                {backup.status.validationErrors?.length || backup.status.errors || 0}
              </td>
              <td className="number-col">
                {backup.status.warnings || 0}
              </td>
              <td className="date-col">
                {formatDateShort(backup.creationTimestamp)}
              </td>
              <td className="date-col">
                {backup.status.expiration ? formatDateShort(backup.status.expiration) : '-'}
              </td>
              <td>
                {backup.spec.storageLocation || 'default'}
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
