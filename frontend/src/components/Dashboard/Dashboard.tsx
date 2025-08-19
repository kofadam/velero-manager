import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api.ts';
import LoadingSpinner from '../Common/LoadingSpinner.tsx';
import './Dashboard.css';

interface DashboardStats {
  totalBackups: number;
  totalRestores: number;
  totalSchedules: number;
  failedBackups: number;
  failedRestores: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalBackups: 0,
    totalRestores: 0,
    totalSchedules: 0,
    failedBackups: 0,
    failedRestores: 0
  });
  const [recentBackups, setRecentBackups] = useState<any[]>([]);
  const [recentRestores, setRecentRestores] = useState<any[]>([]);
  const [recentSchedules, setRecentSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [backupsRes, restoresRes, schedulesRes] = await Promise.all([
        apiService.getBackups(),
        apiService.getRestores(),
        apiService.getSchedules()
      ]);

      const backups = backupsRes.backups || [];
      const restores = restoresRes.restores || [];
      const schedules = schedulesRes.schedules || [];

      // Calculate stats
      const failedBackups = backups.filter((b: any) => 
        b.status?.phase === 'Failed' || b.status?.phase === 'FailedValidation'
      ).length;
      
      const failedRestores = restores.filter((r: any) => 
        r.status?.phase === 'Failed'
      ).length;

      setStats({
        totalBackups: backups.length,
        totalRestores: restores.length,
        totalSchedules: schedules.length,
        failedBackups,
        failedRestores
      });

      // Get recent items (last 3, sorted by creation time)
      const sortByDate = (items: any[]) => 
        items.sort((a, b) => new Date(b.creationTimestamp).getTime() - new Date(a.creationTimestamp).getTime());

      setRecentBackups(sortByDate([...backups]).slice(0, 3));
      setRecentRestores(sortByDate([...restores]).slice(0, 3));
      setRecentSchedules(sortByDate([...schedules]).slice(0, 3));

    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' + 
           new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusClass = (phase: string) => {
    switch (phase) {
      case 'Completed':
        return 'status-success';
      case 'Failed':
      case 'FailedValidation':
        return 'status-failed';
      case 'InProgress':
        return 'status-in-progress';
      default:
        return 'status-unknown';
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <LoadingSpinner size="large" />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h3>❌ Error loading dashboard</h3>
        <p>{error}</p>
        <button onClick={fetchDashboardData} className="retry-btn">
          🔄 Retry
        </button>
      </div>
    );
  }

  const hasAlerts = stats.failedBackups > 0 || stats.failedRestores > 0;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>📊 Dashboard</h1>
        <button onClick={fetchDashboardData} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {/* Alerts Section */}
      {hasAlerts && (
        <div className="alerts-section">
          <h2>⚠️ Alerts & Warnings</h2>
          <div className="alerts-grid">
            {stats.failedBackups > 0 && (
              <div className="alert alert-error">
                <div className="alert-icon">❌</div>
                <div className="alert-content">
                  <strong>Failed Backups</strong>
                  <p>{stats.failedBackups} backup{stats.failedBackups > 1 ? 's' : ''} failed or failed validation</p>
                </div>
              </div>
            )}
            {stats.failedRestores > 0 && (
              <div className="alert alert-error">
                <div className="alert-icon">❌</div>
                <div className="alert-content">
                  <strong>Failed Restores</strong>
                  <p>{stats.failedRestores} restore{stats.failedRestores > 1 ? 's' : ''} failed</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="stats-section">
        <h2>📈 Overview</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">💾</div>
            <div className="stat-content">
              <div className="stat-number">{stats.totalBackups}</div>
              <div className="stat-label">Total Backups</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔄</div>
            <div className="stat-content">
              <div className="stat-number">{stats.totalRestores}</div>
              <div className="stat-label">Total Restores</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏰</div>
            <div className="stat-content">
              <div className="stat-number">{stats.totalSchedules}</div>
              <div className="stat-label">Schedules</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <div className="stat-number">
                {((stats.totalBackups - stats.failedBackups) / Math.max(stats.totalBackups, 1) * 100).toFixed(1)}%
              </div>
              <div className="stat-label">Success Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Tables */}
      <div className="recent-section">
        <div className="recent-grid">
          {/* Recent Backups */}
          <div className="recent-card">
            <h3>💾 Recent Backups</h3>
            {recentBackups.length > 0 ? (
              <table className="recent-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBackups.map((backup) => (
                    <tr key={backup.name}>
                      <td className="name-col">{backup.name}</td>
                      <td>
                        <span className={`status ${getStatusClass(backup.status?.phase)}`}>
                          {backup.status?.phase || 'Unknown'}
                        </span>
                      </td>
                      <td className="date-col">{formatDate(backup.creationTimestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">No recent backups</div>
            )}
          </div>

          {/* Recent Restores */}
          <div className="recent-card">
            <h3>🔄 Recent Restores</h3>
            {recentRestores.length > 0 ? (
              <table className="recent-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRestores.map((restore) => (
                    <tr key={restore.name}>
                      <td className="name-col">{restore.name}</td>
                      <td>
                        <span className={`status ${getStatusClass(restore.status?.phase)}`}>
                          {restore.status?.phase || 'Unknown'}
                        </span>
                      </td>
                      <td className="date-col">{formatDate(restore.creationTimestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">No recent restores</div>
            )}
          </div>

          {/* Recent Schedules */}
          <div className="recent-card">
            <h3>⏰ Recent Schedules</h3>
            {recentSchedules.length > 0 ? (
              <table className="recent-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Schedule</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSchedules.map((schedule) => (
                    <tr key={schedule.name}>
                      <td className="name-col">{schedule.name}</td>
                      <td>{schedule.spec?.schedule || 'N/A'}</td>
                      <td className="date-col">{formatDate(schedule.creationTimestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">No schedules configured</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
