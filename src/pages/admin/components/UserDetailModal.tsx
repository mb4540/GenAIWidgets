import React, { useEffect } from 'react';
import { X, UserMinus, Building2 } from 'lucide-react';

interface TenantMembership {
  membershipId: string;
  tenantId: string;
  tenantName: string;
  role: 'owner' | 'member';
}

interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  isAdmin: boolean;
  createdAt: string;
}

interface UserDetailModalProps {
  user: User;
  memberships: TenantMembership[];
  onRemoveMembership: (membershipId: string) => Promise<void>;
  onAddMembership: () => void;
  onClose: () => void;
}

export default function UserDetailModal({
  user,
  memberships,
  onRemoveMembership,
  onAddMembership,
  onClose,
}: UserDetailModalProps): React.ReactElement {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleRemoveMembership = async (membershipId: string): Promise<void> => {
    if (!confirm('Remove this membership?')) return;
    await onRemoveMembership(membershipId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-medium text-primary-foreground">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{user.fullName}</h3>
              {user.isAdmin && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  Admin
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="text-sm text-muted-foreground space-y-1 mb-4 pb-4 border-b border-border">
          <div>
            <span className="font-medium">Email:</span> {user.email}
          </div>
          {user.phone && (
            <div>
              <span className="font-medium">Phone:</span> {user.phone}
            </div>
          )}
          <div>
            <span className="font-medium">Created:</span> {formatDate(user.createdAt)}
          </div>
        </div>

        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Tenant Memberships ({memberships.length})</span>
          </div>
          <button
            onClick={onAddMembership}
            className="text-sm text-primary hover:text-primary/80"
          >
            + Add to Tenant
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {memberships.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tenant memberships
            </div>
          ) : (
            <div className="space-y-2">
              {memberships.map((membership) => (
                <div
                  key={membership.membershipId}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{membership.tenantName}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        membership.role === 'owner'
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {membership.role}
                    </span>
                    <button
                      onClick={() => void handleRemoveMembership(membership.membershipId)}
                      className="p-1.5 text-muted-foreground hover:text-destructive rounded"
                      title="Remove from tenant"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 mt-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
