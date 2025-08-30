import React from 'react';
import { translateCronExpression } from '../../utils/cronUtils.ts';
import { formatDate, formatDateShort } from '../../utils/dateUtils.ts';
import './ScheduleTable.css';

interface ScheduleTableProps {
  schedules: any[];
  onDeleteSchedule: (scheduleName: string) => Promise<void>;
  onToggleSchedule: (scheduleName: string, paused: boolean) => Promise<void>;
  onCreateBackupNow: (scheduleName: string) => Promise<void>;
  onRefresh: () => void;
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({
  schedules,
  onDeleteSchedule,
  onToggleSchedule,
  onCreateBackupNow,
  onRefresh
}) => {
  const getNextRunTime = (cronExpression: string): string => {
    // This is a simplified calculation - in real implementation you'd use a proper cron library
    // For now, we'll just show a placeholder
    return 'Next run: TBD';
  };

  const getScheduleStatus = (schedule: any): { status: string; className: string } => {
    const isSuspended = schedule.spec?.suspend === true;
    const hasValidationErrors = schedule.status?.validationErrors?.length > 0;
    
    if (hasValidationErrors) {
      return { status: 'Error', className: 'status-error' };
    }
    if (isSuspended) {
      return { status: 'Paused', className: 'status-paused' };
    }
    return { status: 'Active', className: 'status-active' };
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
    if (window.confirm(`Are you sure you want to delete schedule "${scheduleName}"?\n\nThis will stop all future automated backups for this schedule.`)) {
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
      <div className="schedule-table-container">
        <div className="empty-state">
          <div className="empty-icon">⏰</div>
          <h3>No Backup Schedules</h3>
          <p>Create your first backup schedule to automate regular backups</p>
          <div className="empty-suggestions">
            <h4>💡 Schedule Ideas:</h4>
            <ul>
              <li>🌙 <strong>Daily at 2 AM</strong> - For critical daily backups</li>
              <li>🏢 <strong>Weekdays at 6 PM</strong> - For business applications</li>
              <li>📅 <strong>Weekly on Sunday</strong> - For less critical data</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-table-container">
      <table className="schedule-table">
        <thead>
          <tr>
            <th>NAME</th>
            <th>CLUSTER</th>
            <th>SCHEDULE</th>
            <th>DESCRIPTION</th>
            <th>STATUS</th>
            <th>LAST BACKUP</th>
            <th>NAMESPACES</th>
            <th>CREATED</th>
            <th>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => {
            const statusInfo = getScheduleStatus(schedule);
            const isSuspended = schedule.spec?.suspend === true;
            const cronExpression = schedule.spec?.schedule || '';
            const cronDescription = translateCronExpression(cronExpression);

            return (
              <tr key={schedule.name}>
                <td className="name-col">
                  <div className="schedule-name">
                    <span className="name-text">{schedule.name}</span>
                    {isSuspended && <span className="paused-badge">PAUSED</span>}
                  </div>
                </td>
                
                <td className="cluster-col">
                  <span className="cluster-badge">{schedule.cluster || 'unknown'}</span>
                </td>
                
                <td className="schedule-col">
                  <div className="schedule-info">
                    <code className="cron-expression">{cronExpression}</code>
                  </div>
                </td>
                
                <td className="description-col">
                  <div className="schedule-description">
                    {cronDescription}
                  </div>
                </td>
                
                <td>
                  <span className={`status ${statusInfo.className}`}>
                    {statusInfo.status}
                  </span>
                </td>
                
                <td className="date-col">
                  {getLastBackupInfo(schedule)}
                </td>
                
                <td className="namespaces-col">
                  {schedule.spec?.template?.includedNamespaces?.join(', ') || 'All namespaces'}
                </td>
                
                <td className="date-col">
                  {formatDateShort(schedule.creationTimestamp)}
                </td>
                
                <td className="actions-col">
                  <div className="schedule-actions">
                    <button
                      className="action-btn backup-now-btn"
                      onClick={() => onCreateBackupNow(schedule.name)}
                      title="Create Backup Now"
                    >
                      ⚡
                    </button>
                    
                    <button
                      className={`action-btn ${isSuspended ? 'enable-btn' : 'pause-btn'}`}
                      onClick={() => handleToggle(schedule.name, isSuspended)}
                      title={isSuspended ? 'Resume Schedule' : 'Pause Schedule'}
                    >
                      {isSuspended ? '▶️' : '⏸️'}
                    </button>
                    
                    <button
                      className="action-btn edit-btn"
                      onClick={() => alert('Edit functionality coming soon!')}
                      title="Edit Schedule"
                    >
                      ✏️
                    </button>
                    
                    <button
                      className="action-btn delete-btn"
                      onClick={() => handleDelete(schedule.name)}
                      title="Delete Schedule"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleTable;
