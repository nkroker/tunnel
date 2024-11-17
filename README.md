# Tunnel Service - Development Guide

## Prerequisites

- Node.js v20 or later
- pnpm v8 or later
- Redis v6 or later
- Docker and Docker Compose (optional)

## Local Development Setup

1. **Install Dependencies**
   ```bash
   # Install pnpm if you haven't already
   npm install -g pnpm

   # Install project dependencies
   pnpm install:all
   ```

2. **Set Up Redis**
   ```bash
   # Using Docker
   docker run --name tunnel-redis -p 6379:6379 -d redis:6
   ```

3. **Environment Configuration**

   Create `packages/server/.env`:
   ```env
   PORT=3000
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=your-secret-key
   ```

   Create `packages/client/.env`:
   ```env
   SERVER_URL=ws://localhost:3000
   LOCAL_PORT=8080
   AUTH_TOKEN=your-auth-token
   ```

4. **Build Packages**
   ```bash
   # Build all packages in order
   pnpm build:common
   pnpm build:server
   pnpm build:client
   ```

5. **Start the Services**

   In one terminal, start the server:
   ```bash
   pnpm dev:server
   ```

   In another terminal, start the client:
   ```bash
   pnpm dev:client
   ```

## Verification

1. **Check Server Status**
   ```bash
   curl http://localhost:3000/health
   # Should return: {"status": "ok"}
   ```

2. **Test Tunnel Connection**
   ```bash
   # Start a test server
   npx http-server -p 8080

   # In another terminal, create a tunnel
   tunnel start -p 8080
   ```

## Common Issues

1. **Build Fails**
   ```bash
   # Clean and rebuild
   pnpm clean
   pnpm install:all
   pnpm build
   ```

2. **Redis Connection Error**
   ```bash
   # Check Redis status
   docker ps | grep redis
   # or
   redis-cli ping
   ```

3. **Port Already in Use**
   ```bash
   # Find and kill process using port
   lsof -i :3000
   kill -9 <PID>
   ```

## Available Commands

```bash
# Development
pnpm dev:server        # Start server in dev mode
pnpm dev:client        # Start client in dev mode

# Building
pnpm build             # Build all packages
pnpm build:common      # Build common package
pnpm build:server      # Build server package
pnpm build:client      # Build client package

# Docker Setup
pnpm docker:build      # Build Docker images
pnpm docker:up         # Start all services in Docker
pnpm docker:down       # Stop all Docker services
pnpm docker:logs       # View Docker container logs
pnpm docker:clean      # Remove all Docker resources

# Docker Individual Services
docker-compose up server      # Start only the server
docker-compose up redis       # Start only Redis
docker-compose up -d          # Start in detached mode
docker-compose logs -f server # Follow server logs

# Maintenance
pnpm clean             # Clean build files
pnpm install:all       # Install dependencies

# Testing
pnpm test             # Run all tests
pnpm lint             # Run linting
```

## Project Structure
```
tunnel-service/
├── packages/
│   ├── common/        # Shared types and utilities
│   ├── server/        # Server implementation
│   └── client/        # Client implementation
└── package.json
```

## Architecture

### Overview
```
┌─────────┐     ┌──────────┐     ┌─────────┐
│ Client  │◄────┤  Server  │◄────┤ Target  │
│ (CLI)   │     │  (WS)    │     │ (HTTP)  │
└─────────┘     └──────────┘     └─────────┘
```

The service consists of three main components:
1. **Client**: CLI tool that creates secure tunnels
2. **Server**: WebSocket server handling tunnel connections
3. **Common**: Shared types and utilities

### Data Flow
1. Client establishes WebSocket connection with server
2. Server assigns unique tunnel ID
3. External requests hit server endpoint
4. Server forwards requests to appropriate client
5. Client proxies to local service
6. Response follows reverse path

## Logging

### Server Logs
```typescript
// Log levels: error, warn, info, debug
logger.error('Connection failed', { error, tunnelId });
logger.info('New tunnel created', { tunnelId, clientId });
logger.debug('Request received', { path, method, headers });
```

