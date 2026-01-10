import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

interface SigninRequest {
  email: string;
  password: string;
}

interface UserRow {
  user_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  created_at: string;
}

interface MembershipRow {
  tenant_id: string;
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
    const body = await req.json() as SigninRequest;
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sql = neon(DATABASE_URL);
    
    const users = await sql`
      SELECT user_id, email, password_hash, full_name, created_at
      FROM users
      WHERE email = ${email}
    ` as UserRow[];

    const user = users[0];
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid email or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid email or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const memberships = await sql`
      SELECT tenant_id FROM memberships WHERE user_id = ${user.user_id} LIMIT 1
    ` as MembershipRow[];
    
    const tenantId = memberships[0]?.tenant_id || null;

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
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
