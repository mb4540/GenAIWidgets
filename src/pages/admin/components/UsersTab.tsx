import React, { useState } from 'react';
import { Plus, Trash2, Shield, ShieldOff } from 'lucide-react';

interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  isAdmin: boolean;
  createdAt: string;
}

interface UsersTabProps {
  users: User[];
  currentUserId: string;
  onCreateUser: (data: { email: string; password: string; fullName: string; isAdmin: boolean }) => Promise<void>;
  onToggleAdmin: (userId: string, currentIsAdmin: boolean) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
}

export default function UsersTab({
  users,
  currentUserId,
  onCreateUser,
  onToggleAdmin,
  onDeleteUser,
}: UsersTabProps): React.ReactElement {
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);

  const handleCreate = async (): Promise<void> => {
    if (!newEmail.trim() || !newPassword || !newFullName.trim()) return;
    await onCreateUser({
      email: newEmail,
      password: newPassword,
      fullName: newFullName,
      isAdmin: newIsAdmin,
    });
    setNewEmail('');
    setNewPassword('');
    setNewFullName('');
    setNewIsAdmin(false);
    setShowCreate(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Users</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <input
            type="text"
            value={newFullName}
            onChange={(e) => setNewFullName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newIsAdmin}
              onChange={(e) => setNewIsAdmin(e.target.checked)}
              className="rounded"
            />
            Make admin
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => void handleCreate()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm"
            >
              Create
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewEmail(''); setNewPassword(''); setNewFullName(''); setNewIsAdmin(false); }}
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
                onClick={() => void onToggleAdmin(u.id, u.isAdmin)}
                className={`p-2 ${u.isAdmin ? 'text-primary' : 'text-muted-foreground'} hover:text-primary`}
                title={u.isAdmin ? 'Remove admin' : 'Make admin'}
              >
                {u.isAdmin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              </button>
              <button
                onClick={() => void onDeleteUser(u.id)}
                className="p-2 text-muted-foreground hover:text-destructive"
                disabled={u.id === currentUserId}
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
  );
}

export type { User };
