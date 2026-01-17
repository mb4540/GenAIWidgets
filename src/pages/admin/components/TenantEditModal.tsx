import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount?: number;
}

interface TenantEditModalProps {
  tenant: Tenant;
  onSave: (tenantId: string, name: string) => Promise<void>;
  onClose: () => void;
}

export default function TenantEditModal({
  tenant,
  onSave,
  onClose,
}: TenantEditModalProps): React.ReactElement {
  const [name, setName] = useState(tenant.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) {
      setError('Tenant name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(tenant.id, name.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tenant');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Edit Tenant</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tenant name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <div>
              <span className="font-medium">Slug:</span> {tenant.slug}
              <span className="text-xs ml-2">(auto-generated)</span>
            </div>
            <div>
              <span className="font-medium">Created:</span> {formatDate(tenant.createdAt)}
            </div>
            {tenant.memberCount !== undefined && (
              <div>
                <span className="font-medium">Members:</span> {tenant.memberCount}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
