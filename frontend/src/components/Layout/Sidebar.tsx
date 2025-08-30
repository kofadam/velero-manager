import React from 'react';
import { APP_VERSION } from '../../utils/constants.ts';
import './Sidebar.css';

interface SidebarProps {
  activeRoute: string;
  onRouteChange: (route: string) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeRoute, onRouteChange, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'clusters', label: 'Clusters', icon: '🖥️' },
    { id: 'backups', label: 'Backup', icon: '💾' },
    { id: 'restore', label: 'Restore', icon: '🔄' },
    { id: 'schedules', label: 'Schedules', icon: '⏰' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <img src="/logo-simple.svg" alt="Velero Manager" style={{ height: '40px', marginBottom: '8px' }} />
        <h1>Velero Manager</h1>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activeRoute === item.id ? 'active' : ''}`}
            onClick={() => onRouteChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </div>
        ))}
      </nav>
      
      <div className="sidebar-footer">
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
        <div className="version">Version: {APP_VERSION}</div>
      </div>
    </div>
  );
};

export default Sidebar;
