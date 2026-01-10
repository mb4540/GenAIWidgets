import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Tenant } from './TenantsTab';
import type { User } from './UsersTab';

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

interface MembershipsTabProps {
  memberships: Membership[];
  tenants: Tenant[];
  users: User[];
  onCreateMembership: (data: { tenantId: string; userId: string; role: 'owner' | 'member' }) => Promise<void>;
  onDeleteMembership: (id: string) => Promise<void>;
}

export default function MembershipsTab({
  memberships,
  tenants,
  users,
  onCreateMembership,
  onDeleteMembership,
}: MembershipsTabProps): React.ReactElement {
  const [showCreate, setShowCreate] = useState(false);
  const [newTenantId, setNewTenantId] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<'owner' | 'member'>('member');

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
        {memberships.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium">{m.userName}</div>
              <div className="text-sm text-muted-foreground">
                {m.tenantName} • {m.role}
              </div>
            </div>
            <button
              onClick={() => void onDeleteMembership(m.id)}
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
  );
}

export type { Membership };
