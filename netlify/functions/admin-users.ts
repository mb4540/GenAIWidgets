import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface UserRow {
  user_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
  is_admin: boolean;
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
      const users = await sql`
        SELECT u.user_id, u.email, u.full_name, u.phone, u.created_at, u.updated_at,
               CASE WHEN a.admin_id IS NOT NULL THEN true ELSE false END AS is_admin
        FROM users u
        LEFT JOIN admins a ON u.user_id = a.user_id
        ORDER BY u.full_name
      ` as UserRow[];

      return createSuccessResponse({
        users: users.map((u) => ({
          id: u.user_id,
          email: u.email,
          fullName: u.full_name,
          phone: u.phone,
          isAdmin: u.is_admin,
          createdAt: u.created_at,
          updatedAt: u.updated_at,
        })),
      });
    }

    if (req.method === 'POST') {
      const body = await req.json() as { 
        email: string; 
        password: string; 
        fullName: string; 
        phone?: string;
        isAdmin?: boolean;
      };
      const { email, password, fullName, phone, isAdmin } = body;

      if (!email || !password || !fullName) {
        return createErrorResponse('Email, password, and full name are required', 400);
      }

      if (password.length < 8) {
        return createErrorResponse('Password must be at least 8 characters', 400);
      }

      const existing = await sql`SELECT user_id FROM users WHERE email = ${email}`;
      if (existing.length > 0) {
        return createErrorResponse('Email already registered', 409);
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const result = await sql`
        INSERT INTO users (email, password_hash, full_name, phone)
        VALUES (${email}, ${passwordHash}, ${fullName}, ${phone || null})
        RETURNING user_id, email, full_name, phone, created_at, updated_at
      ` as UserRow[];

      const user = result[0];

      if (isAdmin) {
        await sql`
          INSERT INTO admins (user_id, granted_by)
          VALUES (${user.user_id}, ${authResult.context.userId})
        `;
      }

      return createSuccessResponse({
        user: {
          id: user.user_id,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          isAdmin: isAdmin || false,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
      }, 201);
    }

    if (req.method === 'PUT') {
      const userId = url.searchParams.get('id');
      if (!userId) {
        return createErrorResponse('User ID required', 400);
      }

      const body = await req.json() as { 
        fullName?: string; 
        phone?: string;
        isAdmin?: boolean;
      };
      const { fullName, phone, isAdmin } = body;

      if (fullName) {
        await sql`
          UPDATE users
          SET full_name = ${fullName}, phone = ${phone || null}, updated_at = now()
          WHERE user_id = ${userId}
        `;
      }

      if (isAdmin !== undefined) {
        if (isAdmin) {
          const existing = await sql`SELECT admin_id FROM admins WHERE user_id = ${userId}`;
          if (existing.length === 0) {
            await sql`
              INSERT INTO admins (user_id, granted_by)
              VALUES (${userId}, ${authResult.context.userId})
            `;
          }
        } else {
          await sql`DELETE FROM admins WHERE user_id = ${userId}`;
        }
      }

      const updated = await sql`
        SELECT u.user_id, u.email, u.full_name, u.phone, u.created_at, u.updated_at,
               CASE WHEN a.admin_id IS NOT NULL THEN true ELSE false END AS is_admin
        FROM users u
        LEFT JOIN admins a ON u.user_id = a.user_id
        WHERE u.user_id = ${userId}
      ` as UserRow[];

      if (updated.length === 0) {
        return createErrorResponse('User not found', 404);
      }

      const user = updated[0];
      return createSuccessResponse({
        user: {
          id: user.user_id,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          isAdmin: user.is_admin,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
      });
    }

    if (req.method === 'DELETE') {
      const userId = url.searchParams.get('id');
      if (!userId) {
        return createErrorResponse('User ID required', 400);
      }

      if (userId === authResult.context.userId) {
        return createErrorResponse('Cannot delete yourself', 400);
      }

      const result = await sql`
        DELETE FROM users WHERE user_id = ${userId}
        RETURNING user_id
      `;

      if (result.length === 0) {
        return createErrorResponse('User not found', 404);
      }

      return createSuccessResponse({ deleted: true, userId });
    }

    return createErrorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error in admin-users:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
