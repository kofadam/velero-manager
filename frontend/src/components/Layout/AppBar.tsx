import React from 'react';
import AppBar from '@mui/material/AppBar';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';

interface AppBarProps extends MuiAppBarProps {
  onDrawerToggle: () => void;
  title: string;
}

export default function CustomAppBar(props: AppBarProps) {
  const { onDrawerToggle, title, ...other } = props;

  return (
    <AppBar
      component="div"
      color="primary"
      position="static"
      elevation={0}
      sx={{ zIndex: 0 }}
      {...other}
    >
      <Toolbar>
        <Grid container alignItems="center" spacing={1}>
          <Grid item sx={{ display: { sm: 'none', xs: 'block' } }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={onDrawerToggle}
              edge="start"
            >
              <MenuIcon />
            </IconButton>
          </Grid>
          <Grid item xs>
            <Typography color="inherit" variant="h5" component="h1">
              {title}
            </Typography>
          </Grid>
        </Grid>
      </Toolbar>
    </AppBar>
  );
}