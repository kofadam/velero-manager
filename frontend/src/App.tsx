import React, { useState, useEffect } from 'react';
import Sidebar from './components/Layout/Sidebar.tsx';
import Header from './components/Layout/Header.tsx';
import BackupList from './components/Backups/BackupList.tsx';
import Dashboard from './components/Dashboard/Dashboard.tsx';
import Clusters from './components/Clusters/Clusters.tsx';
import ScheduleList from './components/Schedules/ScheduleList.tsx';
import RestoreList from './components/Restores/RestoreList.tsx';
import Settings from './components/Settings/Settings.tsx';
import Login from './components/Auth/Login.tsx';
import { authService } from './services/auth.ts';
import { User } from './services/types.ts';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeRoute, setActiveRoute] = useState(() => {
    const hash = window.location.hash.slice(1);
    return hash || 'dashboard';
  });

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  const handleRouteChange = (route: string) => {
    setActiveRoute(route);
    window.location.hash = route;
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
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <Sidebar 
        activeRoute={activeRoute}
        onRouteChange={handleRouteChange}
        onLogout={handleLogout}
      />
      <div className="main-layout">
        <Header 
          title={activeRoute.charAt(0).toUpperCase() + activeRoute.slice(1)} 
          user={user.username}
        />
        <main className="main-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;