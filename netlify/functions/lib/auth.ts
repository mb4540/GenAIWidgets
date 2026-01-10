import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  email: string;
  tenantId: string | null;
}

export interface AuthContext {
  userId: string;
  email: string;
  tenantId: string | null;
  isAdmin: boolean;
}

export interface AuthResult {
  success: true;
  context: AuthContext;
}

export interface AuthError {
  success: false;
  error: string;
  status: number;
}

export type AuthResponse = AuthResult | AuthError;

export async function authenticateRequest(req: Request): Promise<AuthResponse> {
  const DATABASE_URL = process.env.DATABASE_URL;
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!DATABASE_URL || !JWT_SECRET) {
    return { success: false, error: 'Server configuration error', status: 500 };
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const sql = neon(DATABASE_URL);

    const adminResult = await sql`
      SELECT EXISTS (
        SELECT 1 FROM admins WHERE user_id = ${payload.userId}
      ) AS is_admin
    ` as { is_admin: boolean }[];
    const isAdmin = adminResult[0]?.is_admin ?? false;

    return {
      success: true,
      context: {
        userId: payload.userId,
        email: payload.email,
        tenantId: payload.tenantId,
        isAdmin,
      },
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return { success: false, error: 'Invalid token', status: 401 };
    }
    return { success: false, error: 'Internal server error', status: 500 };
  }
}


export async function authorizeAccess(
  context: AuthContext,
  resourceTenantId: string
): Promise<{ canAccess: boolean; isAdmin: boolean }> {
  if (context.isAdmin) {
    return { canAccess: true, isAdmin: true };
  }

  if (context.tenantId === resourceTenantId) {
    return { canAccess: true, isAdmin: false };
  }

  return { canAccess: false, isAdmin: false };
}

export function createErrorResponse(error: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createSuccessResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
