import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  FormControlLabel,
  Checkbox,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Select,
  MenuItem,
  InputLabel,
  FormGroup,
  Switch,
  Alert,
  Stack,
  Autocomplete,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import ScheduleIcon from '@mui/icons-material/Schedule';
import FilterListIcon from '@mui/icons-material/FilterList';
import SettingsIcon from '@mui/icons-material/Settings';
import FormWizard, { WizardStep } from '../Common/FormWizard';
import { apiService } from '../../services/api';

interface CreateBackupWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clusters: string[];
}

// Step 1: Basic Information
const BasicInfoStep: React.FC<any> = ({ formData, setFormData, onValidation }) => {
  const [errors, setErrors] = useState<any>({});

  const handleChange = (field: string, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);

    // Validation
    const newErrors = { ...errors };
    if (field === 'name') {
      if (!value || value.length < 3) {
        newErrors.name = 'Backup name must be at least 3 characters';
      } else if (!/^[a-z0-9-]+$/.test(value)) {
        newErrors.name = 'Name must contain only lowercase letters, numbers, and hyphens';
      } else {
        delete newErrors.name;
      }
    }
    setErrors(newErrors);
    onValidation?.(Object.keys(newErrors).length === 0 && newData.name?.length >= 3);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom fontWeight="bold" color="primary">
        📝 Basic Backup Information
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Backup Name"
            value={formData.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name || 'Must be unique and follow Kubernetes naming conventions'}
            placeholder="e.g., daily-backup-2024"
            required
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Description"
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Optional description of this backup"
            multiline
            rows={1}
          />
        </Grid>

        <Grid item xs={12}>
          <FormControl component="fieldset">
            <Typography variant="subtitle2" gutterBottom>
              Backup Type
            </Typography>
            <FormGroup row>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isFullCluster || false}
                    onChange={(e) => handleChange('isFullCluster', e.target.checked)}
                  />
                }
                label="Full cluster backup (all resources)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.includePVs || true}
                    onChange={(e) => handleChange('includePVs', e.target.checked)}
                  />
                }
                label="Include persistent volumes"
              />
            </FormGroup>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <Alert severity="info">
            💡 <strong>Tip:</strong> Choose a descriptive name that includes the date or purpose.
            This will make it easier to identify later when restoring.
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );
};

// Step 2: Resource Selection
const ResourceSelectionStep: React.FC<any> = ({ formData, setFormData, clusters }) => {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [loadingNamespaces, setLoadingNamespaces] = useState(false);

  useEffect(() => {
    if (formData.cluster) {
      fetchNamespaces(formData.cluster);
    }
  }, [formData.cluster]);

  const fetchNamespaces = async (cluster: string) => {
    setLoadingNamespaces(true);
    try {
      // Mock namespaces for now - replace with actual API call
      setNamespaces(['default', 'kube-system', 'monitoring', 'velero', 'app-production']);
    } catch (error) {
      console.error('Failed to fetch namespaces:', error);
    } finally {
      setLoadingNamespaces(false);
    }
  };

  const handleClusterChange = (cluster: string) => {
    setFormData({ ...formData, cluster, namespaces: [] });
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom fontWeight="bold" color="primary">
        🎯 Select Resources to Backup
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Target Cluster</InputLabel>
            <Select
              value={formData.cluster || ''}
              onChange={(e) => handleClusterChange(e.target.value)}
              label="Target Cluster"
            >
              {clusters.map((cluster) => (
                <MenuItem key={cluster} value={cluster}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <StorageIcon fontSize="small" />
                    {cluster}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <Autocomplete
            multiple
            options={namespaces}
            value={formData.namespaces || []}
            onChange={(_, value) => setFormData({ ...formData, namespaces: value })}
            loading={loadingNamespaces}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Namespaces"
                placeholder="Select namespaces to backup"
                helperText="Leave empty to backup all namespaces"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  variant="outlined"
                  label={option}
                  size="small"
                  {...getTagProps({ index })}
                  key={option}
                />
              ))
            }
          />
        </Grid>

        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                <FilterListIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                Resource Filters
              </Typography>

              <Stack spacing={2} sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.includeClusterResources || false}
                      onChange={(e) =>
                        setFormData({ ...formData, includeClusterResources: e.target.checked })
                      }
                    />
                  }
                  label="Include cluster-scoped resources"
                />

                <TextField
                  fullWidth
                  label="Include Resources (comma-separated)"
                  value={formData.includeResources || ''}
                  onChange={(e) => setFormData({ ...formData, includeResources: e.target.value })}
                  placeholder="e.g., configmaps, secrets, persistentvolumes"
                  helperText="Specify resource types to include"
                />

                <TextField
                  fullWidth
                  label="Exclude Resources (comma-separated)"
                  value={formData.excludeResources || ''}
                  onChange={(e) => setFormData({ ...formData, excludeResources: e.target.value })}
                  placeholder="e.g., events, logs"
                  helperText="Specify resource types to exclude"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

