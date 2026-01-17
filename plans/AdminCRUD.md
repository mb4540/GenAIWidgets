# Admin Panel CRUD Enhancement Plan

## Overview
Enhance the Admin panel with full CRUD capabilities for Tenants, Users, and Memberships to enable effective management of the multi-tenant system.

## Current State

### Database Schema Relationships
```
users (1) ──────< memberships >────── (1) tenants
         user_id              tenant_id

users (1) ──────< admins
         user_id
```

- A **user** can belong to multiple **tenants** via **memberships**
- A **tenant** can have multiple **users** via **memberships**
- Each **membership** has a role: `owner` or `member`
- A **user** can optionally be a system **admin** (cross-tenant access)

### Existing Capabilities

| Entity | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| **Tenants** | ✅ Name only | ✅ List | ❌ No UI | ✅ |
| **Users** | ✅ Full | ✅ List | ⚠️ Admin toggle only | ✅ |
| **Memberships** | ✅ Full | ✅ List | ❌ No UI | ✅ |

### API Endpoints (All Exist)

| Endpoint | GET | POST | PUT | DELETE |
|----------|-----|------|-----|--------|
| `/api/admin/tenants` | ✅ | ✅ | ✅ | ✅ |
| `/api/admin/users` | ✅ | ✅ | ✅ | ✅ |
| `/api/admin/memberships` | ✅ | ✅ | ✅ | ✅ |

## Gaps to Address

### Tenants Tab
- [ ] Add Edit button and modal to update tenant name
- [ ] Show member count per tenant
- [ ] Add "View Members" action to see/manage tenant's memberships
- [ ] Add search/filter by name
- [ ] Improve delete confirmation with impact summary (member count, file count)

### Users Tab
- [ ] Add Edit button and modal for full user editing (name, phone, email)
- [ ] Show membership count per user
- [ ] Add "View Memberships" action to see/manage user's tenant memberships
- [ ] Add search/filter by name/email
- [ ] Show admin granted date and granted by info
- [ ] Improve delete confirmation with impact summary

### Memberships Tab
- [ ] Add Edit button to change membership role (owner/member)
- [ ] Add search/filter by tenant name, user name, or role
- [ ] Group by tenant or user view toggle
- [ ] Show when membership was created

### Cross-Entity Features
- [ ] Click tenant name → view tenant details with members list
- [ ] Click user name → view user details with memberships list
- [ ] Quick-add membership from tenant or user detail view

---

## Implementation Plan

### Phase 1: Tenants Tab Enhancement

#### 1.1 Edit Tenant Modal
- [ ] Create `TenantEditModal.tsx` component
  - Fields: Name (required)
  - Shows: Slug (read-only, auto-generated)
  - Shows: Created date
  - Shows: Member count
- [ ] Add Edit (pencil) icon button to tenant row
- [ ] Wire up PUT `/api/admin/tenants?id=` call

#### 1.2 Tenant Detail View
- [ ] Create `TenantDetailModal.tsx` component
  - Shows tenant info (name, slug, created)
  - Lists all members with role badges
  - Quick-add member button
  - Remove member button per row
- [ ] Add "View" (eye) icon button to tenant row

#### 1.3 Tenant List Improvements
- [ ] Add search input to filter tenants by name
- [ ] Show member count badge on each tenant row
- [ ] Enhanced delete confirmation showing:
  - Number of members that will lose access
  - Number of files that will be deleted

### Phase 2: Users Tab Enhancement

#### 2.1 Edit User Modal
- [ ] Create `UserEditModal.tsx` component
  - Fields: Full Name, Phone, Email (with validation)
  - Shows: Created date, Updated date
  - Shows: Admin status with granted info
  - Shows: Membership count
- [ ] Add Edit (pencil) icon button to user row
- [ ] Wire up PUT `/api/admin/users?id=` call

#### 2.2 User Detail View
- [ ] Create `UserDetailModal.tsx` component
  - Shows user info (name, email, phone, admin status)
  - Lists all tenant memberships with roles
  - Quick-add to tenant button
  - Remove from tenant button per row
- [ ] Add "View" (eye) icon button to user row

#### 2.3 Users List Improvements
- [ ] Add search input to filter by name or email
- [ ] Show membership count badge on each user row
- [ ] Show admin granted date on hover/tooltip
- [ ] Enhanced delete confirmation showing:
  - Number of memberships that will be removed
  - Warning if user owns any tenants

### Phase 3: Memberships Tab Enhancement

#### 3.1 Edit Membership Role
- [ ] Add role dropdown/toggle inline or via modal
- [ ] Wire up PUT `/api/admin/memberships?id=` call
- [ ] Show confirmation when changing from owner to member

