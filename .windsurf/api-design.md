# API Design Rules

Standards for Netlify Functions (serverless APIs).

---

## Overview

Netlify Functions provide serverless API endpoints that scale automatically. These rules ensure consistent, secure, and maintainable API design.

---

## REST Conventions

### HTTP Methods

| Method | Purpose | Idempotent | Request Body |
|--------|---------|------------|--------------|
| GET | Retrieve resource(s) | Yes | No |
| POST | Create resource | No | Yes |
| PUT | Replace resource | Yes | Yes |
| PATCH | Partial update | Yes | Yes |
| DELETE | Remove resource | Yes | Optional |

### URL Structure

```
/api/{resource}           # Collection
/api/{resource}/{id}      # Single resource
/api/{resource}/{id}/{sub}  # Nested resource
```

### Naming Conventions

- Use lowercase with hyphens: `/api/user-profiles`
- Use plural nouns for collections: `/api/users`
- Use nouns, not verbs: `/api/orders` not `/api/get-orders`
- Nest logically: `/api/users/{id}/orders`

---

## Function Types

### Standard Functions

**Use for**:
- Synchronous operations
- Quick database queries
- Authentication
- Most API endpoints

**Constraints**:
- 10-second timeout (default)
- 26-second maximum
- Synchronous response required

### Background Functions

**Use for**:
- Long-running operations
- Email sending
- Data processing
- Webhook handling

**Naming**: Append `-background` to function name

**Constraints**:
- 15-minute timeout
- No synchronous response
- Must handle own error reporting

### When to Use Each

| Scenario | Function Type |
|----------|---------------|
| User authentication | Standard |
| Data CRUD operations | Standard |
| File processing | Background |
| Sending emails | Background |
| Webhook processing | Background |
| Report generation | Background |

---

## Request Handling

### Request Structure

```typescript
interface APIRequest {
  httpMethod: string;
  path: string;
  headers: Record<string, string>;
  queryStringParameters: Record<string, string> | null;
  body: string | null;
}
```

### Input Validation

- Validate all input before processing
- Return 400 for invalid input with specific errors
- Use TypeScript types for request bodies
- Sanitize strings before database operations

### Required Validations

- Content-Type header for POST/PUT/PATCH
- Required fields present
- Field types correct
- Field values within acceptable ranges
- String lengths within limits

---

## Response Structure

### Success Response

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}
```

### Error Response

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}
```

### HTTP Status Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource |
| 422 | Unprocessable | Valid syntax, invalid semantics |
| 500 | Server Error | Unexpected errors |

---

## Error Handling

### Error Codes

Define consistent error codes:

```typescript
const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

### Error Messages

- User-friendly messages for client display
- Do not expose internal details
- Do not expose stack traces
- Include actionable guidance when possible

### Error Logging

- Log full error details server-side
- Include request context (sanitized)
- Include correlation ID
- Do not log sensitive data

---

## Authentication & Authorization

### Token Validation

```typescript
// Required pattern for authenticated endpoints
const authHeader = event.headers.authorization;
if (!authHeader?.startsWith('Bearer ')) {
  return { statusCode: 401, body: JSON.stringify({ 
    success: false, 
    error: { code: 'AUTHENTICATION_REQUIRED', message: 'Missing authorization' }
  })};
}

const token = authHeader.slice(7);
const payload = verifyToken(token); // Throws on invalid
```

### Authorization Checks

- Verify resource ownership
- Check tenant membership
- Validate role permissions
- Fail closed (deny by default)

---

## Logging Standards

### What to Log

- Request received (method, path, timestamp)
- Authentication result (success/failure, user ID)
- Business logic decisions
- External service calls
- Response sent (status code, duration)
- Errors with context

### Log Format

```typescript
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  requestId: string;
  message: string;
  context?: Record<string, unknown>;
}
```

### What NOT to Log

- Passwords or tokens
- Full request bodies with sensitive data
- Database connection strings
- API keys
- Personal identifiable information

---

## Versioning Strategy

### URL Versioning

```
/api/v1/users
/api/v2/users
```

### When to Version

- Breaking changes to request/response structure
- Removing fields or endpoints
- Changing field types
- Changing validation rules

### Backward Compatibility

- Add new fields without versioning
- Deprecate before removing
- Support old versions for transition period
- Document deprecation timeline

---

## Performance

### Response Time Targets

| Endpoint Type | Target | Maximum |
|---------------|--------|---------|
| Authentication | < 200ms | 500ms |
| Simple CRUD | < 100ms | 300ms |
| Complex queries | < 500ms | 2s |
| Background jobs | N/A | 15min |

### Optimization Techniques

- Use database indexes
- Limit result sets
- Avoid N+1 queries
- Cache when appropriate
- Use connection pooling

### Cold Start Mitigation

- Keep functions small
- Minimize dependencies
- Use lazy initialization
- Consider scheduled pings for critical endpoints

---

## Security

### Required Headers

```typescript
const securityHeaders = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
```

### CORS Configuration

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

### Rate Limiting

- Implement per-user rate limits
- Stricter limits on authentication endpoints
- Return 429 with Retry-After header
- Log rate limit violations

---

## Function Template

```typescript
import { Handler } from '@netlify/functions';

interface RequestBody {
  // Define expected request shape
}

interface ResponseData {
  // Define response shape
}

export const handler: Handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    // 1. Validate request
    // 2. Authenticate if required
    // 3. Authorize if required
    // 4. Process business logic
    // 5. Return response

    return {
      statusCode: 200,
      headers: { ...securityHeaders, ...corsHeaders },
      body: JSON.stringify({ success: true, data: result }),
    };
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: { ...securityHeaders, ...corsHeaders },
      body: JSON.stringify({ 
        success: false, 
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' }
      }),
    };
  }
};
```

---

## Checklist

Before deploying an API endpoint:

- [ ] Input validation implemented
- [ ] Error handling complete
- [ ] Authentication/authorization checked
- [ ] Response structure follows standard
- [ ] Appropriate status codes used
- [ ] Security headers included
- [ ] Logging implemented (sanitized)
- [ ] Performance acceptable
- [ ] Documentation updated

---

*APIs are contracts. Design them carefully and change them thoughtfully.*
