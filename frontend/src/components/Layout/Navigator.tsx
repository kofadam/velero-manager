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
        <ListItem sx={{ ...item, ...itemCategory, fontSize: 22, color: '#fff' }}>
          Velero Manager
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
              <ListItemText sx={{ color: '#fff' }}>
                {id}
              </ListItemText>
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