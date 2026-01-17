import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Users, Building2, UserPlus, MessageSquare, Info } from 'lucide-react';
import PageInfoModal from '@/components/common/PageInfoModal';
import { adminInfo } from './adminInfo';
import {
  TenantsTab,
  UsersTab,
  MembershipsTab,
  PromptsTab,
  PromptEditModal,
  TenantEditModal,
  TenantDetailModal,
  UserEditModal,
  UserDetailModal,
  type Tenant,
  type User,
  type Membership,
  type Prompt,
  type PromptFormData,
} from './components';

type TabType = 'tenants' | 'users' | 'memberships' | 'prompts';

export default function AdminPage(): React.ReactElement {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('tenants');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [viewingTenant, setViewingTenant] = useState<Tenant | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [promptForm, setPromptForm] = useState<PromptFormData>({
    displayName: '',
    description: '',
    modelProvider: 'google',
    modelName: '',
    systemPrompt: '',
    userPromptTemplate: '',
    temperature: 0.7,
    maxTokens: 4096,
    isActive: true,
  });

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

  const fetchPrompts = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/admin/prompts', { headers: getAuthHeaders() });
      const data = await response.json() as { success: boolean; prompts?: Prompt[]; error?: string };
      if (data.success && data.prompts) {
        setPrompts(data.prompts);
      }
    } catch {
      setError('Failed to fetch prompts');
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      setLoading(true);
      await Promise.all([fetchTenants(), fetchUsers(), fetchMemberships(), fetchPrompts()]);
      setLoading(false);
    };
    void loadData();
  }, [fetchTenants, fetchUsers, fetchMemberships, fetchPrompts]);

  const handleCreateTenant = async (name: string): Promise<void> => {
    try {
      const response = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        void fetchTenants();
      } else {
        setError(data.error || 'Failed to create tenant');
      }
    } catch {
      setError('Failed to create tenant');
    }
  };

  const handleDeleteTenant = async (tenantId: string): Promise<void> => {
    const tenant = tenants.find((t) => t.id === tenantId);
    const memberCount = tenant?.memberCount ?? 0;
    const message = memberCount > 0
      ? `Delete "${tenant?.name}"? This will remove ${memberCount} member${memberCount === 1 ? '' : 's'} and all associated data.`
      : 'Delete this tenant? All associated data will be removed.';
    if (!confirm(message)) return;
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

  const handleUpdateTenant = async (tenantId: string, name: string): Promise<void> => {
    const response = await fetch(`/api/admin/tenants?id=${tenantId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    const data = await response.json() as { success: boolean; error?: string };
    if (!data.success) {
      throw new Error(data.error || 'Failed to update tenant');
    }
    void fetchTenants();
  };

  const handleCreateUser = async (userData: { email: string; password: string; fullName: string; isAdmin: boolean }): Promise<void> => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(userData),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
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
    const userToDelete = users.find((u) => u.id === userId);
    const membershipCount = userToDelete?.membershipCount ?? 0;
    const message = membershipCount > 0
      ? `Delete "${userToDelete?.fullName}"? This will remove ${membershipCount} membership${membershipCount === 1 ? '' : 's'}. This cannot be undone.`
      : 'Delete this user? This cannot be undone.';
    if (!confirm(message)) return;
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

  const handleUpdateUser = async (userId: string, data: { fullName: string; phone: string; email: string }): Promise<void> => {
    const response = await fetch(`/api/admin/users?id=${userId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const result = await response.json() as { success: boolean; error?: string };
    if (!result.success) {
      throw new Error(result.error || 'Failed to update user');
    }
    void fetchUsers();
  };

  const handleCreateMembership = async (membershipData: { tenantId: string; userId: string; role: 'owner' | 'member' }): Promise<void> => {
    try {
      const response = await fetch('/api/admin/memberships', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(membershipData),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
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

  const handleUpdateMembershipRole = async (membershipId: string, role: 'owner' | 'member'): Promise<void> => {
    try {
      const response = await fetch(`/api/admin/memberships?id=${membershipId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        void fetchMemberships();
      } else {
        setError(data.error || 'Failed to update membership role');
      }
    } catch {
      setError('Failed to update membership role');
    }
  };

  const handleEditPrompt = (prompt: Prompt): void => {
    setEditingPrompt(prompt);
    setPromptForm({
      displayName: prompt.displayName,
      description: prompt.description || '',
      modelProvider: prompt.modelProvider,
      modelName: prompt.modelName,
      systemPrompt: prompt.systemPrompt || '',
      userPromptTemplate: prompt.userPromptTemplate,
      temperature: prompt.temperature,
      maxTokens: prompt.maxTokens,
      isActive: prompt.isActive,
    });
  };

  const handleSavePrompt = async (): Promise<void> => {
    if (!editingPrompt) return;
    try {
      const response = await fetch('/api/admin/prompts', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          functionName: editingPrompt.functionName,
          ...promptForm,
        }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        setEditingPrompt(null);
        void fetchPrompts();
      } else {
        setError(data.error || 'Failed to update prompt');
      }
    } catch {
      setError('Failed to update prompt');
    }
  };

  const handleTogglePromptActive = async (prompt: Prompt): Promise<void> => {
    try {
      const response = await fetch('/api/admin/prompts', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          functionName: prompt.functionName,
          isActive: !prompt.isActive,
        }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (data.success) {
        void fetchPrompts();
      } else {
        setError(data.error || 'Failed to toggle prompt');
      }
    } catch {
      setError('Failed to toggle prompt');
    }
  };

  if (!user?.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const tabs = [
    { id: 'tenants' as const, label: 'Tenants', icon: Building2, count: tenants.length },
    { id: 'users' as const, label: 'Users', icon: Users, count: users.length },
    { id: 'memberships' as const, label: 'Memberships', icon: UserPlus, count: memberships.length },
    { id: 'prompts' as const, label: 'Prompts', icon: MessageSquare, count: prompts.length },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage tenants, users, and memberships</p>
        </div>
        <button
          onClick={() => setShowInfo(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="View technical documentation"
        >
          <Info className="h-4 w-4" />
          <span>Details</span>
        </button>
      </div>

      <PageInfoModal
        isOpen={showInfo}
        onClose={() => setShowInfo(false)}
        content={adminInfo}
      />

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-destructive flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-sm underline">Dismiss</button>
        </div>
      )}

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
          {activeTab === 'tenants' && (
            <TenantsTab
              tenants={tenants}
              onCreateTenant={handleCreateTenant}
              onDeleteTenant={handleDeleteTenant}
              onEditTenant={setEditingTenant}
              onViewTenant={setViewingTenant}
            />
          )}

          {activeTab === 'users' && (
            <UsersTab
              users={users}
              currentUserId={user?.id || ''}
              onCreateUser={handleCreateUser}
              onToggleAdmin={handleToggleAdmin}
              onDeleteUser={handleDeleteUser}
              onEditUser={setEditingUser}
              onViewUser={setViewingUser}
            />
          )}

          {activeTab === 'memberships' && (
            <MembershipsTab
              memberships={memberships}
              tenants={tenants}
              users={users}
              onCreateMembership={handleCreateMembership}
              onDeleteMembership={handleDeleteMembership}
              onUpdateMembershipRole={handleUpdateMembershipRole}
            />
          )}

          {activeTab === 'prompts' && (
            <PromptsTab
              prompts={prompts}
              onEdit={handleEditPrompt}
              onToggleActive={handleTogglePromptActive}
            />
          )}
        </>
      )}

      {editingPrompt && (
        <PromptEditModal
          prompt={editingPrompt}
          formData={promptForm}
          onFormChange={setPromptForm}
          onSave={() => void handleSavePrompt()}
          onClose={() => setEditingPrompt(null)}
        />
      )}

      {editingTenant && (
        <TenantEditModal
          tenant={editingTenant}
          onSave={handleUpdateTenant}
          onClose={() => setEditingTenant(null)}
        />
      )}

      {viewingTenant && (
        <TenantDetailModal
          tenant={viewingTenant}
          members={memberships
            .filter((m) => m.tenantId === viewingTenant.id)
            .map((m) => {
              const memberUser = users.find((u) => u.id === m.userId);
              return {
                membershipId: m.id,
                userId: m.userId,
                fullName: memberUser?.fullName || 'Unknown',
                email: memberUser?.email || '',
                role: m.role,
              };
            })}
          onRemoveMember={handleDeleteMembership}
          onAddMember={() => {
            setViewingTenant(null);
            setActiveTab('memberships');
          }}
          onClose={() => setViewingTenant(null)}
        />
      )}

      {editingUser && (
        <UserEditModal
          user={editingUser}
          onSave={handleUpdateUser}
          onClose={() => setEditingUser(null)}
        />
      )}

      {viewingUser && (
        <UserDetailModal
          user={viewingUser}
          memberships={memberships
            .filter((m) => m.userId === viewingUser.id)
            .map((m) => {
              const memberTenant = tenants.find((t) => t.id === m.tenantId);
              return {
                membershipId: m.id,
                tenantId: m.tenantId,
                tenantName: memberTenant?.name || 'Unknown',
                role: m.role,
              };
            })}
          onRemoveMembership={handleDeleteMembership}
          onAddMembership={() => {
            setViewingUser(null);
            setActiveTab('memberships');
          }}
          onClose={() => setViewingUser(null)}
        />
      )}
    </div>
  );
}
