import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Divider,
  Grid,
  InputAdornment,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Visibility,
  VisibilityOff,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

interface OIDCConfig {
  enabled: boolean;
  issuerURL: string;
  clientID: string;
  clientSecret: string;
  redirectURL: string;
  usernameClaim: string;
  emailClaim: string;
  fullNameClaim: string;
  rolesClaim: string;
  groupsClaim: string;
  adminRoles: string[];
  adminGroups: string[];
  defaultRole: string;
}

const OIDCSettings: React.FC = () => {
  const [config, setConfig] = useState<OIDCConfig>({
    enabled: false,
    issuerURL: '',
    clientID: '',
    clientSecret: '',
    redirectURL: window.location.origin + '/api/v1/auth/oidc/callback',
    usernameClaim: 'preferred_username',
    emailClaim: 'email',
    fullNameClaim: 'name',
    rolesClaim: 'realm_access.roles',
    groupsClaim: 'groups',
    adminRoles: [],
    adminGroups: [],
    defaultRole: 'user',
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [adminRoleInput, setAdminRoleInput] = useState('');
  const [adminGroupInput, setAdminGroupInput] = useState('');

  // Fetch current OIDC configuration
  useEffect(() => {
    fetchOIDCConfig();
  }, []);

  const fetchOIDCConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('velero_token');
      const response = await fetch('/api/v1/oidc/config', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      } else if (response.status === 404) {
        // No config exists yet, use defaults
      } else {
        throw new Error('Failed to fetch OIDC configuration');
      }
    } catch (err) {
      setError('Failed to load OIDC configuration');
      console.error('Error fetching OIDC config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('velero_token');
      const response = await fetch('/api/v1/oidc/config', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setSuccess(
          'OIDC configuration saved successfully. The application will reload to apply changes.'
        );
        // Reload after a short delay to apply new configuration
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save configuration');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save OIDC configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setError('');

    try {
      const token = localStorage.getItem('velero_token');
      const response = await fetch('/api/v1/oidc/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          issuerURL: config.issuerURL,
          clientID: config.clientID,
          clientSecret: config.clientSecret,
        }),
      });

      if (response.ok) {
        setTestStatus('success');
        setTimeout(() => setTestStatus('idle'), 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Connection test failed');
      }
    } catch (err: any) {
      setTestStatus('failed');
      setError(`Connection test failed: ${err.message}`);
      setTimeout(() => setTestStatus('idle'), 3000);
    }
  };

  const handleAddAdminRole = () => {
    if (adminRoleInput.trim() && !config.adminRoles.includes(adminRoleInput.trim())) {
      setConfig({
        ...config,
        adminRoles: [...config.adminRoles, adminRoleInput.trim()],
      });
      setAdminRoleInput('');
    }
  };

  const handleRemoveAdminRole = (role: string) => {
    setConfig({
      ...config,
      adminRoles: config.adminRoles.filter((r) => r !== role),
    });
  };

  const handleAddAdminGroup = () => {
    if (adminGroupInput.trim() && !config.adminGroups.includes(adminGroupInput.trim())) {
      setConfig({
        ...config,
        adminGroups: [...config.adminGroups, adminGroupInput.trim()],
      });
      setAdminGroupInput('');
    }
  };

  const handleRemoveAdminGroup = (group: string) => {
    setConfig({
      ...config,
      adminGroups: config.adminGroups.filter((g) => g !== group),
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading OIDC configuration...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
        OIDC / SSO Configuration
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Card elevation={2}>
        <CardContent sx={{ p: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                color="primary"
              />
            }
            label={<Typography variant="h6">Enable OIDC Authentication</Typography>}
            sx={{ mb: 3 }}
          />

          {config.enabled && (
            <>
              <Divider sx={{ my: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Identity Provider Configuration
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Issuer URL"
                    value={config.issuerURL}
                    onChange={(e) => setConfig({ ...config, issuerURL: e.target.value })}
                    helperText="The OIDC provider's issuer URL (e.g., https://keycloak.company.com/auth/realms/company)"
                    variant="outlined"
                    required
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip title="This is the base URL of your OIDC provider">
                            <InfoIcon color="action" fontSize="small" />
                          </Tooltip>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Client ID"
                    value={config.clientID}
                    onChange={(e) => setConfig({ ...config, clientID: e.target.value })}
                    helperText="The OAuth2 client ID for this application"
                    variant="outlined"
                    required
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Client Secret"
                    type={showSecret ? 'text' : 'password'}
                    value={config.clientSecret}
                    onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                    helperText="The OAuth2 client secret (stored securely in Kubernetes Secret)"
                    variant="outlined"
                    required
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowSecret(!showSecret)} edge="end">
                            {showSecret ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Redirect URL"
                    value={config.redirectURL}
                    onChange={(e) => setConfig({ ...config, redirectURL: e.target.value })}
                    helperText="The callback URL configured in your OIDC provider"
                    variant="outlined"
                    required
                  />
                </Grid>

                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    startIcon={
                      testStatus === 'testing' ? (
                        <CircularProgress size={20} />
                      ) : testStatus === 'success' ? (
                        <CheckCircleIcon />
                      ) : testStatus === 'failed' ? (
                        <ErrorIcon />
                      ) : (
                        <RefreshIcon />
                      )
                    }
                    onClick={handleTestConnection}
                    disabled={
                      !config.issuerURL ||
                      !config.clientID ||
                      !config.clientSecret ||
                      testStatus === 'testing'
                    }
                    color={
                      testStatus === 'success'
                        ? 'success'
                        : testStatus === 'failed'
                          ? 'error'
                          : 'primary'
                    }
                  >
                    {testStatus === 'testing'
                      ? 'Testing...'
                      : testStatus === 'success'
                        ? 'Connection Successful'
                        : testStatus === 'failed'
                          ? 'Connection Failed'
                          : 'Test Connection'}
                  </Button>
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2, mb: 2 }}>
                    Claim Mappings
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Username Claim"
                    value={config.usernameClaim}
                    onChange={(e) => setConfig({ ...config, usernameClaim: e.target.value })}
                    helperText="JWT claim for username"
                    variant="outlined"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Email Claim"
                    value={config.emailClaim}
                    onChange={(e) => setConfig({ ...config, emailClaim: e.target.value })}
                    helperText="JWT claim for email address"
                    variant="outlined"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Full Name Claim"
                    value={config.fullNameClaim}
                    onChange={(e) => setConfig({ ...config, fullNameClaim: e.target.value })}
                    helperText="JWT claim for user's full name"
                    variant="outlined"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Roles Claim"
                    value={config.rolesClaim}
                    onChange={(e) => setConfig({ ...config, rolesClaim: e.target.value })}
                    helperText="JWT claim for roles (e.g., realm_access.roles)"
                    variant="outlined"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Groups Claim"
                    value={config.groupsClaim}
                    onChange={(e) => setConfig({ ...config, groupsClaim: e.target.value })}
                    helperText="JWT claim for groups"
                    variant="outlined"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Default Role"
                    value={config.defaultRole}
                    onChange={(e) => setConfig({ ...config, defaultRole: e.target.value })}
                    helperText="Default role for authenticated users"
                    variant="outlined"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2, mb: 2 }}>
                    Admin Role Mapping
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box>
                    <TextField
                      fullWidth
                      label="Add Admin Role"
                      value={adminRoleInput}
                      onChange={(e) => setAdminRoleInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddAdminRole()}
                      helperText="OIDC roles that grant admin access"
                      variant="outlined"
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Button onClick={handleAddAdminRole} disabled={!adminRoleInput.trim()}>
                              Add
                            </Button>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {config.adminRoles.map((role) => (
                        <Chip
                          key={role}
                          label={role}
                          onDelete={() => handleRemoveAdminRole(role)}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box>
                    <TextField
                      fullWidth
                      label="Add Admin Group"
                      value={adminGroupInput}
                      onChange={(e) => setAdminGroupInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddAdminGroup()}
                      helperText="OIDC groups that grant admin access"
                      variant="outlined"
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Button
                              onClick={handleAddAdminGroup}
                              disabled={!adminGroupInput.trim()}
                            >
                              Add
                            </Button>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {config.adminGroups.map((group) => (
                        <Chip
                          key={group}
                          label={group}
                          onDelete={() => handleRemoveAdminGroup(group)}
                          color="secondary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </>
          )}

          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
            <Button variant="outlined" onClick={fetchOIDCConfig} startIcon={<RefreshIcon />}>
              Reset
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default OIDCSettings;
