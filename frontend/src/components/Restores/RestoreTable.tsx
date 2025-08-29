import React, { useState } from 'react';
import { Restore } from '../../services/types.ts';
import RestoreActions from './RestoreActions.tsx';
import './RestoreTable.css';

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

  const getStatusColor = (phase: string) => {
    switch (phase.toLowerCase()) {
      case 'completed':
        return 'status-completed';
      case 'inprogress':
        return 'status-inprogress';
      case 'failed':
        return 'status-failed';
      case 'partiallyfailed':
        return 'status-partiallyfailed';
      default:
        return 'status-unknown';
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
    <div className="restore-table-container">
      <table className="restore-table">
        <thead>
          <tr>
            <th className="checkbox-col">
              <input
                type="checkbox"
                checked={allSelected}
                ref={input => {
                  if (input) input.indeterminate = someSelected;
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            </th>
            <th 
              className="sortable"
              onClick={() => handleSort('name')}
            >
              Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th 
              className="sortable"
              onClick={() => handleSort('cluster')}
            >
              Cluster {sortField === 'cluster' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th>Backup</th>
            <th 
              className="sortable"
              onClick={() => handleSort('creationTimestamp')}
            >
              Created {sortField === 'creationTimestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th
              className="sortable"
              onClick={() => handleSort('status')}
            >
              Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th>Errors</th>
            <th>Warnings</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedRestores.map((restore) => (
            <tr key={restore.name}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedRestores.includes(restore.name)}
                  onChange={(e) => onSelectRestore(restore.name, e.target.checked)}
                />
              </td>
              <td className="restore-name">{restore.name}</td>
              <td className="cluster-col">
                <span className="cluster-badge">{restore.cluster || 'UNKNOWN'}</span>
              </td>
              <td className="backup-name">{restore.spec.backupName}</td>
              <td className="timestamp">
                {formatTimestamp(restore.creationTimestamp)}
              </td>
              <td>
                <span className={`status ${getStatusColor(restore.status.phase)}`}>
                  {restore.status.phase}
                </span>
              </td>
              <td className="errors">
                {restore.status.errors || 0}
              </td>
              <td className="warnings">
                {restore.status.warnings || 0}
              </td>
              <td>
                <RestoreActions 
                  restore={restore}
                  onDelete={onDeleteRestore}
                  onRefresh={onRefresh}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {restores.length === 0 && (
        <div className="empty-state">
          <p>No restores found. Create your first restore to get started.</p>
        </div>
      )}
    </div>
  );
};

export default RestoreTable;
