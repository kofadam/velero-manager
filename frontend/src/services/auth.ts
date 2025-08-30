import { User, AuthConfig } from './types';

class AuthService {
  private user: User | null = null;
  private config: AuthConfig = {
    oidcEnabled: false
  };

  async login(username: string, password: string): Promise<User> {
    try {
      const response = await fetch('/api/v1/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await response.json();
      this.user = {
        username: data.username,
        isAuthenticated: true,
        authMethod: 'basic',
        role: data.role,
      };
      localStorage.setItem('velero_user', JSON.stringify(this.user));
      return this.user;
    } catch (error) {
      throw new Error('Invalid credentials');
    }
  }

  logout(): void {
    this.user = null;
    localStorage.removeItem('velero_user');
  }

  getCurrentUser(): User | null {
    if (!this.user) {
      const stored = localStorage.getItem('velero_user');
      if (stored) {
        this.user = JSON.parse(stored);
      }
    }
    return this.user;
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser()?.isAuthenticated || false;
  }
}

export const authService = new AuthService();
