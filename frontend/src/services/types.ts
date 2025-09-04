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
