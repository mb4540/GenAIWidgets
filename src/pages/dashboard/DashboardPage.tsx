import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-medium text-card-foreground">Welcome back!</h2>
          <p className="mt-2 text-muted-foreground">
            You are signed in as <strong>{user?.fullName}</strong>.
          </p>
          {tenant && (
            <p className="mt-2 text-muted-foreground">
              Organization: <strong>{tenant.name}</strong> ({tenant.role})
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
