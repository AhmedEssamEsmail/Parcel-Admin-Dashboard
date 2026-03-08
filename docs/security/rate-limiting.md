# Rate Limiting

This document describes the rate limiting implementation for the Parcel Admin Dashboard API.

## Overview

Rate limiting is a security mechanism that controls the number of requests a client can make to the API within a specific time window. This prevents abuse, protects against denial-of-service attacks, and ensures fair resource allocation.

## Current Implementation

The application uses a token bucket algorithm for rate limiting, implemented in the `withRateLimit` middleware wrapper.

### Rate Limit Thresholds

Different endpoints have different rate limits based on their resource intensity:

| Endpoint Category | Requests per Window | Window Duration | Notes                            |
| ----------------- | ------------------- | --------------- | -------------------------------- |
| Authentication    | 5 requests          | 15 minutes      | Login/logout endpoints           |
| Data Upload       | 10 requests         | 1 minute        | File upload and ingest endpoints |
| Dashboard APIs    | 60 requests         | 1 minute        | Read-only dashboard data         |
| Export APIs       | 10 requests         | 1 minute        | CSV export endpoints             |
| Health Check      | 120 requests        | 1 minute        | Monitoring endpoints             |

### Default Rate Limit

For endpoints without specific configuration:

- **100 requests per minute** per IP address

## Rate Limit Window Duration

All rate limits use a **sliding window** algorithm:

- Window duration: **60 seconds** (1 minute) for most endpoints
- Window duration: **900 seconds** (15 minutes) for authentication endpoints

The sliding window ensures smooth rate limiting without sudden resets at fixed intervals.

## Implementation Details

### Middleware Usage

```typescript
// app/api/example/route.ts
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

export const GET = withRateLimit(
  async (request: NextRequest) => {
    // Your API logic here
    return NextResponse.json({ data: 'example' });
  },
  {
    maxRequests: 60,
    windowMs: 60000, // 1 minute
  }
);
```

### Rate Limit Storage

Rate limit counters are stored in:

- **Development**: In-memory storage (resets on server restart)
- **Production**: Redis or similar distributed cache (recommended for multi-instance deployments)

### Client Identification

Clients are identified by:

1. **IP Address** (primary) - Extracted from `X-Forwarded-For` or `X-Real-IP` headers
2. **User ID** (secondary) - For authenticated requests
3. **API Key** (if applicable) - For service-to-service communication

## Rate Limit Response Headers

When a request is rate-limited, the following headers are included in the response:

### Standard Headers

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640000000
Retry-After: 30
```

### Header Descriptions

- `X-RateLimit-Limit`: Maximum number of requests allowed in the window
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: Unix timestamp when the rate limit window resets
- `Retry-After`: Number of seconds to wait before retrying (only when rate limited)

### Rate Limit Exceeded Response

When the rate limit is exceeded, the API returns:

```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 30
}
```

**HTTP Status Code**: `429 Too Many Requests`

## Rate Limit Bypass Mechanisms

### For Testing

During development and testing, rate limiting can be bypassed:

#### Environment Variable

```bash
# .env.local
DISABLE_RATE_LIMIT=true
```

#### Test Header

For automated tests, include the bypass header:

```bash
curl -H "X-Test-Bypass-Rate-Limit: true" \
     http://localhost:3000/api/dod
```

**Note**: This header only works in non-production environments.

### For Monitoring

Health check endpoints (`/api/health`) have higher rate limits to accommodate monitoring systems:

- **120 requests per minute** per IP address

### For Trusted Services

Service accounts or trusted IPs can be whitelisted:

```typescript
// lib/middleware/rate-limit.ts
const WHITELISTED_IPS = [
  '10.0.0.1', // Internal monitoring service
  '192.168.1.100', // CI/CD pipeline
];

