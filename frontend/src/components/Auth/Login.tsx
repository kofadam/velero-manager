import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import BusinessIcon from '@mui/icons-material/Business';
import Container from '@mui/material/Container';
import { authService } from '../../services/auth.ts';

interface LoginProps {
  onLogin: (user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [authConfig, setAuthConfig] = useState<any>(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load auth config on component mount
  useEffect(() => {
    const loadAuthConfig = async () => {
      try {
        const config = await authService.getAuthConfig();
        setAuthConfig(config);
      } catch (error) {
        console.error('Failed to load auth config:', error);
        // Fallback to legacy auth only - ensure users can always login
        setAuthConfig({ 
          oidcEnabled: false, 
          legacyAuthEnabled: true, 
          authenticated: false 
        });
      }
    };

    const handleOIDCCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (code && state) {
        try {
          setLoading(true);
          const user = await authService.handleOIDCCallback(code, state);
          onLogin(user);
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          setError('OIDC authentication failed');
          setLoading(false);
        }
      }
    };

    loadAuthConfig();
    handleOIDCCallback();
  }, [onLogin]);

  const handleLegacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await authService.legacyLogin(username, password);
      onLogin(user);
    } catch (err) {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleOIDCLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const authUrl = await authService.initiateOIDCLogin();
      window.location.href = authUrl;
    } catch (err) {
      setError('Failed to initiate SSO login');
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: '100vh',
          justifyContent: 'center',
        }}
      >
        <Card sx={{ width: '100%', p: 4 }}>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <Avatar sx={{ m: 1, bgcolor: 'primary.main' }}>
                <LockOutlinedIcon />
              </Avatar>
              <Typography component="h1" variant="h4" gutterBottom>
                Velero Manager
              </Typography>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Sign in to your account
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
                  {error}
                </Alert>
              )}

              {/* OIDC Login Button */}
              {authConfig?.oidcEnabled && (
                <Box sx={{ mt: 3, width: '100%' }}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleOIDCLogin}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <BusinessIcon />}
                    sx={{ mb: 2 }}
                  >
                    {loading ? 'Redirecting...' : 'Sign in with SSO'}
                  </Button>
                  
                  {(!authConfig || authConfig.legacyAuthEnabled !== false) && (
                    <Divider sx={{ my: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        or
                      </Typography>
                    </Divider>
                  )}
                </Box>
              )}

              {/* Legacy Login Form - Always available as fallback */}
              {(!authConfig || authConfig.legacyAuthEnabled !== false) && (
                <Box component="form" onSubmit={handleLegacySubmit} sx={{ mt: authConfig.oidcEnabled ? 0 : 3, width: '100%' }}>
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="username"
                    label="Username"
                    name="username"
                    autoComplete="username"
                    autoFocus={!authConfig?.oidcEnabled}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                  />
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="password"
                    label="Password"
                    type="password"
                    id="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  
                  <Button
                    type="submit"
                    fullWidth
                    variant={authConfig?.oidcEnabled ? "outlined" : "contained"}
                    sx={{ mt: 3, mb: 2 }}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <LockOutlinedIcon />}
                  >
                    {loading ? 'Signing in...' : 'Sign in with Username'}
                  </Button>
                  
                  <Box textAlign="center" mt={2}>
                    <Typography variant="body2" color="text.secondary">
                      Default credentials: admin / admin
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default Login;
