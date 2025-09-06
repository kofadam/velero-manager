import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api.ts';
import UserManagement from './UserManagement.tsx';
import OIDCSettings from './OIDCSettings.tsx';
import StorageLocationDetailsModal from './StorageLocationDetailsModal.tsx';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Link,
  FormControlLabel,
  Checkbox,
  Divider,
} from '@mui/material';
import {
  Refresh,
  Add,
  Close,
  Delete,
  Settings as SettingsIcon,
  People,
  Storage,
  Security,
} from '@mui/icons-material';

interface StorageLocation {
  name: string;
  namespace: string;
  spec: {
    provider: string;
    default?: boolean;
    objectStorage: {
      bucket: string;
      region?: string;
      prefix?: string;
    };
    config?: Record<string, string>;
    credential?: {
      name: string;
      key: string;
    };
  };
  status?: {
    phase: string;
    message?: string;
    lastSyncedTime?: string;
  };
}

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('storage');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedStorageLocation, setSelectedStorageLocation] = useState<StorageLocation | null>(
    null
  );
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    provider: 'aws',
    bucket: '',
    prefix: '',
    s3Url: '',
    region: 'minio',
    s3ForcePathStyle: 'true',
    caCertificate: '',
    accessKeyId: '',
    secretAccessKey: '',
    useCredentials: false,
  });

  useEffect(() => {
    fetchStorageLocations();
  }, []);

  const fetchStorageLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getStorageLocations();
      setStorageLocations(response.locations || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch storage locations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const config: Record<string, string> = {
        region: formData.region,
        s3ForcePathStyle: formData.s3ForcePathStyle,
      };

      if (formData.s3Url) {
        config.s3Url = formData.s3Url;
      }

      if (formData.caCertificate) {
        config.caCertificate = formData.caCertificate;
      }

      const credentials = formData.useCredentials
        ? {
            accessKeyId: formData.accessKeyId,
            secretAccessKey: formData.secretAccessKey,
          }
        : undefined;

      await apiService.createStorageLocation({
        name: formData.name,
        provider: formData.provider,
        bucket: formData.bucket,
        prefix: formData.prefix,
        config,
        credentials,
      });

      setShowCreateModal(false);
      setFormData({
        name: '',
        provider: 'aws',
        bucket: '',
        prefix: '',
        s3Url: '',
        region: 'minio',
        s3ForcePathStyle: 'true',
        caCertificate: '',
        accessKeyId: '',
        secretAccessKey: '',
        useCredentials: false,
      });
      fetchStorageLocations();
    } catch (err: any) {
      alert(`Failed to create storage location: ${err.message}`);
    }
  };

  const handleDeleteLocation = async (name: string) => {
    if (window.confirm(`Delete storage location "${name}"?`)) {
      try {
        await apiService.deleteStorageLocation(name);
        fetchStorageLocations();
      } catch (err: any) {
        alert(`Failed to delete: ${err.message}`);
      }
    }
  };

  const handleViewDetails = (location: StorageLocation) => {
    setSelectedStorageLocation(location);
    setShowDetailsModal(true);
  };
  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <SettingsIcon /> Settings
          </Typography>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            aria-label="settings tabs"
          >
            <Tab
              icon={<Storage />}
              iconPosition="start"
              label="Storage Locations"
              value="storage"
            />
            <Tab icon={<People />} iconPosition="start" label="Users" value="users" />
            <Tab icon={<Security />} iconPosition="start" label="OIDC / SSO" value="oidc" />
          </Tabs>
        </Box>

        {activeTab === 'storage' && (
          <Box>
            <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Storage /> Backup Storage Locations
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Manage backup storage locations for your Velero backups.
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 3 }}>
              <Button
                variant="outlined"
                onClick={fetchStorageLocations}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button
                variant="contained"
                onClick={() => setShowCreateModal(true)}
                startIcon={<Add />}
              >
                Create Storage Location
              </Button>
            </Box>

            {loading && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 200,
                }}
              >
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Loading storage locations...</Typography>
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Error: {error}
              </Alert>
            )}

            {!loading && !error && (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Provider</TableCell>
                      <TableCell>Bucket</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Default</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {storageLocations.map((location) => (
                      <TableRow key={location.name}>
                        <TableCell>
                          <Link
                            component="button"
                            variant="body2"
                            onClick={() => handleViewDetails(location)}
                            sx={{
                              fontWeight: 600,
                              color: 'primary.main',
                              textDecoration: 'none',
                              '&:hover': {
                                textDecoration: 'underline',
                                color: 'primary.dark',
                              },
                            }}
                          >
                            {location.name}
                          </Link>
                        </TableCell>
                        <TableCell>{location.spec.provider}</TableCell>
                        <TableCell>{location.spec.objectStorage.bucket}</TableCell>
                        <TableCell>
                          <Chip
                            label={location.status?.phase || 'Unknown'}
                            color={location.status?.phase === 'Available' ? 'success' : 'error'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{location.spec.default ? '✓' : '-'}</TableCell>
                        <TableCell>
                          {location.name !== 'default' && (
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              onClick={() => handleDeleteLocation(location.name)}
                              startIcon={<Delete />}
                            >
                              Delete
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {activeTab === 'users' && <UserManagement />}

        {activeTab === 'oidc' && <OIDCSettings />}

        <Dialog
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            Create Backup Location
            <IconButton onClick={() => setShowCreateModal(false)}>
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box component="form" onSubmit={handleCreateLocation} sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Location Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., dept3-storage"
                required
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth required sx={{ mb: 2 }}>
                <InputLabel>Provider *</InputLabel>
                <Select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  label="Provider *"
                >
                  <MenuItem value="aws">AWS S3 / MinIO</MenuItem>
                  <MenuItem value="gcp">Google Cloud Storage</MenuItem>
                  <MenuItem value="azure">Azure Blob Storage</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Bucket Name *"
                value={formData.bucket}
                onChange={(e) => setFormData({ ...formData, bucket: e.target.value })}
                placeholder="e.g., dept3-backups"
                required
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="S3 URL (for MinIO)"
                value={formData.s3Url}
                onChange={(e) => setFormData({ ...formData, s3Url: e.target.value })}
                placeholder="http://10.100.102.110:9000"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Prefix (optional)"
                value={formData.prefix}
                onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                placeholder="e.g., velero/"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="CA Certificate (for self-signed certificates)"
                value={formData.caCertificate}
                onChange={(e) => setFormData({ ...formData, caCertificate: e.target.value })}
                placeholder="-----BEGIN CERTIFICATE-----"
                multiline
                rows={4}
                sx={{ mb: 2 }}
                helperText="Paste the CA certificate for self-signed S3 endpoints"
              />

              <Divider sx={{ my: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Credentials (optional)
                </Typography>
              </Divider>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.useCredentials}
                    onChange={(e) => setFormData({ ...formData, useCredentials: e.target.checked })}
                  />
                }
                label="Use custom credentials (leave unchecked for IAM roles/service accounts)"
                sx={{ mb: 2 }}
              />

              {formData.useCredentials && (
                <>
                  <TextField
                    fullWidth
                    label="Access Key ID"
                    value={formData.accessKeyId}
                    onChange={(e) => setFormData({ ...formData, accessKeyId: e.target.value })}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    sx={{ mb: 2 }}
                  />

                  <TextField
                    fullWidth
                    label="Secret Access Key"
                    type="password"
                    value={formData.secretAccessKey}
                    onChange={(e) => setFormData({ ...formData, secretAccessKey: e.target.value })}
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                    sx={{ mb: 2 }}
                  />
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateLocation} variant="contained">
              Create Location
            </Button>
          </DialogActions>
        </Dialog>

        <StorageLocationDetailsModal
          open={showDetailsModal}
          storageLocation={selectedStorageLocation}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedStorageLocation(null);
          }}
        />
      </Paper>
    </Box>
  );
};

export default Settings;
