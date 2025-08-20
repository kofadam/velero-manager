import { useState, useEffect, useCallback } from 'react';
import { Restore, RestoresResponse } from '../services/types.ts';
import { apiService } from '../services/api.ts';

export const useRestores = () => {
  const [restores, setRestores] = useState<Restore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRestores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response: RestoresResponse = await apiService.getRestores();
      setRestores(response.restores || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch restores');
      setRestores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteRestore = useCallback(async (name: string) => {
    try {
      await apiService.deleteRestore(name);
      await fetchRestores(); // Refresh the list
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message || 'Failed to delete restore');
    }
  }, [fetchRestores]);

  const refreshRestores = useCallback(() => {
    fetchRestores();
  }, [fetchRestores]);

  useEffect(() => {
    fetchRestores();
  }, [fetchRestores]);

  return {
    restores,
    loading,
    error,
    refreshRestores,
    deleteRestore,
  };
};
