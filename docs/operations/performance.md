# Performance Benchmarks and Monitoring

This document describes the performance benchmarks, monitoring strategy, and optimization guidelines for the Parcel Admin Dashboard.

## Overview

Performance is critical for user experience and operational efficiency. This document establishes baseline metrics, acceptable thresholds, and testing methodologies to ensure the application meets performance requirements.

## Baseline Response Times

### Critical API Endpoints

Response time targets for key API endpoints (95th percentile):

| Endpoint               | Target (p95) | Maximum Acceptable | Notes                        |
| ---------------------- | ------------ | ------------------ | ---------------------------- |
| `/api/health`          | < 100ms      | 200ms              | Health check must be fast    |
| `/api/dod`             | < 500ms      | 1000ms             | Dashboard day-over-day data  |
| `/api/compare-periods` | < 800ms      | 1500ms             | Period comparison analysis   |
| `/api/ingest`          | < 2000ms     | 5000ms             | Data upload (varies by size) |
| `/api/export/csv`      | < 3000ms     | 10000ms            | CSV export (varies by size)  |
| `/api/auth/login`      | < 300ms      | 500ms              | Authentication               |

### Response Time Percentiles

We track multiple percentiles to understand performance distribution:

- **p50 (median)**: Typical user experience
- **p95**: Most users' experience (target for SLAs)
- **p99**: Edge cases and worst-case scenarios
- **p99.9**: Outliers (for capacity planning)

## Baseline Page Load Times

### Key Pages

Page load time targets (First Contentful Paint):

| Page              | Target (FCP) | Maximum Acceptable | Notes                      |
| ----------------- | ------------ | ------------------ | -------------------------- |
| Dashboard Home    | < 1.5s       | 3s                 | Initial dashboard view     |
| Period Comparison | < 2s         | 4s                 | Comparison charts and data |
| Upload Page       | < 1s         | 2s                 | File upload interface      |
| Settings          | < 1s         | 2s                 | Configuration pages        |

### Core Web Vitals

Target metrics for user experience:

- **Largest Contentful Paint (LCP)**: < 2.5s
- **First Input Delay (FID)**: < 100ms
- **Cumulative Layout Shift (CLS)**: < 0.1

## Database Query Performance

### Query Response Times

Target response times for database queries (95th percentile):

| Query Type        | Target (p95) | Maximum Acceptable | Notes                         |
| ----------------- | ------------ | ------------------ | ----------------------------- |
| Simple SELECT     | < 50ms       | 100ms              | Single table, indexed         |
| JOIN queries      | < 200ms      | 500ms              | 2-3 table joins               |
| Aggregations      | < 500ms      | 1000ms             | GROUP BY, COUNT, SUM          |
| Complex analytics | < 2000ms     | 5000ms             | Multi-table, window functions |

### Query Optimization Guidelines

1. **Use indexes**: Ensure all WHERE, JOIN, and ORDER BY columns are indexed
2. **Limit result sets**: Use LIMIT and pagination for large datasets
3. **Avoid N+1 queries**: Use JOINs or batch queries instead
4. **Use materialized views**: Pre-compute expensive aggregations
5. **Monitor slow queries**: Log queries taking > 1 second

### Example: Optimized Query

```sql
-- Optimized query with proper indexes
SELECT
  day,
  total_placed_inc_wa,
  total_delivered_inc_wa,
  otd_pct_inc_wa
FROM v_dod_summary_daily_rollup
WHERE warehouse_code = 'WH01'
  AND day >= '2024-01-01'
  AND day <= '2024-01-31'
ORDER BY day ASC;

-- Indexes required:
-- CREATE INDEX idx_dod_summary_warehouse_day ON v_dod_summary_daily_rollup(warehouse_code, day);
```

## Performance Testing Methodology

### Load Testing

Use load testing tools to simulate realistic traffic:

#### Tools

- **Artillery**: HTTP load testing
- **k6**: Modern load testing tool
- **Apache JMeter**: Comprehensive testing suite

#### Test Scenarios

1. **Baseline Load**: 10 concurrent users, 5 minutes
2. **Normal Load**: 50 concurrent users, 15 minutes
3. **Peak Load**: 200 concurrent users, 10 minutes
4. **Stress Test**: Gradually increase to 500 users

#### Example: Artillery Configuration

```yaml
# artillery-config.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 300
      arrivalRate: 10
      name: 'Warm up'
    - duration: 600
      arrivalRate: 50
      name: 'Normal load'
    - duration: 300
      arrivalRate: 200
      name: 'Peak load'

scenarios:
  - name: 'Dashboard workflow'
    flow:
      - get:
          url: '/api/health'
      - get:
          url: '/api/dod?warehouse=WH01&from=2024-01-01&to=2024-01-31'
      - post:
          url: '/api/compare-periods'
          json:
            warehouse: 'WH01'
            period_a_start: '2024-01-01'
            period_a_end: '2024-01-31'
            period_b_start: '2024-02-01'
            period_b_end: '2024-02-28'
```

### Benchmark Testing

Run benchmarks regularly to track performance trends:

```bash
# Run performance benchmarks
npm run benchmark

# Expected output:
# ✓ Health check: 45ms (target: <100ms)
# ✓ Dashboard API: 320ms (target: <500ms)
# ✓ Compare periods: 650ms (target: <800ms)
# ✗ CSV export: 3500ms (target: <3000ms) - SLOW
```

### Continuous Monitoring

Implement monitoring in production:

