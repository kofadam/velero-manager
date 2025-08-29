import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api.ts';
import { Cluster, ClusterHealth } from '../../services/types.ts';
import LoadingSpinner from '../Common/LoadingSpinner.tsx';
import './Dashboard.css';

interface DashboardStats {
  totalBackups: number;
  totalRestores: number;
  totalSchedules: number;
  failedBackups: number;
  failedRestores: number;
}

interface ClusterStats extends Cluster {
  health: ClusterHealth;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalBackups: 0,
    totalRestores: 0,
    totalSchedules: 0,
    failedBackups: 0,
    failedRestores: 0
  });
  const [clusters, setClusters] = useState<ClusterStats[]>([]);
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
      const [backupsRes, restoresRes, schedulesRes, clustersRes] = await Promise.all([
        apiService.getBackups(),
        apiService.getRestores(),
        apiService.getSchedules(),
        apiService.getClusters()
      ]);

      const backups = backupsRes.backups || [];
      const restores = restoresRes.restores || [];
      const schedules = schedulesRes.schedules || [];
      const clusterList = clustersRes.clusters || [];

      // Fetch health status for each cluster
      const clusterHealthPromises = clusterList.map(async (cluster: Cluster) => {
        try {
          const health = await apiService.getClusterHealth(cluster.name);
          return { ...cluster, health };
        } catch (err) {
          return { 
            ...cluster, 
            health: { 
              cluster: cluster.name, 
              status: 'error' as const, 
              backupCount: 0, 
              lastBackup: null 
            } 
          };
        }
      });

      const clustersWithHealth = await Promise.all(clusterHealthPromises);
      setClusters(clustersWithHealth);

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

      setRecentBackups(sortByDate([...backups]).slice(0, 5));
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
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Dashboard</h1>
          <button onClick={fetchDashboardData} className="refresh-button">
            <svg className="refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            Refresh
          </button>
        </div>

        <div className="dashboard-content">

      {/* Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-header">
                  <h3 className="stat-title">Total Backups</h3>
                  <div className="stat-icon backup-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                    </svg>
                  </div>
                </div>
                <div className="stat-value">{stats.totalBackups}</div>
                <div className="stat-change positive">
                  <svg className="stat-trend-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                  </svg>
                  {stats.failedBackups === 0 ? 'All successful' : `${stats.failedBackups} failed`}
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-header">
                  <h3 className="stat-title">Total Restores</h3>
                  <div className="stat-icon restore-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z"/>
                    </svg>
                  </div>
                </div>
                <div className="stat-value">{stats.totalRestores}</div>
                <div className="stat-change positive">
                  <svg className="stat-trend-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                  </svg>
                  {stats.failedRestores === 0 ? 'All successful' : `${stats.failedRestores} failed`}
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-header">
                  <h3 className="stat-title">Active Schedules</h3>
                  <div className="stat-icon schedule-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                </div>
                <div className="stat-value">{stats.totalSchedules}</div>
                <div className="stat-change neutral">
                  <svg className="stat-trend-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  Automated
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <div className="stat-header">
                  <h3 className="stat-title">Success Rate</h3>
                  <div className="stat-icon success-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                </div>
                <div className="stat-value">
                  {((stats.totalBackups - stats.failedBackups) / Math.max(stats.totalBackups, 1) * 100).toFixed(1)}%
                </div>
                <div className="stat-change positive">
                  <svg className="stat-trend-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                  </svg>
                  Excellent
                </div>
              </div>
            </div>
          </div>

      {/* Cluster Overview */}
          <div className="clusters-section">
            <div className="section-header">
              <h2 className="section-title">Managed Clusters</h2>
              <span className="section-subtitle">{clusters.length} active cluster{clusters.length !== 1 ? 's' : ''}</span>
            </div>
            {clusters.length > 0 ? (
              <div className="clusters-grid">
                {clusters.map((cluster) => (
                  <div key={cluster.name} className="cluster-card">
                    <div className="cluster-header">
                      <div className="cluster-info">
                        <h3 className="cluster-name">{cluster.name}</h3>
                        <div className={`cluster-status status-${cluster.health.status}`}>
                          <div className={`status-indicator ${cluster.health.status}`}></div>
                          <span className="status-text">{cluster.health.status}</span>
                        </div>
                      </div>
                    </div>
                    <div className="cluster-metrics">
                      <div className="metric">
                        <div className="metric-value">{cluster.health.backupCount || 0}</div>
                        <div className="metric-label">Total Backups</div>
                      </div>
                      <div className="metric">
                        <div className="metric-value">
                          {cluster.health.lastBackup ? 'Recent' : 'Never'}
                        </div>
                        <div className="metric-label">Last Activity</div>
                      </div>
                    </div>
                    {cluster.health.lastBackup && (
                      <div className="cluster-timestamp">
                        Last backup: {formatDate(cluster.health.lastBackup)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <p>No clusters configured</p>
              </div>
            )}
          </div>

      {/* Recent Activity */}
          <div className="recent-section">
            <div className="section-header">
              <h2 className="section-title">Recent Activity</h2>
              <span className="section-subtitle">Latest backup and restore operations</span>
            </div>
            <div className="recent-grid">
              <div className="recent-card">
                <div className="card-header">
                  <h3 className="card-title">Recent Backups</h3>
                  <div className="card-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                    </svg>
                  </div>
                </div>
                {recentBackups.length > 0 ? (
                  <div className="activity-list">
                    {recentBackups.map((backup) => (
                      <div key={backup.name} className="activity-item">
                        <div className="activity-content">
                          <div className="activity-name">{backup.name}</div>
                          <div className="activity-meta">
                            <span className="cluster-tag">{backup.cluster}</span>
                            <span className="activity-date">{formatDate(backup.creationTimestamp)}</span>
                          </div>
                        </div>
                        <div className={`activity-status ${getStatusClass(backup.status?.phase)}`}>
                          {backup.status?.phase || 'Unknown'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">No recent backups</div>
                )}
              </div>

              <div className="recent-card">
                <div className="card-header">
                  <h3 className="card-title">Recent Restores</h3>
                  <div className="card-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z"/>
                    </svg>
                  </div>
                </div>
                {recentRestores.length > 0 ? (
                  <div className="activity-list">
                    {recentRestores.map((restore) => (
                      <div key={restore.name} className="activity-item">
                        <div className="activity-content">
                          <div className="activity-name">{restore.name}</div>
                          <div className="activity-meta">
                            <span className="activity-date">{formatDate(restore.creationTimestamp)}</span>
                          </div>
                        </div>
                        <div className={`activity-status ${getStatusClass(restore.status?.phase)}`}>
                          {restore.status?.phase || 'Unknown'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">No recent restores</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
