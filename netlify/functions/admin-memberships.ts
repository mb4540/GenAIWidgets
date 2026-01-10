import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface MembershipRow {
  membership_id: string;
  tenant_id: string;
  tenant_name: string;
  user_id: string;
  user_email: string;
  user_name: string;
  role: 'owner' | 'member';
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
      const tenantId = url.searchParams.get('tenantId');
      const userId = url.searchParams.get('userId');

      let memberships: MembershipRow[];

      if (tenantId) {
        memberships = await sql`
          SELECT m.membership_id, m.tenant_id, t.name AS tenant_name,
                 m.user_id, u.email AS user_email, u.full_name AS user_name,
                 m.role, m.created_at
          FROM memberships m
          JOIN tenants t ON m.tenant_id = t.tenant_id
          JOIN users u ON m.user_id = u.user_id
          WHERE m.tenant_id = ${tenantId}
          ORDER BY u.full_name
        ` as MembershipRow[];
      } else if (userId) {
        memberships = await sql`
          SELECT m.membership_id, m.tenant_id, t.name AS tenant_name,
                 m.user_id, u.email AS user_email, u.full_name AS user_name,
                 m.role, m.created_at
          FROM memberships m
          JOIN tenants t ON m.tenant_id = t.tenant_id
          JOIN users u ON m.user_id = u.user_id
          WHERE m.user_id = ${userId}
          ORDER BY t.name
        ` as MembershipRow[];
      } else {
        memberships = await sql`
          SELECT m.membership_id, m.tenant_id, t.name AS tenant_name,
                 m.user_id, u.email AS user_email, u.full_name AS user_name,
                 m.role, m.created_at
          FROM memberships m
          JOIN tenants t ON m.tenant_id = t.tenant_id
          JOIN users u ON m.user_id = u.user_id
          ORDER BY t.name, u.full_name
        ` as MembershipRow[];
      }

      return createSuccessResponse({
        memberships: memberships.map((m) => ({
          id: m.membership_id,
          tenantId: m.tenant_id,
          tenantName: m.tenant_name,
          userId: m.user_id,
          userEmail: m.user_email,
          userName: m.user_name,
          role: m.role,
          createdAt: m.created_at,
        })),
      });
    }

    if (req.method === 'POST') {
      const body = await req.json() as { 
        tenantId: string; 
        userId: string; 
        role?: 'owner' | 'member';
      };
      const { tenantId, userId, role = 'member' } = body;

      if (!tenantId || !userId) {
        return createErrorResponse('Tenant ID and User ID are required', 400);
      }

      const existing = await sql`
        SELECT membership_id FROM memberships 
        WHERE tenant_id = ${tenantId} AND user_id = ${userId}
      `;
      if (existing.length > 0) {
        return createErrorResponse('Membership already exists', 409);
      }

      const result = await sql`
        INSERT INTO memberships (tenant_id, user_id, role)
        VALUES (${tenantId}, ${userId}, ${role})
        RETURNING membership_id, created_at
      ` as { membership_id: string; created_at: string }[];

      const membership = result[0];

      const details = await sql`
        SELECT t.name AS tenant_name, u.email AS user_email, u.full_name AS user_name
        FROM tenants t, users u
        WHERE t.tenant_id = ${tenantId} AND u.user_id = ${userId}
      ` as { tenant_name: string; user_email: string; user_name: string }[];

      return createSuccessResponse({
        membership: {
          id: membership.membership_id,
          tenantId,
          tenantName: details[0]?.tenant_name,
          userId,
          userEmail: details[0]?.user_email,
          userName: details[0]?.user_name,
          role,
          createdAt: membership.created_at,
        },
      }, 201);
    }

    if (req.method === 'PUT') {
      const membershipId = url.searchParams.get('id');
      if (!membershipId) {
        return createErrorResponse('Membership ID required', 400);
      }

      const body = await req.json() as { role: 'owner' | 'member' };
      const { role } = body;

      if (!role || !['owner', 'member'].includes(role)) {
        return createErrorResponse('Valid role is required', 400);
      }

      const result = await sql`
        UPDATE memberships
        SET role = ${role}
        WHERE membership_id = ${membershipId}
        RETURNING membership_id, tenant_id, user_id, role, created_at
      ` as { membership_id: string; tenant_id: string; user_id: string; role: string; created_at: string }[];

      if (result.length === 0) {
        return createErrorResponse('Membership not found', 404);
      }

      const m = result[0];
      const details = await sql`
        SELECT t.name AS tenant_name, u.email AS user_email, u.full_name AS user_name
        FROM tenants t, users u
        WHERE t.tenant_id = ${m.tenant_id} AND u.user_id = ${m.user_id}
      ` as { tenant_name: string; user_email: string; user_name: string }[];

      return createSuccessResponse({
        membership: {
          id: m.membership_id,
          tenantId: m.tenant_id,
          tenantName: details[0]?.tenant_name,
          userId: m.user_id,
          userEmail: details[0]?.user_email,
          userName: details[0]?.user_name,
          role: m.role,
          createdAt: m.created_at,
        },
      });
    }

    if (req.method === 'DELETE') {
      const membershipId = url.searchParams.get('id');
      if (!membershipId) {
        return createErrorResponse('Membership ID required', 400);
      }

      const result = await sql`
        DELETE FROM memberships WHERE membership_id = ${membershipId}
        RETURNING membership_id
      `;

      if (result.length === 0) {
        return createErrorResponse('Membership not found', 404);
      }

      return createSuccessResponse({ deleted: true, membershipId });
    }

    return createErrorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error in admin-memberships:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
