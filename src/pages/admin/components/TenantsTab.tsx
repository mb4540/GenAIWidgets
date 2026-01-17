import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Pencil, Eye, Users } from 'lucide-react';
import AdminSearchInput from './AdminSearchInput';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount?: number;
}

interface TenantsTabProps {
  tenants: Tenant[];
  onCreateTenant: (name: string) => Promise<void>;
  onDeleteTenant: (id: string) => Promise<void>;
  onEditTenant?: (tenant: Tenant) => void;
  onViewTenant?: (tenant: Tenant) => void;
}

export default function TenantsTab({
  tenants,
  onCreateTenant,
  onDeleteTenant,
  onEditTenant,
  onViewTenant,
}: TenantsTabProps): React.ReactElement {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTenants = useMemo(() => {
    if (!searchQuery.trim()) return tenants;
    const query = searchQuery.toLowerCase();
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.slug.toLowerCase().includes(query)
    );
  }, [tenants, searchQuery]);

  const handleCreate = async (): Promise<void> => {
    if (!newName.trim()) return;
    await onCreateTenant(newName);
    setNewName('');
    setShowCreate(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Organizations</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add Tenant
        </button>
      </div>

      <AdminSearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search tenants by name..."
      />

      {showCreate && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tenant name"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => void handleCreate()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm"
            >
              Create
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(''); }}
              className="text-muted-foreground px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {filteredTenants.map((tenant) => (
          <div key={tenant.id} className="flex items-center justify-between p-4">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{tenant.name}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-3">
                <span>Slug: {tenant.slug}</span>
                {tenant.memberCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {tenant.memberCount} {tenant.memberCount === 1 ? 'member' : 'members'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onViewTenant && (
                <button
                  onClick={() => onViewTenant(tenant)}
                  className="p-2 text-muted-foreground hover:text-foreground"
                  title="View details"
                >
                  <Eye className="h-4 w-4" />
                </button>
              )}
              {onEditTenant && (
                <button
                  onClick={() => onEditTenant(tenant)}
                  className="p-2 text-muted-foreground hover:text-foreground"
                  title="Edit tenant"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => void onDeleteTenant(tenant.id)}
                className="p-2 text-muted-foreground hover:text-destructive"
                title="Delete tenant"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {filteredTenants.length === 0 && tenants.length > 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No tenants match your search
          </div>
        )}
        {tenants.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">No tenants yet</div>
        )}
      </div>
    </div>
  );
}

export type { Tenant };
