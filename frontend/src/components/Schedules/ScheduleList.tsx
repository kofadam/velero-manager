import React, { useState, useEffect } from 'react';
import ScheduleTable from './ScheduleTable.tsx';
import CreateScheduleModal from './CreateScheduleModal.tsx';
import ScheduleDetailsModal from './ScheduleDetailsModal.tsx';
import { apiService } from '../../services/api.ts';
import { Box, Button, CircularProgress, Alert, Paper, Typography } from '@mui/material';
import { Refresh, Add } from '@mui/icons-material';

const ScheduleList: React.FC = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getSchedules();
      setSchedules(response.cronjobs || response.schedules || []);
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
      const errorMessage =
        err.response?.data?.details || err.message || 'Failed to delete schedule';
      alert(`❌ Failed to delete schedule:\n\n${errorMessage}`);
    }
  };

  const handleToggleSchedule = async (scheduleName: string, paused: boolean) => {
    try {
      await apiService.updateSchedule(scheduleName, { suspend: paused });
      await fetchSchedules(); // Refresh list
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.details || err.message || 'Failed to update schedule';
      alert(`❌ Failed to update schedule:\n\n${errorMessage}`);
    }
  };

  const handleCreateBackupNow = async (scheduleName: string) => {
    if (
      window.confirm(
        `Create a backup now using schedule "${scheduleName}"?\n\nThis will create a manual backup using the schedule's configuration.`
      )
    ) {
      try {
        const result = await apiService.createBackupFromSchedule(scheduleName);
        alert(
          `✅ Manual backup created successfully!\n\n📦 Backup: ${result.backup}\n📋 Schedule: ${result.schedule}\n\nThe backup is now running in the background.`
        );
        // Optionally refresh the list to show activity
        await fetchSchedules();
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.details || err.message || 'Failed to create backup from schedule';
        alert(`❌ Failed to create backup:\n\n${errorMessage}`);
      }
    }
  };

  const handleViewDetails = (schedule: any) => {
    setSelectedSchedule(schedule);
    setShowDetailsModal(true);
  };

  const handleEdit = (schedule: any) => {
    setSelectedSchedule(schedule);
    setShowEditModal(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 1,
            mb: 3,
          }}
        >
          <Button
            variant="outlined"
            onClick={fetchSchedules}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button variant="contained" onClick={() => setShowCreateModal(true)} startIcon={<Add />}>
            Create Schedule
          </Button>
        </Box>

        {loading && (
          <Box
            sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}
          >
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Loading schedules...</Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Error: {error}
          </Alert>
        )}

        {!loading && !error && (
          <ScheduleTable
            schedules={schedules}
            onDeleteSchedule={handleDeleteSchedule}
            onToggleSchedule={handleToggleSchedule}
            onCreateBackupNow={handleCreateBackupNow}
            onRefresh={fetchSchedules}
            onViewDetails={handleViewDetails}
            onEdit={handleEdit}
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

        {showEditModal && selectedSchedule && (
          <CreateScheduleModal
            schedule={selectedSchedule}
            onClose={() => {
              setShowEditModal(false);
              setSelectedSchedule(null);
            }}
            onSuccess={() => {
              setShowEditModal(false);
              setSelectedSchedule(null);
              fetchSchedules();
            }}
          />
        )}

        <ScheduleDetailsModal
          open={showDetailsModal}
          schedule={selectedSchedule}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedSchedule(null);
          }}
          onToggleSchedule={handleToggleSchedule}
          onCreateBackupNow={handleCreateBackupNow}
        />
      </Paper>
    </Box>
  );
};

export default ScheduleList;
