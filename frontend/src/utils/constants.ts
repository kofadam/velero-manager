export const API_BASE_URL = 'http://localhost:8080/api/v1';

export const BACKUP_PHASES = {
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  IN_PROGRESS: 'InProgress',
  FAILED_VALIDATION: 'FailedValidation'
} as const;

export const ROUTES = {
  DASHBOARD: '/',
  BACKUPS: '/backups',
  RESTORE: '/restore',
  SCHEDULES: '/schedules',
  SETTINGS: '/settings'
} as const;
