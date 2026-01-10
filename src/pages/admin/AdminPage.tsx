import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Users, Building2, UserPlus, Plus, Trash2, Edit2, Shield, ShieldOff } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  isAdmin: boolean;
  createdAt: string;
}

interface Membership {
  id: string;
  tenantId: string;
  tenantName: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: 'owner' | 'member';
  createdAt: string;
}

type TabType = 'tenants' | 'users' | 'memberships';

export default function AdminPage(): React.ReactElement {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('tenants');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);

  const [showCreateMembership, setShowCreateMembership] = useState(false);
  const [newMembershipTenantId, setNewMembershipTenantId] = useState('');
  const [newMembershipUserId, setNewMembershipUserId] = useState('');
  const [newMembershipRole, setNewMembershipRole] = useState<'owner' | 'member'>('member');

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const fetchTenants = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/admin/tenants', { headers: getAuthHeaders() });
      const data = await response.json() as { success: boolean; tenants?: Tenant[]; error?: string };
      if (data.success && data.tenants) {
        setTenants(data.tenants);
      }
    } catch {
      setError('Failed to fetch tenants');
    }
  }, [getAuthHeaders]);

  const fetchUsers = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/admin/users', { headers: getAuthHeaders() });
      const data = await response.json() as { success: boolean; users?: User[]; error?: string };
      if (data.success && data.users) {
        setUsers(data.users);
      }
    } catch {
      setError('Failed to fetch users');
    }
  }, [getAuthHeaders]);

  const fetchMemberships = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/admin/memberships', { headers: getAuthHeaders() });
      const data = await response.json() as { success: boolean; memberships?: Membership[]; error?: string };
      if (data.success && data.memberships) {
        setMemberships(data.memberships);
      }
    } catch {
      setError('Failed to fetch memberships');
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      setLoading(true);
      await Promise.all([fetchTenants(), fetchUsers(), fetchMemberships()]);
      setLoading(false);
    };
    void loadData();
  }, [fetchTenants, fetchUsers, fetchMemberships]);

  const handleCreateTenant = async (): Promise<void> => {
    if (!newTenantName.trim()) return;
    try {
      const response = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: newTenantName }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        setNewTenantName('');
        setShowCreateTenant(false);
        void fetchTenants();
      } else {
        setError(data.error || 'Failed to create tenant');
      }
    } catch {
      setError('Failed to create tenant');
    }
  };

  const handleDeleteTenant = async (tenantId: string): Promise<void> => {
    if (!confirm('Delete this tenant? All associated data will be removed.')) return;
    try {
      const response = await fetch(`/api/admin/tenants?id=${tenantId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        void fetchTenants();
        void fetchMemberships();
      } else {
        setError(data.error || 'Failed to delete tenant');
      }
    } catch {
      setError('Failed to delete tenant');
    }
  };

  const handleCreateUser = async (): Promise<void> => {
    if (!newUserEmail.trim() || !newUserPassword || !newUserFullName.trim()) return;
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          fullName: newUserFullName,
          isAdmin: newUserIsAdmin,
        }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserFullName('');
        setNewUserIsAdmin(false);
        setShowCreateUser(false);
        void fetchUsers();
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch {
      setError('Failed to create user');
    }
  };

  const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean): Promise<void> => {
    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isAdmin: !currentIsAdmin }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        void fetchUsers();
      } else {
        setError(data.error || 'Failed to update user');
      }
    } catch {
      setError('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string): Promise<void> => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        void fetchUsers();
        void fetchMemberships();
      } else {
        setError(data.error || 'Failed to delete user');
      }
    } catch {
      setError('Failed to delete user');
    }
  };

  const handleCreateMembership = async (): Promise<void> => {
    if (!newMembershipTenantId || !newMembershipUserId) return;
    try {
      const response = await fetch('/api/admin/memberships', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          tenantId: newMembershipTenantId,
          userId: newMembershipUserId,
          role: newMembershipRole,
        }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        setNewMembershipTenantId('');
        setNewMembershipUserId('');
        setNewMembershipRole('member');
        setShowCreateMembership(false);
        void fetchMemberships();
      } else {
        setError(data.error || 'Failed to create membership');
      }
    } catch {
      setError('Failed to create membership');
    }
  };

  const handleDeleteMembership = async (membershipId: string): Promise<void> => {
    if (!confirm('Remove this membership?')) return;
    try {
      const response = await fetch(`/api/admin/memberships?id=${membershipId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        void fetchMemberships();
      } else {
        setError(data.error || 'Failed to delete membership');
      }
    } catch {
      setError('Failed to delete membership');
    }
  };

  if (!user?.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const tabs = [
    { id: 'tenants' as const, label: 'Tenants', icon: Building2, count: tenants.length },
    { id: 'users' as const, label: 'Users', icon: Users, count: users.length },
    { id: 'memberships' as const, label: 'Memberships', icon: UserPlus, count: memberships.length },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage tenants, users, and memberships</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-destructive flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{tab.count}</span>
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <>
          {/* Tenants Tab */}
          {activeTab === 'tenants' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Organizations</h2>
                <button
                  onClick={() => setShowCreateTenant(true)}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" /> Add Tenant
                </button>
              </div>

              {showCreateTenant && (
                <div className="bg-card border border-border rounded-lg p-4 space-y-4">
                  <input
                    type="text"
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                    placeholder="Tenant name"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleCreateTenant()}
                      className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => { setShowCreateTenant(false); setNewTenantName(''); }}
                      className="text-muted-foreground px-4 py-2 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-card border border-border rounded-lg divide-y divide-border">
                {tenants.map((tenant) => (
                  <div key={tenant.id} className="flex items-center justify-between p-4">
                    <div>
                      <div className="font-medium">{tenant.name}</div>
                      <div className="text-sm text-muted-foreground">Slug: {tenant.slug}</div>
                    </div>
                    <button
                      onClick={() => void handleDeleteTenant(tenant.id)}
                      className="p-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {tenants.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">No tenants yet</div>
                )}
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Users</h2>
                <button
                  onClick={() => setShowCreateUser(true)}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" /> Add User
                </button>
              </div>

              {showCreateUser && (
                <div className="bg-card border border-border rounded-lg p-4 space-y-4">
                  <input
                    type="text"
                    value={newUserFullName}
                    onChange={(e) => setNewUserFullName(e.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Password (min 8 characters)"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={newUserIsAdmin}
                      onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                      className="rounded"
                    />
                    Make admin
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleCreateUser()}
                      className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => { setShowCreateUser(false); setNewUserEmail(''); setNewUserPassword(''); setNewUserFullName(''); setNewUserIsAdmin(false); }}
                      className="text-muted-foreground px-4 py-2 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-card border border-border rounded-lg divide-y divide-border">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                        {u.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {u.fullName}
                          {u.isAdmin && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Admin</span>}
                        </div>
                        <div className="text-sm text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => void handleToggleAdmin(u.id, u.isAdmin)}
                        className={`p-2 ${u.isAdmin ? 'text-primary' : 'text-muted-foreground'} hover:text-primary`}
                        title={u.isAdmin ? 'Remove admin' : 'Make admin'}
                      >
                        {u.isAdmin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => void handleDeleteUser(u.id)}
                        className="p-2 text-muted-foreground hover:text-destructive"
                        disabled={u.id === user?.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">No users yet</div>
                )}
              </div>
            </div>
          )}

          {/* Memberships Tab */}
          {activeTab === 'memberships' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Memberships</h2>
                <button
                  onClick={() => setShowCreateMembership(true)}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" /> Add Membership
                </button>
              </div>

              {showCreateMembership && (
                <div className="bg-card border border-border rounded-lg p-4 space-y-4">
                  <select
                    value={newMembershipTenantId}
                    onChange={(e) => setNewMembershipTenantId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select tenant...</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <select
                    value={newMembershipUserId}
                    onChange={(e) => setNewMembershipUserId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select user...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                    ))}
                  </select>
                  <select
                    value={newMembershipRole}
                    onChange={(e) => setNewMembershipRole(e.target.value as 'owner' | 'member')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="member">Member</option>
                    <option value="owner">Owner</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleCreateMembership()}
                      className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => { setShowCreateMembership(false); setNewMembershipTenantId(''); setNewMembershipUserId(''); setNewMembershipRole('member'); }}
                      className="text-muted-foreground px-4 py-2 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-card border border-border rounded-lg divide-y divide-border">
                {memberships.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-4">
                    <div>
                      <div className="font-medium">{m.userName}</div>
                      <div className="text-sm text-muted-foreground">
                        {m.tenantName} • {m.role}
                      </div>
                    </div>
                    <button
                      onClick={() => void handleDeleteMembership(m.id)}
                      className="p-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {memberships.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">No memberships yet</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
