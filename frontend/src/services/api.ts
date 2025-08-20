import axios from 'axios';
import { BackupsResponse, Backup, RestoresResponse, Restore } from './types.ts';
import { API_BASE_URL } from '../utils/constants.ts';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
    const response = await api.post(`/schedules/${scheduleName}/backup`);
    return response.data;
  },

  async getHealth(): Promise<{ status: string }> {
    const response = await api.get('/health');
    return response.data;
  },
};
