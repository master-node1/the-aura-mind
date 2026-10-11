# api-gateway

> An nginx reverse proxy and the single public entry point (`:8001`) for REST and WebSocket traffic.
> [← Service index](../README.md)

| | |
|---|---|
| **Stack** | nginx 1.27-alpine |
| **Port** | `8001`, published to the host as `${API_GATEWAY_PORT:-8001}` |
| **Config** | [`nginx.conf`](nginx.conf), copied to `/etc/nginx/nginx.conf` at image build |
| **Networks** | `backend` (to the services), `edge` (public) |
| **Health** | `GET /health` → `{"status":"ok","service":"api-gateway"}` |

---

## 1. Responsibilities

- Route `/api/<service>/…` to the right upstream container.
- Proxy Socket.IO WebSocket upgrades to chat-service.
- Expose ai-service's health check.
- Report its own liveness.

It does **not** handle authentication, rate limiting, TLS termination, request IDs or CORS. Each service validates JWTs and handles CORS itself.

---

## 2. Routing table

| Public path | Upstream | Upstream path |
|---|---|---|
| `/api/auth/` | `auth-service:3000` | `/api/auth/` |
| `/api/chat/` | `chat-service:3000` | `/api/chat/` |
| `/socket.io/` | `chat-service:3000` | `/socket.io/` (HTTP/1.1, `Upgrade` and `Connection: upgrade`) |
| `/api/memory/` | `memory-service:3000` | `/api/memory/` |
| `/api/companion/` | `companion-service:3000` | `/api/companion/` |
| `/api/analytics/` | `analytics-service:3000` | `/api/analytics/` |
| `/api/ai/health` | `ai-service:3000` | `/health` |
| `/health` | – (answered by nginx itself) | – |

Each proxied location sets `Host` and `X-Real-IP`. The WebSocket location sets `Host` but not `X-Real-IP`.

```mermaid
flowchart LR
    Client -->|:8001| NGX[nginx]
    NGX -->|/api/auth/| AUTH[auth-service]
    NGX -->|/api/chat/ + /socket.io/| CHAT[chat-service]
    NGX -->|/api/memory/| MEM[memory-service]
    NGX -->|/api/companion/| COMP[companion-service]
    NGX -->|/api/analytics/| AN[analytics-service]
    NGX -->|/api/ai/health| AI[ai-service]
```

---

## 3. Request flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as nginx :8001
    participant S as upstream service
    B->>N: GET /api/memory/?limit=10 (Bearer)
    N->>S: GET http://memory-service:3000/api/memory/?limit=10
    S->>S: JWT validation, business logic
    S-->>N: 200 JSON
    N-->>B: 200 JSON
```

---

## 4. Run

```bash
docker compose up -d --build api-gateway   # starts the dependencies first
curl http://localhost:8001/health
```

To change the configuration, edit `nginx.conf` and rebuild the image, because the file is baked in rather than mounted. You can check the syntax with `docker run --rm -v "$PWD/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:1.27-alpine nginx -t`. That check resolves upstream hostnames, so it reports "host not found" outside the compose network.

---

## 5. Known limitations and follow-ups

- **Health-gated startup.** `depends_on` waits for every upstream to report healthy, and each `/health` now checks its databases. If Postgres or Redis is down, the gateway won't start until they recover.
- `depends_on` doesn't list ai-service, which it proxies `/api/ai/health` to.
- The `frontend` upstream was removed because no location used it and compose defines no `frontend` service, which made nginx refuse to start (`host not found in upstream "frontend:3000"`). Add an upstream and a location when a frontend container exists.
- There's no TLS, rate limiting, request-size limit, proxy timeouts, `X-Forwarded-For` or `X-Forwarded-Proto` header, request or correlation ID, gzip, or security headers.
- No authentication happens at the edge. Consider JWT validation in the gateway.
- The WebSocket location has no `proxy_read_timeout`, so the default of 60 seconds drops idle sockets. Socket.IO pings usually keep connections alive.
