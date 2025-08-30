import React, { useState, useEffect } from 'react';
import './UserManagement.css';

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
  const [showAddUser, setShowAddUser] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async () => {
    try {
      const response = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch(`/api/v1/users/${username}`, {
        method: 'DELETE',
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

      const response = await fetch(`/api/v1/users/${selectedUser}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="user-management">
      <div className="section-header">
        <h3>User Management</h3>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowAddUser(true)}>
            Add User
          </button>
        )}
      </div>

      {loading ? (
        <div>Loading users...</div>
      ) : (
        <table className="users-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.username}>
                <td>{user.username}</td>
                <td>
                  <span className={`role-badge role-${user.role}`}>
                    {user.role}
                  </span>
                </td>
                <td>{user.created || 'N/A'}</td>
                <td>
                  {(isAdmin || user.username === currentUser.username) && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSelectedUser(user.username);
                        setShowChangePassword(true);
                      }}
                    >
                      Change Password
                    </button>
                  )}
                  {isAdmin && user.username !== 'admin' && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteUser(user.username)}
                      style={{ marginLeft: '8px' }}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showChangePassword && (
        <div className="modal-overlay" onClick={() => setShowChangePassword(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Change Password for {selectedUser}</h3>
            {JSON.parse(localStorage.getItem('velero_user') || '{}').username === selectedUser && (
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordData.oldPassword}
                  onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})}
                />
              </div>
            )}
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowChangePassword(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleChangePassword}
                disabled={!passwordData.newPassword || !passwordData.confirmPassword}
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddUser && (
        <div className="modal-overlay" onClick={() => setShowAddUser(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Add New User</h3>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={newUser.username}
                onChange={e => setNewUser({...newUser, username: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={newUser.password}
                onChange={e => setNewUser({...newUser, password: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select
                value={newUser.role}
                onChange={e => setNewUser({...newUser, role: e.target.value})}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddUser(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleAddUser}
                disabled={!newUser.username || !newUser.password}
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;