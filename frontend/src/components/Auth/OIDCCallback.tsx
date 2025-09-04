import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';
import { useAuth } from './AuthProvider';

const OIDCCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOIDCCallback } = useAuth();
  const [error, setError] = useState<string>('');
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        setError(`Authentication failed: ${errorDescription || error}`);
        setProcessing(false);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
        return;
      }

      if (!code || !state) {
        setError('Missing authorization code or state parameter');
        setProcessing(false);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
        return;
      }

      try {
        await handleOIDCCallback(code, state);
        // On successful authentication, navigate to dashboard
        navigate('/dashboard');
      } catch (err) {
        console.error('OIDC callback error:', err);
        setError('Authentication failed. Please try again.');
        setProcessing(false);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    };

    processCallback();
  }, [searchParams, handleOIDCCallback, navigate]);

  if (processing) {
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
          <CircularProgress size={60} sx={{ mb: 3 }} />
          <Typography variant="h5" gutterBottom>
            Completing Authentication...
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Please wait while we log you in.
          </Typography>
        </Box>
      </Container>
    );
  }

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
        <Alert severity="error" sx={{ width: '100%', mb: 3 }}>
          {error}
        </Alert>
        <Typography variant="body1" color="text.secondary">
          Redirecting to login page...
        </Typography>
      </Box>
    </Container>
  );
};

export default OIDCCallback;
