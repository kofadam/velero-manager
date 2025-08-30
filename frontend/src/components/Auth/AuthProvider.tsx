import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthConfig } from '../../services/types';
import { authService } from '../../services/auth';

interface AuthContextType {
  user: User | null;
  authConfig: AuthConfig | null;
  legacyLogin: (username: string, password: string) => Promise<User>;
  oidcLogin: () => Promise<string>;
  handleOIDCCallback: (code: string, state: string) => Promise<User>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Load auth configuration
        const config = await authService.getAuthConfig();
        setAuthConfig(config);

        // Check for existing user session
        const currentUser = authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const legacyLogin = async (username: string, password: string): Promise<User> => {
    const userData = await authService.legacyLogin(username, password);
    setUser(userData);
    return userData;
  };

  const oidcLogin = async (): Promise<string> => {
    return await authService.initiateOIDCLogin();
  };

  const handleOIDCCallback = async (code: string, state: string): Promise<User> => {
    const userData = await authService.handleOIDCCallback(code, state);
    setUser(userData);
    return userData;
  };

  const logout = async (): Promise<void> => {
    await authService.logout();
    setUser(null);
  };

  const value = {
    user,
    authConfig,
    legacyLogin,
    oidcLogin,
    handleOIDCCallback,
    logout,
    isAuthenticated: !!user?.isAuthenticated,
    loading,
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
