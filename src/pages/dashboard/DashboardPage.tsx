import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const { user, tenant } = useAuth();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
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
    </div>
  );
}
