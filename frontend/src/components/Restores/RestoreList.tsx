import React, { useState, useEffect } from 'react';
import RestoreTable from './RestoreTable.tsx';
import CreateRestoreModal from './CreateRestoreModal.tsx';
import { useRestores } from '../../hooks/useRestores.ts';
import './RestoreList.css';

const RestoreList: React.FC = () => {
  const { restores, loading, error, refreshRestores, deleteRestore } = useRestores();
  const [selectedRestores, setSelectedRestores] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [clusterFilter, setClusterFilter] = useState('all');

  // Get unique clusters from restores
  const availableClusters = React.useMemo(() => {
    const clusters = Array.from(new Set(restores.map(restore => restore.cluster).filter(Boolean)));
    return clusters.sort();
  }, [restores]);

  const handleSelectRestore = (restoreName: string, selected: boolean) => {
    if (selected) {
      setSelectedRestores([...selectedRestores, restoreName]);
    } else {
      setSelectedRestores(selectedRestores.filter(name => name !== restoreName));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedRestores(restores.map(r => r.name));
    } else {
      setSelectedRestores([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (window.confirm(`Delete ${selectedRestores.length} selected restores?`)) {
      for (const restoreName of selectedRestores) {
        try {
          await deleteRestore(restoreName);
        } catch (error) {
          console.error(`Failed to delete restore ${restoreName}:`, error);
        }
      }
      setSelectedRestores([]);
    }
  };

  const handleCreateRestore = () => {
    setShowCreateModal(true);
  };

  const handleModalClose = () => {
    setShowCreateModal(false);
    refreshRestores();
  };

  const filteredRestores = restores.filter(restore => {
    // Search filter
    const matchesSearch = restore.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      restore.status.phase.toLowerCase().includes(searchFilter.toLowerCase()) ||
      restore.spec.backupName.toLowerCase().includes(searchFilter.toLowerCase());
    
    // Cluster filter
    const matchesCluster = clusterFilter === 'all' || restore.cluster === clusterFilter;
    
    return matchesSearch && matchesCluster;
  });

  if (loading) {
    return <div className="loading">Loading restores...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="restore-list">
      <div className="restore-list-header">
        <div className="restore-filters">
          <input
            type="text"
            placeholder="Search restores by name, status, or backup..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="search-input"
          />
          <select
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
            className="cluster-filter"
          >
            <option value="all">All Clusters</option>
            {availableClusters.map(cluster => (
              <option key={cluster} value={cluster}>{cluster}</option>
            ))}
          </select>
        </div>
        <div className="restore-actions">
          <button
            className="btn btn-secondary"
            onClick={refreshRestores}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleCreateRestore}
          >
            Create Restore
          </button>
          {selectedRestores.length > 0 && (
            <button 
              className="btn btn-danger"
              onClick={handleDeleteSelected}
            >
              Delete Selected ({selectedRestores.length})
            </button>
          )}
        </div>
      </div>
      
      <RestoreTable 
        restores={filteredRestores}
        selectedRestores={selectedRestores}
        onSelectRestore={handleSelectRestore}
        onSelectAll={handleSelectAll}
        onDeleteRestore={deleteRestore}
        onRefresh={refreshRestores}
      />

      {showCreateModal && (
        <CreateRestoreModal 
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default RestoreList;
