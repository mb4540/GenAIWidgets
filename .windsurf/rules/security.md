# Security Rules

Standards for protecting sensitive data and preventing vulnerabilities in React + Netlify Functions applications.

---

## Environment Variables & Secrets

### Required Practices

- Store all secrets in environment variables, never in code
- Use `.env.example` to document required variables without values
- Access secrets only in server-side code (Netlify Functions)
- Validate that required environment variables exist at function startup
- Use different secrets per environment (dev/preview/production)

### Prohibited Practices

- **NEVER** commit `.env` files to version control
- **NEVER** hardcode API keys, database credentials, or secrets
- **NEVER** expose secrets in client-side JavaScript
- **NEVER** log environment variable values
- **NEVER** include secrets in error messages or responses

---

## Authentication & Authorization

### Token Management

- Use JWT with appropriate expiration (7 days maximum for session tokens)
- Store tokens in `localStorage` under the key `"auth_token"`
- Include only necessary claims in JWT payload (`userId`, `email`, `tenantId`)
- Validate tokens on every authenticated request
- Clear tokens on sign-out and on 401 responses

### Password Security

- Hash passwords using bcryptjs with minimum 12 salt rounds
- Never store plaintext passwords
- Never log passwords or password hashes
- Enforce minimum password requirements (8+ characters)
- Never include passwords in error messages

### Authorization Boundaries

- Verify user ownership before any data access
- Check tenant membership for multi-tenant resources
- Implement role-based access control where applicable
- Never trust client-side authorization checks alone
- Validate all user input on the server

---

## Netlify Functions Security

### Request Handling

- Validate `Content-Type` headers
- Parse and validate all request body fields
- Implement request size limits
- Use parameterized queries for all database operations
- Sanitize user input before processing

### Response Security

- Never expose internal error details to clients
- Return generic error messages for security failures
- Set appropriate CORS headers
- Include security headers in responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`

### Rate Limiting

- Implement rate limiting on authentication endpoints
- Track failed login attempts
- Consider IP-based throttling for sensitive operations

---

## OWASP Best Practices

### Injection Prevention

- Use parameterized SQL queries exclusively
- Never concatenate user input into queries
- Validate and sanitize all input data
- Use TypeScript types to enforce data shapes

### XSS Prevention

- React escapes output by default—do not bypass with `dangerouslySetInnerHTML`
- Sanitize any HTML content from external sources
- Validate URLs before rendering links
- Use Content Security Policy headers

### CSRF Protection

- Use SameSite cookie attributes where applicable
- Validate Origin/Referer headers for state-changing requests
- Consider CSRF tokens for sensitive operations

### Sensitive Data Exposure

- Use HTTPS exclusively (enforced by Netlify)
- Encrypt sensitive data at rest
- Minimize data collection and retention
- Implement proper access controls

---

## Logging & Monitoring

### What to Log

- Authentication events (success/failure, without credentials)
- Authorization failures
- Unexpected errors (sanitized)
- Request metadata (timestamp, endpoint, user ID)

### What to NEVER Log

- Passwords or password hashes
- JWT tokens or secrets
- Full credit card numbers
- Social security numbers
- API keys or credentials
- Personal health information
- Full request/response bodies containing sensitive data

### Log Format

- Use structured logging (JSON)
- Include correlation IDs for request tracing
- Timestamp all entries in UTC
- Categorize by severity level

---

## Data Protection

### Database Security

- Use SSL/TLS for all database connections
- Implement row-level security where appropriate
- Encrypt sensitive columns (PII, financial data)
- Regular backup verification
- Principle of least privilege for database users

### Client-Side Storage

- Only store non-sensitive data in localStorage
- Auth tokens are acceptable in localStorage for this stack
- Never store passwords, credit cards, or PII client-side
- Clear sensitive data on logout

---

## Dependency Security

### Required Practices

- Run `npm audit` regularly
- Update dependencies with known vulnerabilities promptly
- Review new dependencies before adding
- Use lockfiles (`package-lock.json`) for reproducible builds
- Prefer well-maintained packages with security policies

### Prohibited Practices

- Using deprecated packages with known vulnerabilities
- Ignoring security audit warnings without justification
- Installing packages from untrusted sources

---

## Safe Defaults

### Always Enable

- TypeScript strict mode
- HTTPS (automatic on Netlify)
- Parameterized database queries
- Input validation
- Output encoding

### Always Disable/Avoid

- Debug modes in production
- Verbose error messages to clients
- CORS wildcards (`*`) in production
- Disabled SSL certificate verification
- Eval or dynamic code execution

---

## Incident Response

### If a Secret is Exposed

1. Rotate the compromised secret immediately
2. Review access logs for unauthorized use
3. Update all environments with new secret
4. Document the incident
5. Review how exposure occurred and prevent recurrence

### If a Vulnerability is Discovered

1. Assess severity and potential impact
2. Implement fix or mitigation
3. Deploy to all environments
4. Monitor for exploitation attempts
5. Document and review

---

*Security is everyone's responsibility. When in doubt, ask for review.*
