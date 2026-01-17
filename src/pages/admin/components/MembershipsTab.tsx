import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import type { Tenant } from './TenantsTab';
import type { User } from './UsersTab';
import AdminSearchInput from './AdminSearchInput';

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

type RoleFilter = 'all' | 'owner' | 'member';

interface MembershipsTabProps {
  memberships: Membership[];
  tenants: Tenant[];
  users: User[];
  onCreateMembership: (data: { tenantId: string; userId: string; role: 'owner' | 'member' }) => Promise<void>;
  onDeleteMembership: (id: string) => Promise<void>;
  onUpdateMembershipRole?: (id: string, role: 'owner' | 'member') => Promise<void>;
}

export default function MembershipsTab({
  memberships,
  tenants,
  users,
  onCreateMembership,
  onDeleteMembership,
  onUpdateMembershipRole,
}: MembershipsTabProps): React.ReactElement {
  const [showCreate, setShowCreate] = useState(false);
  const [newTenantId, setNewTenantId] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<'owner' | 'member'>('member');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const filteredMemberships = useMemo(() => {
    let result = memberships;
    
    if (roleFilter !== 'all') {
      result = result.filter((m) => m.role === roleFilter);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.userName.toLowerCase().includes(query) ||
          m.userEmail.toLowerCase().includes(query) ||
          m.tenantName.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [memberships, searchQuery, roleFilter]);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleRoleChange = async (membershipId: string, newRole: 'owner' | 'member'): Promise<void> => {
    if (!onUpdateMembershipRole) return;
    await onUpdateMembershipRole(membershipId, newRole);
  };

  const handleCreate = async (): Promise<void> => {
    if (!newTenantId || !newUserId) return;
    await onCreateMembership({
      tenantId: newTenantId,
      userId: newUserId,
      role: newRole,
    });
    setNewTenantId('');
    setNewUserId('');
    setNewRole('member');
    setShowCreate(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Memberships</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add Membership
        </button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <AdminSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by user or tenant name..."
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Roles</option>
          <option value="owner">Owners</option>
          <option value="member">Members</option>
        </select>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <select
            value={newTenantId}
            onChange={(e) => setNewTenantId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select tenant...</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select user...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
            ))}
          </select>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as 'owner' | 'member')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="member">Member</option>
            <option value="owner">Owner</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => void handleCreate()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm"
            >
              Create
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewTenantId(''); setNewUserId(''); setNewRole('member'); }}
              className="text-muted-foreground px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {filteredMemberships.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-4">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{m.userName}</div>
              <div className="text-sm text-muted-foreground">
                {m.userEmail}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">{m.tenantName}</span>
                <span className="mx-2">•</span>
                <span>Added {formatDate(m.createdAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onUpdateMembershipRole ? (
                <div className="relative">
                  <select
                    value={m.role}
                    onChange={(e) => void handleRoleChange(m.id, e.target.value as 'owner' | 'member')}
                    className={`appearance-none rounded-md border px-3 py-1.5 pr-8 text-xs font-medium cursor-pointer ${
                      m.role === 'owner'
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30'
                    }`}
                  >
                    <option value="member">Member</option>
                    <option value="owner">Owner</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none" />
                </div>
              ) : (
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    m.role === 'owner'
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                      : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {m.role}
                </span>
              )}
              <button
                onClick={() => void onDeleteMembership(m.id)}
                className="p-2 text-muted-foreground hover:text-destructive"
                title="Remove membership"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {filteredMemberships.length === 0 && memberships.length > 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No memberships match your filters
          </div>
        )}
        {memberships.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">No memberships yet</div>
        )}
      </div>
    </div>
  );
}

export type { Membership };
