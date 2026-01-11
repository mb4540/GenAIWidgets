import type { PageInfoContent } from '@/components/common/PageInfoModal';

export const adminInfo: PageInfoContent = {
  title: 'Admin',
  overview: `The Admin page provides system administration capabilities for managing the multi-tenant GenAI Widgets platform.

Admin Tabs:
• Users: Manage user accounts, roles, and authentication status
• Tenants: Create and configure tenant organizations
• Memberships: Assign users to tenants with specific roles (owner, admin, member)
• Prompts: Configure LLM prompts for extraction, Q&A generation, and chat

Access Control:
Only users with isAdmin=true can access this page. Regular users are redirected to the dashboard.

Key Capabilities:
• Create new tenants for organizations
• Invite users and assign them to tenants
• Configure role-based access (owner has full control, admin can manage, member has read/write)
• Edit system prompts including model selection, temperature, and token limits
• View and manage all platform resources across tenants`,

  architecture: `┌─────────────────────────────────────────────────────────────┐
│                      Admin Page UI                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tabs: Users | Tenants | Memberships | Prompts       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Tab Content                         │   │
│  │  - Data table with CRUD operations                   │   │
│  │  - Modal forms for create/edit                       │   │
│  │  - Confirmation dialogs for delete                   │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  users API      │   │  tenants API    │   │  prompts API    │
│  memberships API│   │                 │   │                 │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Neon)                         │
│        users | tenants | memberships | prompts              │
└─────────────────────────────────────────────────────────────┘`,

  tables: [
    {
      name: 'users',
      description: 'User accounts with authentication and admin status',
      columns: ['user_id', 'email', 'password_hash', 'full_name', 'is_admin', 'created_at', 'last_login'],
      relationships: [],
    },
    {
      name: 'tenants',
      description: 'Organization/tenant entities for multi-tenancy',
      columns: ['tenant_id', 'name', 'slug', 'created_at'],
      relationships: [],
    },
    {
      name: 'memberships',
      description: 'User-to-tenant assignments with roles',
      columns: ['membership_id', 'user_id', 'tenant_id', 'role', 'created_at'],
      relationships: ['user_id → users.user_id', 'tenant_id → tenants.tenant_id'],
    },
    {
      name: 'prompts',
      description: 'Configurable LLM prompts for various system functions',
      columns: ['prompt_id', 'prompt_name', 'description', 'system_prompt', 'user_prompt_template', 'model_name', 'temperature', 'max_tokens', 'created_at', 'updated_at'],
      relationships: [],
    },
  ],

  apis: [
    {
      method: 'GET',
      path: '/api/admin/users',
      description: 'List all users in the system (admin only).',
      responseBody: `{
  "success": true,
  "users": [
    { "userId": "uuid", "email": "user@example.com", "fullName": "John Doe", "isAdmin": false }
  ]
}`,
    },
    {
      method: 'POST',
      path: '/api/admin/users',
      description: 'Create a new user account.',
      requestBody: `{ "email": "new@example.com", "fullName": "Jane Doe", "password": "...", "isAdmin": false }`,
      responseBody: `{ "success": true, "userId": "uuid" }`,
    },
    {
      method: 'GET',
      path: '/api/admin/tenants',
      description: 'List all tenants in the system.',
      responseBody: `{
  "success": true,
  "tenants": [
    { "tenantId": "uuid", "name": "Acme Corp", "slug": "acme", "memberCount": 5 }
  ]
}`,
    },
    {
      method: 'POST',
      path: '/api/admin/tenants',
      description: 'Create a new tenant organization.',
      requestBody: `{ "name": "New Org", "slug": "new-org" }`,
      responseBody: `{ "success": true, "tenantId": "uuid" }`,
    },
    {
      method: 'GET',
      path: '/api/admin/memberships',
      description: 'List all user-tenant memberships.',
      responseBody: `{
  "success": true,
  "memberships": [
    { "membershipId": "uuid", "userId": "uuid", "tenantId": "uuid", "role": "owner", "userName": "...", "tenantName": "..." }
  ]
}`,
    },
    {
      method: 'POST',
      path: '/api/admin/memberships',
      description: 'Assign a user to a tenant with a role.',
      requestBody: `{ "userId": "uuid", "tenantId": "uuid", "role": "member" }`,
      responseBody: `{ "success": true, "membershipId": "uuid" }`,
    },
    {
      method: 'GET',
      path: '/api/prompts',
      description: 'List all configurable prompts.',
      responseBody: `{
  "success": true,
  "prompts": [
    { "promptId": "uuid", "promptName": "extract_document", "modelName": "gemini-2.0-flash", "temperature": 0.1 }
  ]
}`,
    },
    {
      method: 'PUT',
      path: '/api/prompts',
      description: 'Update a prompt configuration.',
      requestBody: `{ "promptId": "uuid", "systemPrompt": "...", "modelName": "gemini-2.0-flash", "temperature": 0.2 }`,
      responseBody: `{ "success": true }`,
    },
  ],
};
