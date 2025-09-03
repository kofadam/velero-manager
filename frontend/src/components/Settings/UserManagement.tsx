// ixed OIDC issues and improved UI/UX for user management
import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  CircularProgress
} from '@mui/material';
import { Add, Edit, Delete, Close } from '@mui/icons-material';

interface User {
  username: string;
  role: string;
  created: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const currentUser = JSON.parse(localStorage.getItem('velero_user') || '{}');
  const isAdmin = currentUser.role === 'admin';
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('velero_token');
      const response = await fetch('/api/v1/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 403) {
        // User doesn't have permission to view users (likely OIDC non-admin user)
        setHasPermission(false);
        setUsers([]);
        return;
      }
      
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async () => {
    try {
      const token = localStorage.getItem('velero_token');
      const response = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(newUser),
      });

      if (response.ok) {
        fetchUsers();
        setShowAddUser(false);
        setNewUser({ username: '', password: '', role: 'user' });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create user');
      }
    } catch (error) {
      alert('Failed to create user');
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!window.confirm(`Delete user ${username}?`)) return;
    
    try {
      const token = localStorage.getItem('velero_token');
      const response = await fetch(`/api/v1/users/${username}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchUsers();
      }
    } catch (error) {
      alert('Failed to delete user');
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      const currentUser = JSON.parse(localStorage.getItem('velero_user') || '{}');
      const isChangingOwnPassword = currentUser.username === selectedUser;
      
      const body: any = { newPassword: passwordData.newPassword };
      if (isChangingOwnPassword) {
        body.oldPassword = passwordData.oldPassword;
      }

      const token = localStorage.getItem('velero_token');
      const response = await fetch(`/api/v1/users/${selectedUser}/password`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowChangePassword(false);
        setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
        alert('Password changed successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to change password');
      }
    } catch (error) {
      alert('Failed to change password');
    }
  };

  return (
    <Box>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 3
      }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          User Management
        </Typography>
        {isAdmin && hasPermission && (
          <Button 
            variant="contained"
            onClick={() => setShowAddUser(true)}
            startIcon={<Add />}
          >
            Add User
          </Button>
        )}
      </Box>

      {loading ? (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: 200 
        }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading users...</Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Username</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Box sx={{ py: 4 }}>
                      {!hasPermission ? (
                        <>
                          <Typography color="text.secondary" variant="h6">
                            Access Restricted
                          </Typography>
                          <Typography color="text.secondary" variant="body2">
                            User management is only available to administrators.
                            {currentUser.role !== 'admin' && (
                              <><br />OIDC users are managed through your identity provider.</>
                            )}
                          </Typography>
                        </>
                      ) : (
                        <>
                          <Typography color="text.secondary" variant="h6">
                            No users found
                          </Typography>
                          <Typography color="text.secondary" variant="body2">
                            Add your first user to get started
                          </Typography>
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                users.map(user => (
                  <TableRow 
                    key={user.username}
                    hover
                    sx={{ 
                      '&:hover': { 
                        backgroundColor: 'action.hover',
                      } 
                    }}
                  >
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 600,
                          color: 'primary.main'
                        }}
                      >
                        {user.username}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={user.role}
                        color={user.role === 'admin' ? 'error' : 'primary'}
                        size="small"
                        sx={{ 
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          fontSize: '0.75rem',
                          letterSpacing: '0.5px'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'text.secondary',
                          fontSize: '0.875rem'
                        }}
                      >
                        {user.created || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {(isAdmin || user.username === currentUser.username) && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              setSelectedUser(user.username);
                              setShowChangePassword(true);
                            }}
                            startIcon={<Edit />}
                          >
                            Change Password
                          </Button>
                        )}
                        {isAdmin && user.username !== 'admin' && (
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => handleDeleteUser(user.username)}
                            startIcon={<Delete />}
                          >
                            Delete
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Change Password for {selectedUser}
          <IconButton onClick={() => setShowChangePassword(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {JSON.parse(localStorage.getItem('velero_user') || '{}').username === selectedUser && (
              <TextField
                fullWidth
                type="password"
                label="Current Password"
                value={passwordData.oldPassword}
                onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})}
                variant="outlined"
              />
            )}
            <TextField
              fullWidth
              type="password"
              label="New Password"
              value={passwordData.newPassword}
              onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
              variant="outlined"
              required
            />
            <TextField
              fullWidth
              type="password"
              label="Confirm New Password"
              value={passwordData.confirmPassword}
              onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
              variant="outlined"
              required
              error={passwordData.confirmPassword !== '' && passwordData.newPassword !== passwordData.confirmPassword}
              helperText={passwordData.confirmPassword !== '' && passwordData.newPassword !== passwordData.confirmPassword ? 'Passwords do not match' : ''}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowChangePassword(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained"
            onClick={handleChangePassword}
            disabled={!passwordData.newPassword || !passwordData.confirmPassword || passwordData.newPassword !== passwordData.confirmPassword}
          >
            Change Password
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showAddUser}
        onClose={() => setShowAddUser(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Add New User
          <IconButton onClick={() => setShowAddUser(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Username"
              value={newUser.username}
              onChange={e => setNewUser({...newUser, username: e.target.value})}
              variant="outlined"
              required
            />
            <TextField
              fullWidth
              type="password"
              label="Password"
              value={newUser.password}
              onChange={e => setNewUser({...newUser, password: e.target.value})}
              variant="outlined"
              required
            />
            <FormControl fullWidth variant="outlined">
              <InputLabel>Role</InputLabel>
              <Select
                value={newUser.role}
                onChange={e => setNewUser({...newUser, role: e.target.value})}
                label="Role"
              >
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddUser(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained"
            onClick={handleAddUser}
            disabled={!newUser.username || !newUser.password}
          >
            Create User
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement;