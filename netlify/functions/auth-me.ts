import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  userId: string;
  email: string;
  tenantId: string | null;
}

interface UserRow {
  user_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  phone_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TenantRow {
  tenant_id: string;
  name: string;
  slug: string;
  role: 'owner' | 'member';
}

interface AdminRow {
  is_admin: boolean;
}

export default async function handler(req: Request, _context: Context) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!DATABASE_URL || !JWT_SECRET) {
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const sql = neon(DATABASE_URL);

    const users = await sql`
      SELECT user_id, email, full_name, phone, phone_verified_at, created_at, updated_at
      FROM users
      WHERE user_id = ${payload.userId}
    ` as UserRow[];

    const user = users[0];
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let tenant: TenantRow | null = null;
    if (payload.tenantId) {
      const tenants = await sql`
        SELECT t.tenant_id, t.name, t.slug, m.role
        FROM tenants t
        JOIN memberships m ON t.tenant_id = m.tenant_id
        WHERE t.tenant_id = ${payload.tenantId} AND m.user_id = ${payload.userId}
      ` as TenantRow[];
      tenant = tenants[0] || null;
    }

    const adminResult = await sql`
      SELECT EXISTS (
        SELECT 1 FROM admins WHERE user_id = ${payload.userId}
      ) AS is_admin
    ` as AdminRow[];
    const isAdmin = adminResult[0]?.is_admin ?? false;

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.user_id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        phoneVerifiedAt: user.phone_verified_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        isAdmin,
      },
      tenant: tenant ? {
        id: tenant.tenant_id,
        name: tenant.name,
        slug: tenant.slug,
        role: tenant.role,
      } : null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
