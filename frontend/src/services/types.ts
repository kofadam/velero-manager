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
  isAuthenticated: boolean;
  authMethod: 'basic' | 'oidc';
}

export interface AuthConfig {
  oidcEnabled: boolean;
  oidcUrl?: string;
  realm?: string;
  clientId?: string;
}
