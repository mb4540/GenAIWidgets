import type { User, Tenant, SignupRequest, SigninRequest, AuthResponse, MeResponse } from '@/types/auth';

const TOKEN_KEY = 'auth_token';

type AuthStateCallback = (user: User | null, tenant: Tenant | null) => void;

class AuthClient {
  private user: User | null = null;
  private tenant: Tenant | null = null;
  private token: string | null = null;
  private listeners: Set<AuthStateCallback> = new Set();

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.user, this.tenant));
  }

  private setToken(token: string | null): void {
    this.token = token;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.setToken(null);
      this.user = null;
      this.tenant = null;
      this.notifyListeners();
    }

    const data = await response.json() as T;
    return data;
  }

  async signUp(data: SignupRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.success) {
      this.setToken(response.token);
      this.user = response.user;
      this.notifyListeners();
    }

    return response;
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResponse> {
    const data: SigninRequest = { email, password };
    const response = await this.request<AuthResponse>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.success) {
      this.setToken(response.token);
      this.user = response.user;
      this.notifyListeners();
    }

    return response;
  }

  async signOut(): Promise<void> {
    this.setToken(null);
    this.user = null;
    this.tenant = null;
    this.notifyListeners();
  }

  async getSession(): Promise<{ user: User; tenant: Tenant | null } | null> {
    if (!this.token) {
      return null;
    }

    try {
      const response = await this.request<MeResponse>('/auth/me');
      if (response.success) {
        this.user = response.user;
        this.tenant = response.tenant;
        this.notifyListeners();
        return { user: response.user, tenant: response.tenant };
      }
    } catch {
      this.setToken(null);
      this.user = null;
      this.tenant = null;
    }

    return null;
  }

  getUser(): User | null {
    return this.user;
  }

  getTenant(): Tenant | null {
    return this.tenant;
  }

  getToken(): string | null {
    return this.token;
  }

  onAuthStateChange(callback: AuthStateCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const auth = new AuthClient();
