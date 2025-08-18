import { User, AuthConfig } from './types';

class AuthService {
  private user: User | null = null;
  private config: AuthConfig = {
    oidcEnabled: false
  };

  async login(username: string, password: string): Promise<User> {
    // Basic auth simulation
    if (username === 'admin' && password === 'admin') {
      this.user = {
        username: 'admin',
        isAuthenticated: true,
        authMethod: 'basic'
      };
      localStorage.setItem('velero_user', JSON.stringify(this.user));
      return this.user;
    }
    throw new Error('Invalid credentials');
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
