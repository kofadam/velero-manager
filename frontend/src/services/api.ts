import axios from 'axios';
import { BackupsResponse, Backup, RestoresResponse } from './types.ts';
import { API_BASE_URL } from '../utils/constants.ts';
import { authService } from './auth.ts';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include authentication headers
api.interceptors.request.use(
  (config) => {
    const token = authService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle authentication errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, logout user
      try {
        await authService.logout();
      } catch (logoutError) {
        console.error('Error during logout:', logoutError);
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  async getBackups(): Promise<BackupsResponse> {
    const response = await api.get<BackupsResponse>('/backups');
    return response.data;
  },

  async createBackup(backup: Partial<Backup>): Promise<Backup> {
    const response = await api.post<Backup>('/backups', backup);
    return response.data;
  },

  async deleteBackup(name: string): Promise<void> {
    await api.delete(`/backups/${name}`);
  },

  // Backup Details and Downloads
  async getBackupDetails(cluster: string, name: string) {
    const response = await api.get(`/backups/${name}/details`);
    return response.data;
  },

  async getBackupLogs(cluster: string, name: string) {
    const response = await api.get(`/backups/${name}/logs`);
    return response.data;
  },

  async downloadBackup(cluster: string, name: string) {
    try {
      const response = await api.get(`/backups/${name}/download`, {
        responseType: 'blob', // Important: tell axios to expect binary data
        timeout: 300000, // 5 minute timeout for large files
      });

      // Create a blob URL and trigger download
      const blob = new Blob([response.data], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);

      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}-data.tar.gz`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true, message: 'Download started successfully' };
    } catch (error: any) {
      // If it's not a blob response, it might be an error JSON
      if (error.response && error.response.data && error.response.data instanceof Blob) {
        // Try to parse blob as JSON for error message
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || 'Download failed');
        } catch {
          throw new Error('Download failed');
        }
      }
      throw error;
    }
  },

  async describeBackup(name: string): Promise<any> {
    const response = await api.get(`/backups/${name}/describe`);
    return response.data;
  },

  async createRestore(restoreConfig: any): Promise<any> {
    const response = await api.post('/restores', restoreConfig);
    return response.data;
  },

  async getRestores(): Promise<RestoresResponse> {
    const response = await api.get<RestoresResponse>('/restores');
    return response.data;
  },

  async deleteRestore(name: string): Promise<void> {
    await api.delete(`/restores/${name}`);
  },

  async getRestoreLogs(name: string): Promise<{ logs: string }> {
    const response = await api.get(`/restores/${name}/logs`);
    return response.data;
  },

  async describeRestore(name: string): Promise<any> {
    const response = await api.get(`/restores/${name}/describe`);
    return response.data;
  },

  async getSchedules(): Promise<any> {
    const response = await api.get('/schedules');
    return response.data;
  },

  async createSchedule(scheduleConfig: any): Promise<any> {
    const response = await api.post('/schedules', scheduleConfig);
    return response.data;
  },

  async deleteSchedule(name: string): Promise<void> {
    await api.delete(`/schedules/${name}`);
  },
  async updateSchedule(name: string, updates: any): Promise<any> {
    const response = await api.put(`/schedules/${name}`, updates);
    return response.data;
  },
  async createBackupFromSchedule(scheduleName: string): Promise<any> {
    const response = await api.post(`/cronjobs/${scheduleName}/trigger`);
    return response.data;
  },

  async getHealth(): Promise<{ status: string }> {
    const response = await api.get('/health');
    return response.data;
  },

  // Multi-cluster endpoints
  async getClusters(): Promise<any> {
    const response = await api.get('/clusters');
    return response.data;
  },

  async getClusterBackups(clusterName: string): Promise<BackupsResponse> {
    const response = await api.get<BackupsResponse>(`/clusters/${clusterName}/backups`);
    return response.data;
  },

  async getClusterHealth(clusterName: string): Promise<any> {
    const response = await api.get(`/clusters/${clusterName}/health`);
    return response.data;
  },

  async getClusterDetails(clusterName: string): Promise<any> {
    const response = await api.get(`/clusters/${clusterName}/details`);
    return response.data;
  },

  async getStorageLocations(): Promise<any> {
    const response = await api.get('/storage-locations');
    return response.data;
  },

  async createStorageLocation(location: any): Promise<any> {
    const response = await api.post('/storage-locations', location);
    return response.data;
  },

  async deleteStorageLocation(name: string): Promise<void> {
    await api.delete(`/storage-locations/${name}`);
  },
  async getCronJobs(): Promise<any> {
    const response = await api.get('/cronjobs');
    return response.data;
  },

  async getDashboardMetrics(): Promise<any> {
    const response = await api.get('/dashboard/metrics');
    return response.data;
  },

  async updateClusterDescription(clusterName: string, description: string): Promise<any> {
    const response = await api.put(`/clusters/${clusterName}/description`, { description });
    return response.data;
  },

  // Orchestration Management APIs
  async getOrchestrationStatus(): Promise<any> {
    const response = await api.get('/orchestration/status');
    return response.data;
  },

  async getClusterOrchestrationInfo(clusterName: string): Promise<any> {
    const response = await api.get(`/orchestration/clusters/${clusterName}`);
    return response.data;
  },

  async getTokenRotationStatus(): Promise<any> {
    const response = await api.get('/orchestration/tokens/status');
    return response.data;
  },

  async triggerTokenRotation(): Promise<any> {
    const response = await api.post('/orchestration/tokens/rotate');
    return response.data;
  },

  async triggerBackupSchedule(scheduleName: string): Promise<any> {
    const response = await api.post(`/orchestration/schedules/${scheduleName}/trigger`);
    return response.data;
  },

  // GitOps Management APIs
  async getGitopsApplications(): Promise<any> {
    const response = await api.get('/gitops/applications');
    return response.data;
  },

  async getGitopsApplicationStatus(appName: string): Promise<any> {
    const response = await api.get(`/gitops/applications/${appName}/status`);
    return response.data;
  },

  async syncGitopsApplication(appName: string): Promise<any> {
    const response = await api.post(`/gitops/applications/${appName}/sync`);
    return response.data;
  },

  async getGitopsSyncStatus(): Promise<any> {
    const response = await api.get('/gitops/sync-status');
    return response.data;
  },
};
