import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

interface SignupRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  tenantSlug?: string;
  tenantName?: string;
}

interface User {
  user_id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export default async function handler(req: Request, _context: Context) {
  if (req.method !== 'POST') {
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

  try {
    const body = await req.json() as SignupRequest;
    const { email, password, fullName, phone, tenantSlug, tenantName } = body;

    if (!email || !password || !fullName) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ success: false, error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sql = neon(DATABASE_URL);
    
    const existingUsers = await sql`SELECT user_id FROM users WHERE email = ${email}`;
    if (existingUsers.length > 0) {
      return new Response(JSON.stringify({ success: false, error: 'Email already registered' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const users = await sql`
      INSERT INTO users (email, password_hash, full_name, phone)
      VALUES (${email}, ${passwordHash}, ${fullName}, ${phone || null})
      RETURNING user_id, email, full_name, created_at
    ` as User[];

    const user = users[0];
    if (!user) {
      throw new Error('Failed to create user');
    }

    let tenantId: string | null = null;

    if (tenantSlug) {
      const tenants = await sql`SELECT tenant_id FROM tenants WHERE slug = ${tenantSlug}`;
      if (tenants.length > 0 && tenants[0]) {
        tenantId = tenants[0].tenant_id as string;
        await sql`
          INSERT INTO memberships (tenant_id, user_id, role)
          VALUES (${tenantId}, ${user.user_id}, 'member')
        `;
      }
    } else if (tenantName) {
      const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const newTenants = await sql`
        INSERT INTO tenants (name, slug)
        VALUES (${tenantName}, ${slug})
        RETURNING tenant_id
      `;
      if (newTenants[0]) {
        tenantId = newTenants[0].tenant_id as string;
        await sql`
          INSERT INTO memberships (tenant_id, user_id, role)
          VALUES (${tenantId}, ${user.user_id}, 'owner')
        `;
      }
    }

    const token = jwt.sign(
      { userId: user.user_id, email: user.email, tenantId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.user_id,
        email: user.email,
        fullName: user.full_name,
        createdAt: user.created_at,
      },
      token,
      tenantId,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