#### 3.2 Memberships List Improvements
- [ ] Add search input to filter by tenant name or user name
- [ ] Add role filter dropdown (All / Owner / Member)
- [ ] Add view toggle: "Group by Tenant" / "Group by User" / "Flat List"
- [ ] Show created date in row

### Phase 4: Shared Components & Polish

#### 4.1 Reusable Components
- [ ] Create `AdminSearchInput.tsx` for consistent search UI
- [ ] Create `AdminConfirmDialog.tsx` for enhanced delete confirmations
- [ ] Create `AdminBadge.tsx` for role/status badges

#### 4.2 Navigation & UX
- [ ] Add breadcrumb when viewing detail modals
- [ ] Add keyboard shortcuts (Escape to close modals)
- [ ] Add loading states for all async operations
- [ ] Add success toast notifications for CRUD operations

#### 4.3 API Enhancements (if needed)
- [ ] Add `memberCount` to tenant list response
- [ ] Add `membershipCount` to user list response
- [ ] Add `fileCount` to tenant for delete confirmation
- [ ] Add `grantedByName` to user admin info

---

## UI Mockups

### Tenant Row (Enhanced)
```
┌─────────────────────────────────────────────────────────────────┐
│ Acme Corp                                    👁 ✏️ 🗑           │
│ Slug: acme-corp • 5 members                                     │
└─────────────────────────────────────────────────────────────────┘
```

### User Row (Enhanced)
```
┌─────────────────────────────────────────────────────────────────┐
│ [J] John Doe                    Admin        👁 ✏️ 🛡 🗑        │
│     john@example.com • 3 tenants                                │
└─────────────────────────────────────────────────────────────────┘
```

### Membership Row (Enhanced)
```
┌─────────────────────────────────────────────────────────────────┐
│ John Doe → Acme Corp            [Owner ▼]           🗑          │
│ Added: Jan 15, 2026                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Edit Tenant Modal
```
┌─────────────────────────────────────────────────────────────────┐
│ Edit Tenant                                               [X]   │
├─────────────────────────────────────────────────────────────────┤
│ Name: [Acme Corporation                              ]          │
│                                                                 │
│ Slug: acme-corp (auto-generated)                                │
│ Created: Jan 10, 2026                                           │
│ Members: 5                                                      │
│                                                                 │
│                              [Cancel]  [Save Changes]           │
└─────────────────────────────────────────────────────────────────┘
```

### Tenant Detail Modal
```
┌─────────────────────────────────────────────────────────────────┐
│ Acme Corporation                                          [X]   │
├─────────────────────────────────────────────────────────────────┤
│ Slug: acme-corp                                                 │
│ Created: Jan 10, 2026                                           │
│                                                                 │
│ Members (5)                              [+ Add Member]         │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ John Doe (john@example.com)      Owner           [Remove]   │ │
│ │ Jane Smith (jane@example.com)    Member          [Remove]   │ │
│ │ ...                                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                                            [Close]              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

### New Components
- `src/pages/admin/components/TenantEditModal.tsx`
- `src/pages/admin/components/TenantDetailModal.tsx`
- `src/pages/admin/components/UserEditModal.tsx`
- `src/pages/admin/components/UserDetailModal.tsx`
- `src/pages/admin/components/AdminSearchInput.tsx`
- `src/pages/admin/components/AdminConfirmDialog.tsx`

### Modified Components
- `src/pages/admin/components/TenantsTab.tsx` - Add edit/view buttons, search, counts
- `src/pages/admin/components/UsersTab.tsx` - Add edit/view buttons, search, counts
- `src/pages/admin/components/MembershipsTab.tsx` - Add role edit, search, filters
- `src/pages/admin/components/index.ts` - Export new components
- `src/pages/admin/AdminPage.tsx` - Add handlers for new operations

### API Enhancements (Optional)
- `netlify/functions/admin-tenants.ts` - Add memberCount to response
- `netlify/functions/admin-users.ts` - Add membershipCount to response

---

## Dependencies
- Existing Lucide icons: Eye, Pencil, Trash2, Plus, Shield, ShieldOff
- New icons needed: Search, Users, Building2, ChevronDown

---

## Testing Considerations
- [ ] Test CRUD operations for each entity
- [ ] Test cascade deletes (tenant delete removes memberships)
- [ ] Test validation (required fields, email format)
- [ ] Test search/filter functionality
- [ ] Test role changes and their effects
- [ ] Test that non-admins cannot access admin panel

---

## Open Questions
- Should we allow email changes for users? (May affect login)
- Should we add password reset functionality for admins?
- Should we add bulk operations (delete multiple, add multiple members)?
- Should we add audit logging for admin actions?
