import { User, AuthConfig, OIDCLoginResponse, AuthResponse } from './types';

class AuthService {
  private user: User | null = null;
  private config: AuthConfig | null = null;
  private token: string | null = null;

  async getAuthConfig(): Promise<AuthConfig> {
    if (!this.config) {
      try {
        const response = await fetch('/api/v1/auth/info');
        if (response.ok) {
          this.config = await response.json();
        } else {
          // Fallback config if endpoint not available
          this.config = {
            oidcEnabled: false,
            legacyAuthEnabled: true,
            authenticated: false
          };
        }
      } catch (error) {
        console.error('Failed to fetch auth config:', error);
        this.config = {
          oidcEnabled: false,
          legacyAuthEnabled: true,
          authenticated: false
        };
      }
    }
    return this.config;
  }

  async legacyLogin(username: string, password: string): Promise<User> {
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid credentials');
      }

      const data: AuthResponse = await response.json();
      return this.handleAuthResponse(data);
    } catch (error) {
      throw new Error('Invalid credentials');
    }
  }

  async initiateOIDCLogin(): Promise<string> {
    try {
      const response = await fetch('/api/v1/auth/oidc/login');
      if (!response.ok) {
        throw new Error('Failed to initiate OIDC login');
      }

      const data: OIDCLoginResponse = await response.json();
      // Store state for verification
      localStorage.setItem('oidc_state', data.state);
      return data.authUrl;
    } catch (error) {
      throw new Error('Failed to initiate OIDC login');
    }
  }

  async handleOIDCCallback(code: string, state: string): Promise<User> {
    try {
      // Verify state
      const storedState = localStorage.getItem('oidc_state');
      if (storedState !== state) {
        throw new Error('Invalid state parameter');
      }

      const response = await fetch(`/api/v1/auth/oidc/callback?code=${code}&state=${state}`);
      if (!response.ok) {
        throw new Error('OIDC callback failed');
      }

      const data: AuthResponse = await response.json();
      localStorage.removeItem('oidc_state');
      return this.handleAuthResponse(data);
    } catch (error) {
      localStorage.removeItem('oidc_state');
      throw new Error('OIDC authentication failed');
    }
  }

  private handleAuthResponse(data: AuthResponse): User {
    this.token = data.token;
    this.user = {
      username: data.username,
      email: data.email,
      fullName: data.fullName,
      isAuthenticated: true,
      authMethod: data.authMethod as any,
      role: data.role,
      oidcRoles: data.roles,
      oidcGroups: data.groups,
    };

    // Store both user info and token
    localStorage.setItem('velero_user', JSON.stringify(this.user));
    localStorage.setItem('velero_token', data.token);
    if (data.idToken) {
      localStorage.setItem('velero_id_token', data.idToken);
    }

    return this.user;
  }

  async logout(): Promise<void> {
    try {
      const token = this.getToken();
      if (token) {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json' 
          },
        });
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      this.user = null;
      this.token = null;
      localStorage.removeItem('velero_user');
      localStorage.removeItem('velero_token');
      localStorage.removeItem('velero_id_token');
      localStorage.removeItem('oidc_state');
    }
  }

  getCurrentUser(): User | null {
    if (!this.user) {
      const stored = localStorage.getItem('velero_user');
      if (stored) {
        try {
          this.user = JSON.parse(stored);
        } catch (error) {
          console.error('Failed to parse stored user data:', error);
          localStorage.removeItem('velero_user');
        }
      }
    }
    return this.user;
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('velero_token');
    }
    return this.token;
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser()?.isAuthenticated || false;
  }

  // Helper method for API calls
  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    }
    return {
      'Content-Type': 'application/json',
    };
  }
}

export const authService = new AuthService();
