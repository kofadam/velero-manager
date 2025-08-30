import axios from 'axios';
import { BackupsResponse, Backup, RestoresResponse, Restore } from './types.ts';
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
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, logout user
      authService.logout();
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
    const response = await api.get('/cronjobs');
    return response.data;
  },

  async createSchedule(scheduleConfig: any): Promise<any> {
    const response = await api.post('/schedules', scheduleConfig);
    return response.data;
  },

  async deleteSchedule(name: string): Promise<void> {
    await api.delete(`/cronjobs/${name}`);
  },
  async updateSchedule(name: string, updates: any): Promise<any> {
    const response = await api.put(`/cronjobs/${name}`, updates);
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
};
