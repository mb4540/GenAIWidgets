import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth } from '@/lib/auth-client';
import type { User, Tenant, SignupRequest, AuthResponse } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  signUp: (data: SignupRequest) => Promise<AuthResponse>;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const session = await auth.getSession();
        if (session) {
          setUser(session.user);
          setTenant(session.tenant);
        }
      } finally {
        setLoading(false);
      }
    };

    void initAuth();

    const unsubscribe = auth.onAuthStateChange((newUser, newTenant) => {
      setUser(newUser);
      setTenant(newTenant);
    });

    return unsubscribe;
  }, []);

  const signUp = async (data: SignupRequest): Promise<AuthResponse> => {
    return auth.signUp(data);
  };

  const signIn = async (email: string, password: string): Promise<AuthResponse> => {
    const response = await auth.signInWithPassword(email, password);
    if (response.success) {
      const session = await auth.getSession();
      if (session) {
        setUser(session.user);
        setTenant(session.tenant);
      }
    }
    return response;
  };

  const signOut = async (): Promise<void> => {
    return auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, tenant, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
