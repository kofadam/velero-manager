import React, { useState, useEffect } from 'react';
import ScheduleTable from './ScheduleTable.tsx';
import CreateScheduleModal from './CreateScheduleModal.tsx';
import { apiService } from '../../services/api.ts';
import './ScheduleList.css';

const ScheduleList: React.FC = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getSchedules();
      setSchedules(response.schedules || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch schedules');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleName: string) => {
    try {
      await apiService.deleteSchedule(scheduleName);
      await fetchSchedules(); // Refresh list
    } catch (err: any) {
      const errorMessage = err.response?.data?.details || err.message || 'Failed to delete schedule';
      alert(`❌ Failed to delete schedule:\n\n${errorMessage}`);
    }
  };

  const handleToggleSchedule = async (scheduleName: string, paused: boolean) => {
    try {
      await apiService.updateSchedule(scheduleName, { paused });
      await fetchSchedules(); // Refresh list
    } catch (err: any) {
      const errorMessage = err.response?.data?.details || err.message || 'Failed to update schedule';
      alert(`❌ Failed to update schedule:\n\n${errorMessage}`);
    }
  };

  const handleCreateBackupNow = async (scheduleName: string) => {
    if (window.confirm(`Create a backup now using schedule "${scheduleName}"?\n\nThis will create a manual backup using the schedule's configuration.`)) {
      try {
        const result = await apiService.createBackupFromSchedule(scheduleName);
        alert(`✅ Manual backup created successfully!\n\n📦 Backup: ${result.backup}\n📋 Schedule: ${result.schedule}\n\nThe backup is now running in the background.`);
        // Optionally refresh the list to show activity
        await fetchSchedules();
      } catch (err: any) {
        const errorMessage = err.response?.data?.details || err.message || 'Failed to create backup from schedule';
        alert(`❌ Failed to create backup:\n\n${errorMessage}`);
      }
    }
  };

  return (
    <div className="schedule-list">
      <div className="schedule-header">
        <div className="schedule-actions">
          <button 
            className="btn btn-primary"
            onClick={fetchSchedules}
            disabled={loading}
          >
            📋 List Schedules
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            ➕ Create Schedule
          </button>
        </div>
      </div>

      {loading && <div className="loading">Loading schedules...</div>}
      {error && <div className="error">Error: {error}</div>}
      
      {!loading && !error && (
        <ScheduleTable
          schedules={schedules}
          onDeleteSchedule={handleDeleteSchedule}
          onToggleSchedule={handleToggleSchedule}
          onCreateBackupNow={handleCreateBackupNow}
          onRefresh={fetchSchedules}
        />
      )}

      {showCreateModal && (
        <CreateScheduleModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchSchedules();
          }}
        />
      )}
    </div>
  );
};

export default ScheduleList;
