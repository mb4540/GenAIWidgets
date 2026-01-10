import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

interface TenantsTabProps {
  tenants: Tenant[];
  onCreateTenant: (name: string) => Promise<void>;
  onDeleteTenant: (id: string) => Promise<void>;
}

export default function TenantsTab({
  tenants,
  onCreateTenant,
  onDeleteTenant,
}: TenantsTabProps): React.ReactElement {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

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
        {tenants.map((tenant) => (
          <div key={tenant.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium">{tenant.name}</div>
              <div className="text-sm text-muted-foreground">Slug: {tenant.slug}</div>
            </div>
            <button
              onClick={() => void onDeleteTenant(tenant.id)}
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
  );
}

export type { Tenant };
