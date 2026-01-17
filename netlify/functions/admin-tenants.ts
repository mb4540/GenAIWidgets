import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface TenantRow {
  tenant_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    return createErrorResponse(authResult.error, authResult.status);
  }

  if (!authResult.context.isAdmin) {
    return createErrorResponse('Admin access required', 403);
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);
  const url = new URL(req.url);

  try {
    if (req.method === 'GET') {
      const tenants = await sql`
        SELECT 
          t.tenant_id, 
          t.name, 
          t.slug, 
          t.created_at,
          COUNT(m.membership_id)::int as member_count
        FROM tenants t
        LEFT JOIN memberships m ON t.tenant_id = m.tenant_id
        GROUP BY t.tenant_id, t.name, t.slug, t.created_at
        ORDER BY t.name
      ` as (TenantRow & { member_count: number })[];

      return createSuccessResponse({
        tenants: tenants.map((t) => ({
          id: t.tenant_id,
          name: t.name,
          slug: t.slug,
          createdAt: t.created_at,
          memberCount: t.member_count,
        })),
      });
    }

    if (req.method === 'POST') {
      const body = await req.json() as { name: string };
      const { name } = body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return createErrorResponse('Tenant name is required', 400);
      }

      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const existing = await sql`SELECT tenant_id FROM tenants WHERE slug = ${slug}`;
      if (existing.length > 0) {
        return createErrorResponse('Tenant with this name already exists', 409);
      }

      const result = await sql`
        INSERT INTO tenants (name, slug)
        VALUES (${name.trim()}, ${slug})
        RETURNING tenant_id, name, slug, created_at
      ` as TenantRow[];

      const tenant = result[0];
      if (!tenant) {
        return createErrorResponse('Failed to create tenant', 500);
      }
      return createSuccessResponse({
        tenant: {
          id: tenant.tenant_id,
          name: tenant.name,
          slug: tenant.slug,
          createdAt: tenant.created_at,
        },
      }, 201);
    }

    if (req.method === 'PUT') {
      const tenantId = url.searchParams.get('id');
      if (!tenantId) {
        return createErrorResponse('Tenant ID required', 400);
      }

      const body = await req.json() as { name: string };
      const { name } = body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return createErrorResponse('Tenant name is required', 400);
      }

      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const result = await sql`
        UPDATE tenants
        SET name = ${name.trim()}, slug = ${slug}
        WHERE tenant_id = ${tenantId}
        RETURNING tenant_id, name, slug, created_at
      ` as TenantRow[];

      if (result.length === 0) {
        return createErrorResponse('Tenant not found', 404);
      }

      const tenant = result[0];
      if (!tenant) {
        return createErrorResponse('Tenant not found', 404);
      }
      return createSuccessResponse({
        tenant: {
          id: tenant.tenant_id,
          name: tenant.name,
          slug: tenant.slug,
          createdAt: tenant.created_at,
        },
      });
    }

    if (req.method === 'DELETE') {
      const tenantId = url.searchParams.get('id');
      if (!tenantId) {
        return createErrorResponse('Tenant ID required', 400);
      }

      const result = await sql`
        DELETE FROM tenants WHERE tenant_id = ${tenantId}
        RETURNING tenant_id
      `;

      if (result.length === 0) {
        return createErrorResponse('Tenant not found', 404);
      }

      return createSuccessResponse({ deleted: true, tenantId });
    }

    return createErrorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error in admin-tenants:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