Access logs:
```bash
# View server logs
pnpm docker:logs server

# Filter error logs
pnpm docker:logs server | grep ERROR
```

### Client Logs
Logs are stored in `packages/client/logs/`:
- `error.log`: Error messages
- `combined.log`: All log levels
- `tunnel.log`: Tunnel-specific events

View logs:
```bash
# Show last 100 lines
tunnel logs -n 100

# Follow log output
tunnel logs -f
```

## Metrics

### System Metrics
- CPU/Memory usage
- WebSocket connections
- Active tunnels
- Request latency

View metrics:
```bash
# Last hour metrics
tunnel metrics -t 1h

# Custom time range
tunnel metrics -t 24h
```

### Prometheus Integration
Metrics endpoint: `http://localhost:3000/metrics`

Example metrics:
```
# HELP tunnel_active_connections Current number of active tunnel connections
# TYPE tunnel_active_connections gauge
tunnel_active_connections 5

# HELP tunnel_requests_total Total number of tunnel requests
# TYPE tunnel_requests_total counter
tunnel_requests_total{status="success"} 150
tunnel_requests_total{status="error"} 3
```

## Debugging

### WebSocket Connections
1. Check connection status:
   ```bash
   curl http://localhost:3000/status
   ```

2. Monitor WebSocket traffic:
   ```bash
   # Start Wireshark capture
   wireshark -i lo0 -f "port 3000"
   ```

3. Debug logs:
   ```bash
   # Enable debug logging
   DEBUG=tunnel:* pnpm dev:server
   ```

### Common Issues

#### WebSocket Connection Fails
1. Check server status:
   ```bash
   curl http://localhost:3000/health
   ```

2. Verify WebSocket URL:
   ```bash
   # Should start with ws:// or wss://
   echo $SERVER_URL
   ```

3. Check for firewall issues:
   ```bash
   nc -zv localhost 3000
   ```

#### High Latency
1. Enable performance logging:
   ```bash
   export TUNNEL_PERF_LOGS=true
   ```

2. Monitor request timing:
   ```bash
   tunnel metrics --type latency
   ```

3. Check Redis performance:
   ```bash
   redis-cli --latency
   ```

## Security

### Authentication
1. JWT-based authentication
2. Token rotation
3. Rate limiting

Configuration:
```env
JWT_SECRET=your-secret
TOKEN_EXPIRY=24h
RATE_LIMIT=100
```

### Encryption
1. TLS for WebSocket connections
2. End-to-end encryption for tunnel data

Enable TLS:
```bash
# Generate certificates
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365

# Start server with TLS
SSL_KEY=key.pem SSL_CERT=cert.pem pnpm dev:server
```

## Performance Tuning

### WebSocket Settings
```typescript
const wss = new WebSocket.Server({
  perMessageDeflate: true,
  maxPayload: 50 * 1024 * 1024, // 50MB
  backlog: 100
});
```

### Redis Optimization
```typescript
const client = createClient({
  url: process.env.REDIS_URL,
  socket: {
    keepAlive: 5000,
    reconnectStrategy: retries => Math.min(retries * 100, 3000)
  }
});
```

### Load Testing
```bash
# Install autocannon
npm i -g autocannon

# Run load test
autocannon -c 100 -d 30 http://localhost:3000/tunnel
```

## Monitoring

### Health Checks
```bash
# Basic health check
curl http://localhost:3000/health

# Detailed status
curl http://localhost:3000/status
```

### Alerts
Configure alert thresholds in `config/alerts.json`:
```json
{
  "memory_threshold": 85,
  "cpu_threshold": 80,
  "error_rate": 5,
  "latency_threshold": 1000
}
```

### Dashboard
Access metrics dashboard:
```bash
# Start Grafana
docker-compose -f docker-compose.monitoring.yml up

# Visit http://localhost:3001
# Default credentials: admin/admin
```


## Next Steps

- Set up proper authentication
- Configure SSL/TLS
- Add monitoring
- Set up production deployment

For deployment instructions, refer to DEPLOYMENT.md (coming soon).
