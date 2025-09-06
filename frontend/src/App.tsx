// fixed OIDC login issues and improved session handling
import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import AppBar from './components/Layout/AppBar.tsx';
import Navigator from './components/Layout/Navigator.tsx';
import BackupList from './components/Backups/BackupList.tsx';
import Dashboard from './components/Dashboard/SimplifiedDashboard.tsx';
import Clusters from './components/Clusters/Clusters.tsx';
import ScheduleList from './components/Schedules/ScheduleList.tsx';
import RestoreList from './components/Restores/RestoreList.tsx';
import Settings from './components/Settings/Settings.tsx';
import Login from './components/Auth/Login.tsx';
import { authService } from './services/auth.ts';
import { User } from './services/types.ts';

const drawerWidth = 256;

let theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      light: '#63ccff',
      main: '#009be5',
      dark: '#006db3',
    },
    background: {
      default: '#0a1929',
      paper: '#101F33',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
      fontSize: '1.75rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    body1: {
      fontSize: '0.875rem',
    },
    body2: {
      fontSize: '0.75rem',
    },
  },
  shape: {
    borderRadius: 12,
  },
  mixins: {
    toolbar: {
      minHeight: 64,
      '@media (min-width:0px) and (orientation: landscape)': {
        minHeight: 48,
      },
      '@media (min-width:600px)': {
        minHeight: 64,
      },
    },
  },
});

theme = {
  ...theme,
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#081627',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
        contained: {
          boxShadow: 'none',
          '&:active': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          marginLeft: theme.spacing(1),
        },
        indicator: {
          height: 3,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          backgroundColor: theme.palette.common.white,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          margin: '0 16px',
          minWidth: 0,
          padding: 0,
          [theme.breakpoints.up('md')]: {
            padding: 0,
            minWidth: 0,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: theme.spacing(1),
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 4,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgb(255,255,255,0.15)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            color: '#4fc3f7',
          },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontSize: 14,
          fontWeight: theme.typography.fontWeightMedium,
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: 'inherit',
          minWidth: 'auto',
          marginRight: theme.spacing(2),
          '& svg': {
            fontSize: 20,
          },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          width: 32,
          height: 32,
        },
      },
    },
  },
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeRoute, setActiveRoute] = useState(() => {
    const hash = window.location.hash.slice(1);
    return hash || 'dashboard';
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Check for OIDC callback parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const auth = urlParams.get('auth');
    const username = urlParams.get('username');
    const role = urlParams.get('role');

    if (token && auth === 'oidc' && username && role) {
      // Store the token and create user session
      localStorage.setItem('velero_token', token);
      const userData: User = {
        username: username,
        role: role as 'admin' | 'user',
      };

      // Clear URL parameters
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.hash
      );

      setUser(userData);
      return;
    }

    // Otherwise check for existing session
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
  };

  const handleRouteChange = (route: string) => {
    setActiveRoute(route);
    window.location.hash = route;
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const renderContent = () => {
    switch (activeRoute) {
      case 'backups':
        return <BackupList />;
      case 'dashboard':
        return <Dashboard />;
      case 'clusters':
        return <Clusters />;
      case 'restore':
        return <RestoreList />;
      case 'schedules':
        return <ScheduleList />;
      case 'settings':
        return <Settings />;
      default:
        return <BackupList />;
    }
  };

  if (!user) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <CssBaseline />
        <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
          {/* Mobile drawer */}
          <Navigator
            PaperProps={{ style: { width: drawerWidth, zIndex: 1300 } }}
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            activeRoute={activeRoute}
            onRouteChange={handleRouteChange}
            onLogout={handleLogout}
            user={user.username}
            sx={{
              display: { xs: 'block', sm: 'none' },
              zIndex: 1300,
            }}
          />
          {/* Desktop drawer */}
          <Navigator
            PaperProps={{ style: { width: drawerWidth, zIndex: 1200 } }}
            variant="permanent"
            activeRoute={activeRoute}
            onRouteChange={handleRouteChange}
            onLogout={handleLogout}
            user={user.username}
            sx={{
              display: { xs: 'none', sm: 'block' },
              zIndex: 1200,
            }}
          />
        </Box>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <AppBar
            position="static"
            sx={{
              zIndex: 1,
            }}
            onDrawerToggle={handleDrawerToggle}
            title={activeRoute.charAt(0).toUpperCase() + activeRoute.slice(1)}
          />
          <Box component="main" sx={{ flex: 1, py: 6, px: 4, bgcolor: '#0a1929' }}>
            {renderContent()}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
