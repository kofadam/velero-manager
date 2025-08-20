import React, { useState, useEffect } from 'react';
import Sidebar from './components/Layout/Sidebar.tsx';
import Header from './components/Layout/Header.tsx';
import BackupList from './components/Backups/BackupList.tsx';
import Dashboard from './components/Dashboard/Dashboard.tsx';
import ScheduleList from './components/Schedules/ScheduleList.tsx';
import RestoreList from './components/Restores/RestoreList.tsx';
import Login from './components/Auth/Login.tsx';
import { authService } from './services/auth.ts';
import { User } from './services/types.ts';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeRoute, setActiveRoute] = useState('backups');

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

  const renderContent = () => {
    switch (activeRoute) {
      case 'backups':
        return <BackupList />;
      case 'dashboard':
        return <Dashboard />;
      case 'restore':
        return <RestoreList />;
      case 'schedules':
        return <ScheduleList />;
      case 'settings':
        return <div>Settings Coming Soon...</div>;
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
        onRouteChange={setActiveRoute}
        onLogout={handleLogout}
      />
      <div className="main-layout">
        <Header 
          title="Backups" 
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