1. **Application Performance Monitoring (APM)**: Use tools like New Relic, Datadog, or Sentry
2. **Real User Monitoring (RUM)**: Track actual user experience
3. **Synthetic Monitoring**: Automated tests from multiple locations
4. **Database Monitoring**: Track query performance and connection pool usage

## Acceptable Performance Thresholds

### Response Time Thresholds

| Metric             | Good    | Acceptable | Poor     | Action Required         |
| ------------------ | ------- | ---------- | -------- | ----------------------- |
| API Response (p95) | < 500ms | 500-1000ms | > 1000ms | Investigate if > 1000ms |
| Page Load (FCP)    | < 1.5s  | 1.5-3s     | > 3s     | Optimize if > 3s        |
| Database Query     | < 200ms | 200-500ms  | > 500ms  | Optimize if > 500ms     |
| Health Check       | < 100ms | 100-200ms  | > 200ms  | Critical if > 200ms     |

### Throughput Thresholds

| Metric               | Target    | Minimum Acceptable | Notes           |
| -------------------- | --------- | ------------------ | --------------- |
| Requests per second  | 100 RPS   | 50 RPS             | Per instance    |
| Concurrent users     | 200 users | 100 users          | Per instance    |
| Database connections | 20 active | 50 max             | Connection pool |

### Resource Utilization

| Resource     | Normal | Warning | Critical | Action            |
| ------------ | ------ | ------- | -------- | ----------------- |
| CPU Usage    | < 50%  | 50-70%  | > 70%    | Scale up/out      |
| Memory Usage | < 60%  | 60-80%  | > 80%    | Investigate leaks |
| Database CPU | < 40%  | 40-60%  | > 60%    | Optimize queries  |
| Disk I/O     | < 50%  | 50-75%  | > 75%    | Add capacity      |

## Performance Optimization Strategies

### Frontend Optimization

1. **Code Splitting**: Load only necessary JavaScript
2. **Image Optimization**: Use Next.js Image component
3. **Lazy Loading**: Defer non-critical components
4. **Caching**: Implement browser and CDN caching
5. **Minification**: Compress CSS and JavaScript

### Backend Optimization

1. **Database Indexing**: Add indexes for frequently queried columns
2. **Query Optimization**: Use EXPLAIN ANALYZE to identify slow queries
3. **Connection Pooling**: Reuse database connections
4. **Caching**: Implement Redis for frequently accessed data
5. **Async Processing**: Use background jobs for heavy operations

### API Optimization

1. **Response Compression**: Enable gzip/brotli compression
2. **Pagination**: Limit result sets to reasonable sizes
3. **Field Selection**: Return only requested fields
4. **Batch Endpoints**: Combine multiple requests
5. **HTTP/2**: Enable HTTP/2 for multiplexing

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Response Times**: Track p50, p95, p99 for all endpoints
2. **Error Rates**: Monitor 4xx and 5xx error rates
3. **Throughput**: Requests per second per endpoint
4. **Database Performance**: Query times, connection pool usage
5. **Resource Utilization**: CPU, memory, disk, network

### Alert Thresholds

Set up alerts for:

| Condition         | Threshold | Severity | Action            |
| ----------------- | --------- | -------- | ----------------- |
| API response time | p95 > 2s  | Warning  | Investigate       |
| API response time | p95 > 5s  | Critical | Immediate action  |
| Error rate        | > 5%      | Warning  | Check logs        |
| Error rate        | > 10%     | Critical | Incident response |
| CPU usage         | > 80%     | Warning  | Scale up          |
| Memory usage      | > 90%     | Critical | Restart/scale     |

### Monitoring Tools

Recommended tools:

- **APM**: New Relic, Datadog, Sentry
- **Logging**: ELK Stack, Splunk, CloudWatch
- **Metrics**: Prometheus + Grafana
- **Uptime**: Pingdom, UptimeRobot
- **RUM**: Google Analytics, Vercel Analytics

## Performance Testing Checklist

Before deploying to production:

- [ ] Run load tests with expected peak traffic
- [ ] Verify all API endpoints meet response time targets
- [ ] Check database query performance with production data volume
- [ ] Test with realistic network conditions (throttling)
- [ ] Verify caching is working correctly
- [ ] Check for memory leaks during extended runs
- [ ] Test graceful degradation under high load
- [ ] Verify monitoring and alerting are configured
- [ ] Document any performance limitations
- [ ] Create runbook for performance incidents

## Performance Regression Testing

Prevent performance regressions:

1. **Baseline Measurements**: Record current performance metrics
2. **Automated Tests**: Run performance tests in CI/CD
3. **Comparison**: Compare new results against baseline
4. **Thresholds**: Fail builds if performance degrades > 20%
5. **Trending**: Track performance over time

### Example: CI Performance Test

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run performance tests
        run: npm run test:performance
      - name: Compare with baseline
        run: npm run compare-performance
      - name: Fail if regression > 20%
        run: npm run check-regression
```

## Troubleshooting Performance Issues

### Slow API Responses

1. Check database query performance (use EXPLAIN ANALYZE)
2. Verify indexes are being used
3. Check for N+1 query problems
4. Review network latency
5. Check for blocking operations

### High Memory Usage

1. Check for memory leaks (use heap snapshots)
2. Review caching strategy
3. Check for large object allocations
4. Monitor garbage collection
5. Review connection pool settings

### High CPU Usage

1. Profile application code
2. Check for inefficient algorithms
3. Review database query complexity
4. Check for infinite loops or recursion
5. Monitor background job processing

## References

- [Web Vitals](https://web.dev/vitals/)
- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Artillery Documentation](https://www.artillery.io/docs)
