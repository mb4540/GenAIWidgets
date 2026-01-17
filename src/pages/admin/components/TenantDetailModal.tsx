import React, { useEffect } from 'react';
import { X, UserMinus, Users } from 'lucide-react';

interface Member {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  role: 'owner' | 'member';
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

interface TenantDetailModalProps {
  tenant: Tenant;
  members: Member[];
  onRemoveMember: (membershipId: string) => Promise<void>;
  onAddMember: () => void;
  onClose: () => void;
}

export default function TenantDetailModal({
  tenant,
  members,
  onRemoveMember,
  onAddMember,
  onClose,
}: TenantDetailModalProps): React.ReactElement {
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

  const handleRemoveMember = async (membershipId: string): Promise<void> => {
    if (!confirm('Remove this member from the tenant?')) return;
    await onRemoveMember(membershipId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{tenant.name}</h3>
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
            <span className="font-medium">Slug:</span> {tenant.slug}
          </div>
          <div>
            <span className="font-medium">Created:</span> {formatDate(tenant.createdAt)}
          </div>
        </div>

        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Members ({members.length})</span>
          </div>
          <button
            onClick={onAddMember}
            className="text-sm text-primary hover:text-primary/80"
          >
            + Add Member
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No members yet
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.membershipId}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{member.fullName}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {member.email}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        member.role === 'owner'
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {member.role}
                    </span>
                    <button
                      onClick={() => void handleRemoveMember(member.membershipId)}
                      className="p-1.5 text-muted-foreground hover:text-destructive rounded"
                      title="Remove member"
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
