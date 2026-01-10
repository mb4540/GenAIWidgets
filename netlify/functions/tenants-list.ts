import type { Context } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { createErrorResponse, createSuccessResponse } from './lib/auth';

interface TenantRow {
  tenant_id: string;
  name: string;
  slug: string;
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'GET') {
    return createErrorResponse('Method not allowed', 405);
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return createErrorResponse('Server configuration error', 500);
  }

  const sql = neon(DATABASE_URL);

  try {
    const tenants = await sql`
      SELECT tenant_id, name, slug
      FROM tenants
      ORDER BY name
    ` as TenantRow[];

    return createSuccessResponse({
      tenants: tenants.map((t) => ({
        id: t.tenant_id,
        name: t.name,
        slug: t.slug,
      })),
    });
  } catch (error) {
    console.error('Error listing tenants:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
