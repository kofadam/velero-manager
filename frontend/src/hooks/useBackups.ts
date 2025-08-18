import { useState, useEffect, useCallback } from 'react';
import { Backup, BackupsResponse } from '../services/types.ts';
import { apiService } from '../services/api.ts';

export const useBackups = () => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response: BackupsResponse = await apiService.getBackups();
      setBackups(response.backups || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch backups');
      setBackups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteBackup = useCallback(async (backupName: string) => {
    await apiService.deleteBackup(backupName);
  }, []);

  const refreshBackups = useCallback(() => {
    fetchBackups();
  }, [fetchBackups]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  return {
    backups,
    loading,
    error,
    refreshBackups,
    deleteBackup,
  };
};
