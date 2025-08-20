import React, { useState, useEffect } from 'react';
import RestoreTable from './RestoreTable.tsx';
import CreateRestoreModal from './CreateRestoreModal.tsx';
import { useRestores } from '../../hooks/useRestores.ts';
import './RestoreList.css';

const RestoreList: React.FC = () => {
  const { restores, loading, error, refreshRestores, deleteRestore } = useRestores();
  const [selectedRestores, setSelectedRestores] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  if (loading) {
    return <div className="loading">Loading restores...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="restore-list">
      <div className="restore-list-header">
        <h1>Restores</h1>
        <div className="restore-actions">
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
        restores={restores}
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