function isWhitelisted(ip: string): boolean {
  return WHITELISTED_IPS.includes(ip);
}
```

## Monitoring and Alerts

### Metrics to Track

Monitor the following metrics:

- Number of rate-limited requests per endpoint
- Top IP addresses hitting rate limits
- Average requests per minute per endpoint
- Rate limit bypass attempts

### Alert Thresholds

Set up alerts for:

- **High rate limit hits**: More than 100 rate-limited requests per minute
- **Suspicious patterns**: Single IP hitting multiple endpoints' rate limits
- **Potential DDoS**: Sudden spike in requests from multiple IPs

## Best Practices

### For API Consumers

1. **Implement exponential backoff**: When rate-limited, wait progressively longer between retries
2. **Respect Retry-After header**: Wait the specified time before retrying
3. **Cache responses**: Reduce unnecessary API calls by caching data
4. **Batch requests**: Combine multiple operations into single requests when possible
5. **Monitor rate limit headers**: Track remaining requests to avoid hitting limits

### For API Developers

1. **Set appropriate limits**: Balance security with usability
2. **Document rate limits**: Clearly communicate limits to API consumers
3. **Provide meaningful errors**: Include retry information in error responses
4. **Monitor usage patterns**: Adjust limits based on actual usage
5. **Implement graceful degradation**: Return cached or partial data when possible

## Configuration Examples

### Per-Endpoint Configuration

```typescript
// Strict rate limit for authentication
export const POST = withRateLimit(loginHandler, {
  maxRequests: 5,
  windowMs: 900000, // 15 minutes
  message: 'Too many login attempts. Please try again later.',
});

// Relaxed rate limit for read-only data
export const GET = withRateLimit(dashboardHandler, {
  maxRequests: 100,
  windowMs: 60000, // 1 minute
});
```

### Dynamic Rate Limits

```typescript
// Different limits for authenticated vs anonymous users
export const GET = withRateLimit(
  async (request: NextRequest) => {
    const isAuthenticated = await checkAuth(request);

    return NextResponse.json({ data: 'example' });
  },
  {
    maxRequests: (request) => {
      const isAuthenticated = request.headers.get('authorization');
      return isAuthenticated ? 200 : 60; // Higher limit for authenticated users
    },
    windowMs: 60000,
  }
);
```

## Testing Rate Limits

### Manual Testing

Test rate limits using a simple script:

```bash
#!/bin/bash
# Test rate limit by making 65 requests
for i in {1..65}; do
  echo "Request $i"
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/dod?from=2024-01-01&to=2024-01-31
  sleep 0.5
done
```

Expected behavior:

- First 60 requests: `200 OK`
- Remaining requests: `429 Too Many Requests`

### Automated Testing

```typescript
// tests/integration/rate-limit.test.ts
import { describe, it, expect } from 'vitest';

describe('Rate Limiting', () => {
  it('should rate limit after exceeding threshold', async () => {
    const requests = Array(65)
      .fill(null)
      .map(() => fetch('http://localhost:3000/api/dod?from=2024-01-01&to=2024-01-31'));

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter((r) => r.status === 429);

    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

## Troubleshooting

### Common Issues

**Issue**: Rate limit triggered too quickly

- **Cause**: Multiple clients behind same NAT/proxy share IP
- **Solution**: Implement user-based rate limiting for authenticated requests

**Issue**: Rate limit not working

- **Cause**: Middleware not applied to route
- **Solution**: Ensure `withRateLimit` wraps the route handler

**Issue**: Rate limit persists after window expires

- **Cause**: Clock skew or incorrect window calculation
- **Solution**: Verify system time and window duration settings

## Security Considerations

### IP Spoofing

- Validate `X-Forwarded-For` headers
- Trust only headers from known proxies/load balancers
- Use multiple identification methods (IP + User ID)

### Distributed Attacks

- Implement global rate limits across all instances
- Use distributed cache (Redis) for rate limit storage
- Monitor for coordinated attacks from multiple IPs

### Rate Limit Bypass Attempts

- Log all bypass attempts
- Alert on suspicious patterns
- Disable bypass mechanisms in production

## References

- [OWASP: Denial of Service Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
- [RFC 6585: Additional HTTP Status Codes](https://tools.ietf.org/html/rfc6585)
- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)
