import React from 'react';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import Box from '@mui/material/Box';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import HomeIcon from '@mui/icons-material/Home';
import BackupIcon from '@mui/icons-material/Backup';
import RestoreIcon from '@mui/icons-material/Restore';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import { DrawerProps } from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import { APP_VERSION } from '../../utils/constants.ts';

const categories = [
  {
    id: 'Backup Management',
    children: [
      {
        id: 'dashboard',
        name: 'Dashboard',
        icon: <HomeIcon />,
      },
      {
        id: 'backups',
        name: 'Backups',
        icon: <BackupIcon />,
      },
      {
        id: 'restore',
        name: 'Restores',
        icon: <RestoreIcon />,
      },
      {
        id: 'schedules',
        name: 'Schedules',
        icon: <ScheduleIcon />,
      },
      {
        id: 'clusters',
        name: 'Clusters',
        icon: <DnsRoundedIcon />,
      },
    ],
  },
  {
    id: 'Administration',
    children: [
      {
        id: 'settings',
        name: 'Settings',
        icon: <SettingsIcon />,
      },
    ],
  },
];

const item = {
  py: '2px',
  px: 3,
  color: 'rgba(255, 255, 255, 0.7)',
  '&:hover, &:focus': {
    bgcolor: 'rgba(255, 255, 255, 0.08)',
  },
};

const itemCategory = {
  boxShadow: '0 -1px 0 rgb(255,255,255,0.1) inset',
  py: 1.5,
  px: 3,
};

interface NavigatorProps extends Omit<DrawerProps, 'children'> {
  activeRoute: string;
  onRouteChange: (route: string) => void;
  onLogout: () => void;
  user: string;
}

export default function Navigator(props: NavigatorProps) {
  const { activeRoute, onRouteChange, onLogout, user, ...other } = props;

  return (
    <Drawer variant="permanent" {...other}>
      <List disablePadding>
        <ListItem
          sx={{
            ...item,
            ...itemCategory,
            fontSize: 22,
            color: '#fff',
            py: 3,
            background:
              'linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 203, 243, 0.1) 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            mb: 1,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              width: '100%',
              px: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                transition: 'transform 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.05)',
                },
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                }}
              >
                V
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    color: '#fff',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  }}
                >
                  Velero
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontWeight: 500,
                    letterSpacing: '0.5px',
                  }}
                >
                  Manager
                </Typography>
              </Box>
            </Box>
          </Box>
        </ListItem>
        <ListItem sx={{ ...item, ...itemCategory }}>
          <ListItemIcon sx={{ color: '#4fc3f7' }}>
            <HomeIcon />
          </ListItemIcon>
          <ListItemText>
            <Typography color="inherit" sx={{ fontSize: 14 }}>
              {user ? `${user}` : 'User'}
            </Typography>
          </ListItemText>
        </ListItem>
        {categories.map(({ id, children }) => (
          <Box key={id} sx={{ bgcolor: '#101F33' }}>
            <ListItem sx={{ py: 2, px: 3 }}>
              <ListItemText sx={{ color: '#fff' }}>{id}</ListItemText>
            </ListItem>
            {children.map(({ id: childId, name, icon }) => (
              <ListItem disablePadding key={childId}>
                <ListItemButton
                  selected={activeRoute === childId}
                  sx={item}
                  onClick={() => onRouteChange(childId)}
                >
                  <ListItemIcon>{icon}</ListItemIcon>
                  <ListItemText>{name}</ListItemText>
                </ListItemButton>
              </ListItem>
            ))}
            <Divider sx={{ mt: 2 }} />
          </Box>
        ))}
        <Box sx={{ flexGrow: 1 }} />
        <ListItem sx={{ px: 3, py: 1 }}>
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '0.75rem',
            }}
          >
            Version: {APP_VERSION}
          </Typography>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton sx={item} onClick={onLogout}>
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText>Logout</ListItemText>
          </ListItemButton>
        </ListItem>
      </List>
    </Drawer>
  );
}
