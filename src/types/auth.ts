export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  phoneVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'member';
}

export interface Session {
  user: User;
  tenant: Tenant | null;
  token: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  tenantSlug?: string;
  tenantName?: string;
}

export interface SigninRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: true;
  user: User;
  token: string;
  tenantId: string | null;
}

export interface MeResponse {
  success: true;
  user: User;
  tenant: Tenant | null;
}
