export interface BackupStatus {
  phase: string;
  startTimestamp?: string;
  completionTimestamp?: string;
  expiration?: string;
  progress?: {
    itemsBackedUp: number;
    totalItems: number;
  };
  errors?: number;
  warnings?: number;
  validationErrors?: string[];
}

export interface BackupSpec {
  includedNamespaces?: string[];
  excludedNamespaces?: string[];
  storageLocation: string;
  ttl?: string;
}

export interface Backup {
  name: string;
  cluster: string;
  namespace: string;
  creationTimestamp: string;
  labels: Record<string, string>;
  status: BackupStatus;
  spec: BackupSpec;
}

export interface BackupsResponse {
  backups: Backup[];
  count: number;
}

export interface User {
  username: string;
  email?: string;
  fullName?: string;
  isAuthenticated: boolean;
  authMethod: 'basic' | 'oidc' | 'jwt' | 'session';
  role?: string;
  oidcRoles?: string[];
  oidcGroups?: string[];
}

export interface AuthConfig {
  oidcEnabled: boolean;
  legacyAuthEnabled: boolean;
  authenticated: boolean;
  user?: User;
}

export interface OIDCLoginResponse {
  authUrl: string;
  state: string;
}

export interface AuthResponse {
  username: string;
  email?: string;
  fullName?: string;
  role: string;
  roles?: string[];
  groups?: string[];
  token: string;
  sessionToken?: string;
  tokenType: string;
  authMethod: string;
  idToken?: string;
}

export interface RestoreStatus {
  phase: string;
  startTimestamp?: string;
  completionTimestamp?: string;
  progress?: {
    itemsRestored: number;
    totalItems: number;
  };
  errors?: number;
  warnings?: number;
  validationErrors?: string[];
}

export interface RestoreSpec {
  backupName: string;
  includedNamespaces?: string[];
  excludedNamespaces?: string[];
  namespaceMapping?: Record<string, string>;
  restorePVs?: boolean;
  includeClusterResources?: boolean;
}

export interface Restore {
  name: string;
  cluster: string;
  namespace: string;
  creationTimestamp: string;
  labels: Record<string, string>;
  status: RestoreStatus;
  spec: RestoreSpec;
}

export interface RestoresResponse {
  restores: Restore[];
  count: number;
}

// Multi-cluster types
export interface Cluster {
  name: string;
  backupCount: number;
  lastBackup: string | null;
}

export interface ClustersResponse {
  clusters: Cluster[];
  count: number;
}

export interface ClusterHealth {
  cluster: string;
  status: 'healthy' | 'no-backups' | 'error';
  backupCount: number;
  lastBackup: string | null;
}

export interface CronJobSpec {
  schedule: string;
  suspend: boolean;
  concurrencyPolicy: string;
  jobTemplate: any;
}

export interface CronJob {
  name: string;
  cluster: string;
  namespace: string;
  creationTimestamp: string;
  labels: Record<string, string>;
  spec: CronJobSpec;
  status: any;
}

export interface CronJobsResponse {
  cronjobs: CronJob[];
  count: number;
}

export interface ClusterMetrics {
  name: string;
  backups_total: number;
  backups_successful: number;
  backups_failed: number;
  last_backup_time?: string;
  status: 'healthy' | 'warning' | 'error';
}

export interface DashboardMetrics {
  clusters: ClusterMetrics[];
  total_backups: number;
  total_restores: number;
  total_schedules: number;
  recent_backups: number;
  recent_failures: number;
}

// Orchestration Types
export interface OrchestrationStatus {
  overall_status: string;
  total_clusters: number;
  healthy_clusters: number;
  active_schedules: number;
  recent_backups: number;
  last_update: string;
  clusters: ClusterOrchestrationInfo[];
  schedules: ScheduleInfo[];
  argocd_status: ArgocdApplicationStatus;
}

export interface ClusterOrchestrationInfo {
  name: string;
  status: string; // "healthy", "degraded", "unknown"
  last_backup?: string;
  next_scheduled?: string;
  token_status: string; // "valid", "expiring", "expired"
  token_expiry?: string;
  backup_count_24h: number;
  error_count_24h: number;
}

export interface ScheduleInfo {
  name: string;
  cluster_name: string;
  schedule: string;
  status: string; // "active", "suspended", "failed"
  last_execution?: string;
  next_execution?: string;
  success_count: number;
  failure_count: number;
  last_job_status: string;
}

export interface ArgocdApplicationStatus {
  app_name: string;
  sync_status: string; // "Synced", "OutOfSync", "Unknown"
  health_status: string; // "Healthy", "Degraded", "Suspended"
  last_sync?: string;
  sync_revision?: string;
  sync_path?: string;
}

export interface TokenRotationStatus {
  enabled: boolean;
  last_rotation?: string;
  next_rotation?: string;
  rotation_status: string; // "healthy", "overdue", "failed"
  clusters_rotated: number;
  failed_rotations?: string[];
}

export interface GitopsSyncStatus {
  overall_status: string;
  total_applications: number;
  synced: number;
  out_of_sync: number;
  healthy: number;
  last_sync: string;
  applications: ArgocdApplicationStatus[];
}
