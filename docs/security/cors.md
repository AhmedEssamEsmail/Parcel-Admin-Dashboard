# CORS Configuration

This document describes the Cross-Origin Resource Sharing (CORS) configuration for the Parcel Admin Dashboard application.

## Overview

CORS is a security mechanism that controls which origins can access resources from our API. Proper CORS configuration prevents unauthorized cross-origin requests while allowing legitimate access from approved domains.

## Allowed Origins

### Development Environment

In development mode, the following origins are allowed:

- `http://localhost:3000` - Local development server
- `http://localhost:3001` - Alternative local port
- `http://127.0.0.1:3000` - Localhost IP variant
- `http://127.0.0.1:3001` - Alternative localhost IP port

### Production Environment

In production, only the following origins are allowed:

- `https://parcel-admin.example.com` - Production domain
- `https://admin.example.com` - Alternative production domain

**Note**: Update these values in your environment configuration to match your actual production domains.

## Allowed HTTP Methods

The following HTTP methods are permitted for cross-origin requests:

- `GET` - Retrieve resources
- `POST` - Create or submit data
- `PUT` - Update existing resources
- `PATCH` - Partially update resources
- `DELETE` - Remove resources
- `OPTIONS` - Preflight requests

## Allowed Headers

The following request headers are permitted:

- `Content-Type` - Specifies the media type of the request body
- `Authorization` - Contains authentication credentials
- `X-Requested-With` - Identifies AJAX requests
- `Accept` - Specifies acceptable response media types
- `Origin` - Indicates the origin of the request
- `X-CSRF-Token` - CSRF protection token

## Configuration Examples

### Next.js Middleware Configuration

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? ['https://parcel-admin.example.com', 'https://admin.example.com']
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
      ];

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const response = NextResponse.next();

  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token'
    );
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

### Environment Variables

Configure allowed origins using environment variables:

```bash
# .env.local (development)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# .env.production (production)
ALLOWED_ORIGINS=https://parcel-admin.example.com,https://admin.example.com
```

## Security Considerations

### Origin Validation

- **Always validate the origin** against a whitelist of allowed domains
- **Never use wildcards** (`*`) in production for `Access-Control-Allow-Origin`
- **Be specific** with allowed origins to prevent unauthorized access

### Credentials

- Set `Access-Control-Allow-Credentials: true` only when necessary
- When credentials are allowed, you **cannot** use wildcard origins
- Ensure cookies have appropriate `SameSite` and `Secure` attributes

### Preflight Requests

- Handle `OPTIONS` requests properly for preflight checks
- Cache preflight responses using `Access-Control-Max-Age` header
- Return appropriate status code (204 No Content) for preflight responses

## Testing CORS Configuration

### Using cURL

Test CORS headers with a simple request:

```bash
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:3000/api/dod \
     -v
```

### Using Browser DevTools

1. Open browser DevTools (F12)
2. Go to the Network tab
3. Make a cross-origin request
4. Check the response headers for CORS headers
5. Verify no CORS errors in the Console tab

### Expected Response Headers

For a valid cross-origin request, you should see:

```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token
Access-Control-Allow-Credentials: true
```

## Troubleshooting

### Common CORS Errors

**Error**: "No 'Access-Control-Allow-Origin' header is present"

- **Cause**: The origin is not in the allowed list
- **Solution**: Add the origin to the allowed origins list or check for typos

**Error**: "The 'Access-Control-Allow-Origin' header contains multiple values"

- **Cause**: Multiple middleware or configurations are setting the header
- **Solution**: Ensure only one middleware sets CORS headers

**Error**: "Credentials flag is 'true', but 'Access-Control-Allow-Origin' is '\*'"

- **Cause**: Cannot use wildcard with credentials
- **Solution**: Specify exact origin instead of wildcard

### Debugging Steps

1. Check that the origin is in the allowed list
2. Verify the middleware is running for API routes
3. Check for conflicting CORS configurations
4. Ensure preflight requests return 204 status
5. Verify headers are set correctly in the response

## References

- [MDN Web Docs: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [OWASP: CORS Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Origin_Resource_Sharing_Cheat_Sheet.html)
- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)
