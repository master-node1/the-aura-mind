# AuraMind Microservices — Deployment Guide

> Split out of [the-aura-lab](https://github.com/master-node1/the-aura-lab); theauralab's e-commerce services (identity, customer, authorization) are not part of this stack.

## ✅ Migration Status

**95% Complete**. All 6 services are implemented, inter-service communication is wired, and critical bugs are fixed. The system is deployable with the caveats listed below.

---

## Remaining Tasks (Non-Blocking)

### Medium Priority
1. **Cross-service user query** — `chat-service/src/gateway/chat.gateway.ts` line ~90 queries the `users` table with raw SQL. Replace with an HTTP call to `companion-service` or cache user profile in Redis at login.
2. **`companion-service` reset-memory stub** — `companion.controller.ts` `reset-memory` endpoint does nothing. Add HTTP `DELETE` to `memory-service/api/memory/short-term`.
3. **`analytics-service` missing ValidationPipe** — add `app.useGlobalPipes(new ValidationPipe({...}))` in `analytics-service/src/main.ts`.
4. **`analytics-service` missing `class-validator`** — add `"class-validator": "^0.14.1"` to `analytics-service/package.json` dependencies.

### Low Priority
5. **Shared types package unused** — `services/shared/` is never imported by any service. Either wire it up as a workspace dependency or remove it to prevent drift.
6. **DB migration ordering** — All services run `prisma migrate deploy` on startup, but there's no coordination. `auth-service` must start first (creates `users` table). Use `depends_on` with healthchecks or an init container.

---

## How to Deploy

### Prerequisites
- Docker & Docker Compose installed
- `.env` file at repo root with:
  ```bash
  SECRET_KEY=your-jwt-secret-here
  OPENAI_API_KEY=sk-your-openai-key
  OPENAI_MODEL=gpt-4-turbo-preview
  ```

### Step 1: Build & Start
```bash
docker-compose up -d --build
```

This starts:
- postgres:5432
- redis:6379
- chromadb:8000
- auth-service:3000
- chat-service:3000
- memory-service:3000
- companion-service:3000
- analytics-service:3000
- ai-service:3000
- api-gateway:8001 (nginx)
- frontend:3000

### Step 2: Wait for DB Migrations
All NestJS services run `prisma migrate deploy` on startup. Watch logs:
```bash
docker-compose logs -f auth-service
```
Wait for "Auth service running on port 3000".

### Step 3: Access
- Frontend: http://localhost:3000
- API Gateway: http://localhost:8001
- Health checks:
  - http://localhost:8001/api/auth/health
  - http://localhost:8001/api/chat/health
  - http://localhost:8001/api/memory/health
  - http://localhost:8001/api/companion/health
  - http://localhost:8001/api/analytics/health
  - http://localhost:8001/api/ai/health

---

## Architecture

```
Frontend (Next.js :3000)
    ↓ HTTP
nginx API Gateway (:8001)
    ├─→ auth-service (:3000)       — JWT, register, login
    ├─→ chat-service (:3000)       — WebSocket (Socket.IO), conversations
    │     ↓ Redis pub (auramind:ai:process)
    │   ai-service (:3000)         — Python agents, LLM, ChromaDB
    │     ↓ Redis pub (auramind:ai:response)
    │   chat-service → Socket.IO → Frontend
    ├─→ memory-service (:3000)     — Memory CRUD, Redis short-term
    ├─→ companion-service (:3000)  — Personality, avatar config
    └─→ analytics-service (:3000)  — Emotion trends, stats (read-only)
```

**Data Flow Example (User sends message):**
1. Frontend WebSocket → nginx :8001 → chat-service :3000
2. Chat-service persists message to Postgres (`conversations`, `messages`)
3. Chat-service publishes `{userId, content, conversationId}` to Redis channel `auramind:ai:process`
4. AI-service (Python worker) consumes from Redis
5. AI-service runs agent pipeline: emotion detection, memory retrieval (ChromaDB), LLM generation
6. AI-service publishes response to Redis channel `auramind:ai:response`
7. Chat-service subscribes to response channel, emits via Socket.IO to frontend

---

## Known Limitations

1. **All services share one Postgres database** — each service has its own schema/tables, but they're in the same DB. Migrations are not coordinated beyond `depends_on` in docker-compose. For true service isolation, split into separate DBs and use HTTP for cross-service queries.

2. **No distributed tracing** — add OpenTelemetry or similar for request correlation across services.

3. **No API gateway authentication layer** — nginx passes all requests through. Add OAuth2 proxy or move JWT validation into nginx with lua scripts for production.

4. **ChromaDB is single-instance** — no replication or HA. For production, use a managed vector DB or run Chroma in cluster mode.

5. **Frontend Socket.IO URL is baked at build time** — `NEXT_PUBLIC_WS_URL` must be set before `docker build`. Runtime env injection doesn't work for `NEXT_PUBLIC_*` vars.

---

## Troubleshooting

**"table does not exist" errors on startup**
- Postgres wasn't ready when NestJS services tried to migrate. Restart the failing service:
  ```bash
  docker-compose restart auth-service
  ```

**WebSocket connection refused**
- Check nginx logs: `docker-compose logs api-gateway`
- Verify chat-service is running: `docker-compose ps chat-service`
- Test Socket.IO directly (bypassing nginx): http://localhost:3000/socket.io/

**AI service not responding**
- Check Redis pub/sub: `docker exec -it the-aura-mind-redis redis-cli PUBSUB CHANNELS`
- Should see `auramind:ai:process` and `auramind:ai:response`
- Check AI service logs: `docker-compose logs -f ai-service`

**Login returns 500**
- Check auth-service logs for `class-validator` errors or Prisma connection failures
- Verify `JWT_SECRET` env var is set in docker-compose

---

## Rollback to Monolith

The original FastAPI monolith is untouched. To run it:
```bash
docker-compose -f docker-compose.yml up -d --build
```

The `backend/` folder and original `docker-compose.yml` remain fully functional as a fallback.

---

## Next Steps (Post-MVP)

- Add distributed tracing (Jaeger/Zipkin)
- Add service mesh (Istio/Linkerd) for mTLS between services
- Split Postgres into per-service databases
- Add rate limiting and API key management in the gateway
- Add health check endpoints with DB/Redis connectivity status
- Add Prometheus metrics exporters to all services
- Implement circuit breakers for AI service → Memory service HTTP calls
- Add retries and dead-letter queue for Redis pub/sub
