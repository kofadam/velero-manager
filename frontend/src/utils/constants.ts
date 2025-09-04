// Use backend server URL in development, relative path in production
export const API_BASE_URL =
  process.env.NODE_ENV === 'development' ? 'http://localhost:8080/api/v1' : '/api/v1';

// Version will be injected at build time
export const APP_VERSION = process.env.REACT_APP_VERSION || 'v2.3.0-dev';

export const BACKUP_PHASES = {
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  IN_PROGRESS: 'InProgress',
  FAILED_VALIDATION: 'FailedValidation',
} as const;

export const ROUTES = {
  DASHBOARD: '/',
  BACKUPS: '/backups',
  RESTORE: '/restore',
  SCHEDULES: '/schedules',
  SETTINGS: '/settings',
} as const;