// Step 3: Storage and Schedule
const StorageScheduleStep: React.FC<any> = ({ formData, setFormData }) => {
  const [storageLocations, setStorageLocations] = useState(['default', 'aws-s3', 'gcp-storage']);

  return (
    <Box>
      <Typography variant="h6" gutterBottom fontWeight="bold" color="primary">
        💾 Storage & Scheduling Options
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Storage Location</InputLabel>
            <Select
              value={formData.storageLocation || 'default'}
              onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
              label="Storage Location"
            >
              {storageLocations.map((location) => (
                <MenuItem key={location} value={location}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <StorageIcon fontSize="small" />
                    {location}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="TTL (Time to Live)"
            value={formData.ttl || '168h'}
            onChange={(e) => setFormData({ ...formData, ttl: e.target.value })}
            placeholder="168h (7 days)"
            helperText="How long to keep this backup (e.g., 24h, 7d, 168h)"
          />
        </Grid>

        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                <ScheduleIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                Advanced Options
              </Typography>

              <Stack spacing={3} sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.snapshotVolumes !== false}
                      onChange={(e) =>
                        setFormData({ ...formData, snapshotVolumes: e.target.checked })
                      }
                    />
                  }
                  label="Create volume snapshots"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.defaultVolumesToRestic || false}
                      onChange={(e) =>
                        setFormData({ ...formData, defaultVolumesToRestic: e.target.checked })
                      }
                    />
                  }
                  label="Use Restic for volume backup"
                />

                <TextField
                  fullWidth
                  label="Backup Labels (JSON)"
                  value={formData.labels || ''}
                  onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
                  placeholder='{"environment": "production", "team": "platform"}'
                  helperText="Optional labels to add to this backup"
                  multiline
                  rows={2}
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

// Step 4: Review and Confirm
const ReviewStep: React.FC<any> = ({ formData }) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom fontWeight="bold" color="primary">
        ✅ Review Backup Configuration
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Name:
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {formData.name}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Cluster:
                  </Typography>
                  <Typography variant="body1">{formData.cluster || 'All clusters'}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Type:
                  </Typography>
                  <Typography variant="body1">
                    {formData.isFullCluster ? 'Full Cluster' : 'Selective'} Backup
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Resources & Storage
              </Typography>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Namespaces:
                  </Typography>
                  <Typography variant="body1">
                    {formData.namespaces?.length > 0
                      ? formData.namespaces.join(', ')
                      : 'All namespaces'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Storage Location:
                  </Typography>
                  <Typography variant="body1">{formData.storageLocation || 'default'}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    TTL:
                  </Typography>
                  <Typography variant="body1">{formData.ttl || '168h'}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Alert severity="success">
            🚀 <strong>Ready to create backup!</strong> Please review the configuration above and
            click "Create" to start the backup process.
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );
};

const CreateBackupWizard: React.FC<CreateBackupWizardProps> = ({
  open,
  onClose,
  onSuccess,
  clusters,
}) => {
  if (!open) return null;

  const steps: WizardStep[] = [
    {
      id: 'basic-info',
      label: 'Basic Info',
      description: 'Provide basic information about your backup',
      component: <BasicInfoStep clusters={clusters} />,
      isValid: false,
    },
    {
      id: 'resource-selection',
      label: 'Resources',
      description: 'Select which resources to include in the backup',
      component: <ResourceSelectionStep clusters={clusters} />,
      isValid: true,
    },
    {
      id: 'storage-schedule',
      label: 'Storage & Options',
      description: 'Configure storage location and advanced options',
      component: <StorageScheduleStep />,
      isValid: true,
    },
    {
      id: 'review',
      label: 'Review',
      description: 'Review your backup configuration before creating',
      component: <ReviewStep />,
      isValid: true,
    },
  ];

  const handleComplete = async (formData: any) => {
    try {
      // Create the backup using the API
      await apiService.createBackup(formData.cluster, {
        name: formData.name,
        description: formData.description,
        includeNamespaces: formData.namespaces,
        includeClusterResources: formData.includeClusterResources,
        includeResources: formData.includeResources
          ?.split(',')
          .map((s: string) => s.trim())
          .filter(Boolean),
        excludeResources: formData.excludeResources
          ?.split(',')
          .map((s: string) => s.trim())
          .filter(Boolean),
        storageLocation: formData.storageLocation,
        ttl: formData.ttl,
        snapshotVolumes: formData.snapshotVolumes,
        defaultVolumesToRestic: formData.defaultVolumesToRestic,
        labels: formData.labels ? JSON.parse(formData.labels) : undefined,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw error;
    }
  };

  return (
    <FormWizard
      title="Create New Backup"
      subtitle="Follow the steps below to create a comprehensive backup of your Kubernetes resources"
      steps={steps}
      onComplete={handleComplete}
      onCancel={onClose}
    />
  );
};

export default CreateBackupWizard;
