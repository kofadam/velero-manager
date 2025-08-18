import axios from 'axios';
import { BackupsResponse, Backup } from './types.ts';
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

  async getHealth(): Promise<{ status: string }> {
    const response = await api.get('/health');
    return response.data;
  },
};
