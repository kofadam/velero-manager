import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api.ts';
import AddClusterModal from './AddClusterModal.tsx';
import './Clusters.css';

interface Cluster {
  name: string;
  backupCount: number;
  lastBackup: string;
}

const Clusters: React.FC = () => {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchClusters = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getClusters();
      setClusters(data.clusters || []);
    } catch (err) {
      setError('Failed to fetch clusters');
      console.error('Error fetching clusters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClusters();
  }, []);

  const getHealthStatus = (lastBackup: string, backupCount: number) => {
    if (!lastBackup) {
      // No backups yet, but cluster is configured
      return { label: 'Configured', className: 'status-healthy' };
    }
    
    const lastBackupDate = new Date(lastBackup);
    const hoursSinceBackup = (Date.now() - lastBackupDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceBackup < 25) return { label: 'Healthy', className: 'status-healthy' };
    if (hoursSinceBackup < 48) return { label: 'Warning', className: 'status-warning' };
    return { label: 'Critical', className: 'status-critical' };
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const filteredClusters = clusters.filter(cluster =>
    cluster.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="clusters-list">
      <div className="clusters-content">
        <div className="clusters-header">
          <input
            type="text"
            placeholder="Search clusters by name..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="search-input"
          />
          <button
            className="btn btn-secondary"
            onClick={fetchClusters}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            Add Cluster
          </button>
        </div>

        {loading && <div className="loading">Loading clusters...</div>}
        {error && <div className="error">Error: {error}</div>}

        {!loading && !error && (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cluster Name</th>
                  <th>API Endpoint</th>
                  <th>Storage Location</th>
                  <th className="text-center">Total Backups</th>
                  <th>Last Backup</th>
                  <th className="text-center">Health Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredClusters.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center">
                      No clusters found
                    </td>
                  </tr>
                ) : (
                  filteredClusters.map((cluster) => {
                    const health = getHealthStatus(cluster.lastBackup, cluster.backupCount);
                    return (
                      <tr key={cluster.name}>
                        <td>{cluster.name}</td>
                        <td>
                          <span className="text-muted">Not configured</span>
                        </td>
                        <td>{`${cluster.name}-storage`}</td>
                        <td className="text-center">{cluster.backupCount}</td>
                        <td>{formatDate(cluster.lastBackup)}</td>
                        <td className="text-center">
                          <span className={`status-badge ${health.className}`}>
                            {health.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {showAddModal && (
        <AddClusterModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchClusters();
          }}
        />
      )}
    </div>
  );
};

export default Clusters;