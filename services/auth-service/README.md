# auth-service

> User registration, login and JWT issuing for AuraMind's own accounts.
> [← Service index](../README.md)

| | |
|---|---|
| **Stack** | NestJS 10, Prisma 6, PostgreSQL, Passport-JWT, bcryptjs |
| **Port** | `3000` |
| **Route prefix** | `/api/auth` |
| **Gateway route** | `http://<gateway>:8001/api/auth/*` |
| **Swagger** | `/api/auth/docs` (not served when `NODE_ENV=production`) |
| **Owns tables** | `users` |
| **Depends on** | PostgreSQL |
| **Used by** | Frontend; every service that validates JWTs (they share `JWT_SECRET`) |

---

## 1. Responsibilities

- Register users (email, username, password, personality archetype). Prisma generates the user ID, which becomes the JWT `sub`.
- Authenticate users and issue **access** and **refresh** JWTs when the account is active.
- Exchange a refresh token for a new token pair.
- Return the current user's profile.
- Own the `users` table. `companion-service` and `analytics-service` also read it, and `companion-service` writes to it (see [Data model](#5-data-model)).

- Verify email addresses: signup emails a one-time link, `POST /verify-email` sets `is_verified`, and `REQUIRE_EMAIL_VERIFICATION=true` makes login and refresh refuse unverified accounts.

Out of scope today: token revocation, password reset, social login, and accepting host-product tokens. This service was copied from theauralab's auth-service when AuraMind moved to its own repository, with the theauralab identity-service link removed, so AuraMind has its own login and no dependency on theauralab. The planned model is three modes at once: AuraMind's own accounts, login with a host product's own tokens (verified through that product's JWKS), and per-tenant keys for server-to-server calls.

---

## 2. High-Level Design

```mermaid
flowchart LR
    FE[Frontend] -->|HTTPS| GW[nginx api-gateway :8001]
    GW -->|/api/auth/*| AUTH[auth-service :3000]
    AUTH -->|Prisma| PG[(PostgreSQL<br/>users)]
    AUTH -. issues JWT signed with JWT_SECRET .-> FE
    FE -. Bearer token .-> OTHERS[chat / memory / companion / analytics]
    OTHERS -. verify with same JWT_SECRET .-> OTHERS
```

- **Stateless auth.** Other services never call auth-service. They verify JWTs locally with the shared `JWT_SECRET` and accept only tokens whose `type` is `access`.
- **Shared database.** The `users` table lives in the single shared Postgres database. Other services read it directly (see [services/README.md](../README.md#shared-database)).
- **Migrations** run on container start (`npx prisma migrate deploy`). Because this service creates `users`, the other services that depend on it wait for it to report healthy in `docker-compose.yml`.

---

## 3. Low-Level Design

```text
src/
├── main.ts                 # bootstrap: prefix api/auth, ValidationPipe, CORS, Swagger
├── app.module.ts           # ConfigModule (global), PrismaModule, AuthModule, HealthController
├── health/health.controller.ts # public; SELECT 1 with a 2 s timeout, 503 when down
├── mail/mail.service.ts    # sends the verification email over SMTP_URL (logs the link when unset, outside production)
├── prisma/
│   ├── prisma.module.ts    # @Global, exports PrismaService
│   └── prisma.service.ts   # PrismaClient with connect/disconnect lifecycle hooks
└── auth/
    ├── auth.module.ts      # PassportModule + JwtModule (secret, 30m default expiry)
    ├── auth.controller.ts  # REST endpoints
    ├── auth.service.ts     # business logic
    ├── jwt.strategy.ts     # Passport 'jwt' strategy; rejects non-access tokens
    └── dto/
        ├── register.dto.ts
        ├── login.dto.ts
        └── verify-email.dto.ts
```

### 3.1 Components

| Class | Responsibility |
|---|---|
| `AuthController` | Maps HTTP routes to `AuthService`. `GET /me` is protected by `AuthGuard('jwt')`. |
| `AuthService` | `register`, `login`, `refresh`, `verifyEmail`, `resendVerification`, `getMe`, plus private helpers such as `generateTokens` and `sanitizeUser`. |
| `MailService` | Sends the verification email through nodemailer when `SMTP_URL` is set; otherwise logs the link (non-production) or a warning (production). |
| `JwtStrategy` | Pulls the Bearer token from the request, verifies it with `JWT_SECRET`, requires `payload.type === 'access'`, and returns `{ sub, email }` as `req.user`. (chat-service and memory-service also read the `tid` claim as `req.user.tenantId`.) |
| `PrismaService` | Shared Prisma client. |

### 3.2 DTOs and validation

The global `ValidationPipe({ whitelist: true, transform: true })` strips properties that are not declared on a DTO.

| DTO | Field | Rules |
|---|---|---|
| `RegisterDto` | `email` | `@IsEmail` |
| | `username` | string, 3–30 characters, `^[a-zA-Z0-9_-]+$` |
| | `password` | string, at least 8 characters |
| | `personalityArchetype` | optional, one of `friend \| mentor \| coach \| creator \| assistant`. Default `friend`. |
| `LoginDto` | `email` | `@IsEmail` |
| | `password` | string |

### 3.3 Business rules

1. Email and username must each be unique. A duplicate returns `409 Conflict`.
2. Passwords are hashed with **bcrypt, cost 12**. The hash is never returned, because `sanitizeUser` strips `hashedPassword`.
3. Login returns the same `401 Invalid email or password` for an unknown email and for a wrong password, so the response doesn't reveal which accounts exist.
4. Login is refused with `401 Account is deactivated` when `isActive = false`. This check runs **after** the password check.
5. Tokens:

   | Token | Payload | Expiry |
   |---|---|---|
   | access | `{ sub, email, tid, type: 'access' }` (`tid` is the user's `tenant_id`) | `JWT_ACCESS_EXPIRE_MINUTES`, default 30 minutes |
   | refresh | `{ sub, type: 'refresh' }` | `JWT_REFRESH_EXPIRE_DAYS`, default 7 days |

   Both tokens are signed with `JWT_SECRET` using HS256, the `@nestjs/jwt` default.
6. A refresh succeeds only for a valid token whose `type` is `refresh` and whose user still exists and is active. Those failures return `401 Invalid refresh token`.
7. Logout requires a valid access token but is otherwise client-side only. The endpoint returns a message and doesn't revoke anything.

### 3.4 Error handling

| Situation | Exception | HTTP |
|---|---|---|
| DTO validation fails | `BadRequestException` (ValidationPipe) | 400 |
| Duplicate email or username | `ConflictException` | 409 |
| Bad credentials, inactive account, invalid refresh token, missing or invalid access token | `UnauthorizedException` | 401 |
| `/me` for a user who has been deleted | `NotFoundException` | 404 |

---

## 4. API

All paths are relative to `/api/auth`.

| Method | Path | Auth | Description | Success | Errors |
|---|---|---|---|---|---|
| POST | `/register` | – | Create the user | 201 user (without password) | 400, 409 |
| POST | `/login` | – | Log in and get tokens | 200 token pair | 400, 401, 403 when verification is required and the email isn't verified |
| POST | `/verify-email` | – | Body `{ token }` from the email link; marks the email verified | 200 `{ message }` | 400 (invalid or expired token) |
| POST | `/resend-verification` | – | Body `{ email }`; issues a new link if the account is active and unverified | 200 `{ message }`, the same whether or not the account exists | 400 |
| POST | `/refresh?refresh_token=<jwt>` | – | Exchange a refresh token for a new pair | 200 token pair | 401, 403 as for `/login` |
| GET | `/me` | Bearer (access) | Current user profile | 200 user | 401, 404 |
| POST | `/logout` | Bearer (access) | Acknowledge logout; tokens aren't revoked | 200 `{ message }` | 401 |
| GET | `/health` | – | Checks database connectivity (`SELECT 1`, 2 s timeout) | 200 `{ status: 'ok', service, checks: { database: 'up' } }`; 503 with the failed check marked `down` | – |

### Examples

```http
POST /api/auth/register
Content-Type: application/json

{ "email": "jane@example.com", "username": "jane_d", "password": "s3cretpass", "personalityArchetype": "mentor" }
```

```json
{
  "id": "6f1c…", "email": "jane@example.com", "username": "jane_d",
  "personalityArchetype": "mentor", "avatarConfig": {}, "communicationStyle": "casual",
  "isActive": true, "isVerified": false,
  "createdAt": "2026-10-01T10:00:00.000Z", "updatedAt": "2026-10-01T10:00:00.000Z"
}
```

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "jane@example.com", "password": "s3cretpass" }
```

```json
{ "access_token": "<jwt>", "refresh_token": "<jwt>", "token_type": "bearer" }
```

---

## 5. Data model

**Table `users`**, created by migration `20260722124750_init`; the email verification columns come from `20261011180000_email_verification`.

| Column | Type | Constraints / default | Notes |
|---|---|---|---|
| `id` | UUID | PK | Generated by Prisma (`uuid()`) |
| `email` | TEXT | NOT NULL, UNIQUE (`users_email_key`) | |
| `username` | TEXT | NOT NULL, UNIQUE (`users_username_key`) | Updated by companion-service |
| `hashed_password` | TEXT | NOT NULL | bcrypt hash |
| `personality_archetype` | TEXT | NOT NULL, default `'friend'` | Updated by companion-service; read by chat-service and analytics-service |
| `avatar_config` | JSONB | NOT NULL, default `'{}'` | Updated by companion-service |
| `communication_style` | TEXT | NOT NULL, default `'casual'` | Updated by companion-service |
| `is_active` | BOOLEAN | NOT NULL, default `true` | Inactive users can't log in |
| `tenant_id` | TEXT | NOT NULL, default `'default'`, indexed | Host product the account belongs to; set from `TENANT_ID` at signup and issued as the `tid` claim. Added by `20261011190000_users_tenant_id` |
| `is_verified` | BOOLEAN | NOT NULL, default `false` | Set by `POST /verify-email` |
| `email_verification_token_hash` | TEXT | UNIQUE, nullable | SHA-256 of the pending link token; the raw token is only emailed. Cleared on verification |
| `email_verification_expires_at` | TIMESTAMP(3) | nullable | Link expiry (`EMAIL_VERIFICATION_TTL_HOURS`) |
| `created_at` | TIMESTAMP(3) | NOT NULL, default now | |
| `updated_at` | TIMESTAMP(3) | NOT NULL | Prisma `@updatedAt` |

```mermaid
erDiagram
    users {
        uuid id PK
        text email UK
        text username UK
        text hashed_password
        text personality_archetype
        jsonb avatar_config
        text communication_style
        bool is_active
        bool is_verified
        text email_verification_token_hash UK
        timestamp email_verification_expires_at
        timestamp created_at
        timestamp updated_at
    }
    users ||--o{ conversations : "user_id (logical, chat-service)"
    users ||--o{ memories : "user_id (logical, memory-service)"
```

Relationships to `conversations` and `memories` are **logical only**: no foreign keys cross service boundaries.

---

## 6. Flows

### Register and login

```mermaid
sequenceDiagram
    participant C as Client
    participant A as auth-service
    participant DB as Postgres (users)
    C->>A: POST /register {email, username, password}
    A->>DB: findUnique(email), findUnique(username)
    alt email or username exists
        A-->>C: 409 Conflict
    else
        A->>A: bcrypt.hash(password, 12), random token
        A->>DB: INSERT users (with token hash and expiry)
        A->>A: email link ?token=… (failures are logged, not returned)
        A-->>C: 201 user (no hash)
    end
    C->>A: POST /verify-email {token}
    A->>DB: findUnique(token hash), check expiry
    A->>DB: UPDATE is_verified = true, clear token
    A-->>C: 200
    C->>A: POST /login {email, password}
    A->>DB: findUnique(email)
    A->>A: bcrypt.compare, check isActive (and isVerified when required)
    A-->>C: 200 {access_token, refresh_token}
```

### Token refresh and use by other services

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Any protected service
    participant A as auth-service
    C->>S: GET … (Authorization: Bearer access)
    S->>S: verify signature + exp + type=access (local)
    alt token expired
        S-->>C: 401
        C->>A: POST /refresh?refresh_token=…
        A->>A: verify, require type=refresh, user exists
        A-->>C: 200 new token pair
        C->>S: retry with new access token
    end
```

---

## 7. Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | no | `3000` | HTTP port |
| `DATABASE_URL` | yes | – | Postgres connection string |
| `JWT_SECRET` | yes | `changeme` (fallback in code; never use it outside local development) | HS256 signing secret, shared with the other AuraMind services (never with theauralab). Compose maps it from `SECRET_KEY`. |
| `JWT_ACCESS_EXPIRE_MINUTES` | no | `30` | Access token lifetime |
| `TENANT_ID` | no | `default` | Tenant stamped on new accounts. One auth deployment serves one tenant for now |
| `JWT_REFRESH_EXPIRE_DAYS` | no | `7` | Refresh token lifetime |
| `CORS_ORIGINS` | no | `http://localhost:3000` | Comma-separated list of allowed origins |
| `NODE_ENV` | no | – | `production` hides Swagger and stops verification links from being logged |
| `SMTP_URL` | no | – | nodemailer SMTP URL, e.g. `smtps://user:pass@smtp.example.com`. Unset: no email is sent |
| `MAIL_FROM` | no | `AuraMind <no-reply@localhost>` | Sender of verification emails |
| `EMAIL_VERIFICATION_URL` | no | `http://localhost:3000/verify-email` | Page the link opens; `?token=` is appended. The page should `POST /api/auth/verify-email` with the token |
| `EMAIL_VERIFICATION_TTL_HOURS` | no | `24` | Link lifetime |
| `REQUIRE_EMAIL_VERIFICATION` | no | `false` | `true` makes `/login` and `/refresh` return 403 for unverified accounts |
| `JWT_REFRESH_SECRET` | – | – | Passed in by compose but **not read by the code** |
| `REDIS_URL` | – | – | Passed in by compose but **not used** |

---

## 8. Run, build and test

```bash
cd services/auth-service
npm install
npx prisma generate
npx prisma migrate deploy        # requires DATABASE_URL
npm run start:dev                # http://localhost:3000/api/auth/docs
npm run build && npm start       # production build
```

With Docker: `docker compose up -d --build auth-service`.

**Tests:** `npm test` runs 35 Jest unit tests in `test/`, which are kept out of `src/` so production builds don't include them. They cover signup (hashing, 409 on duplicates and races), login (unknown email and wrong password give the same 401, deactivated accounts), refresh validation, email verification (token hashing, expiry, resend without account enumeration, the `REQUIRE_EMAIL_VERIFICATION` switch), tenant stamping and the `tid` claim, and `/me`.

Lint runs from the repository root with `npm run lint`.

---

## 9. Known limitations and follow-ups

- The refresh token is signed with the same secret as the access token, and `JWT_REFRESH_SECRET` is unused.
- The refresh token travels as a **query parameter** (`?refresh_token=`), so it can end up in proxy and access logs. A request body or an HttpOnly cookie would be safer.
- There is no token revocation or rotation. Logout requires a token but doesn't invalidate it.
- There is no rate limiting or brute-force protection on `/login`.
- The `changeme` fallback secret in code means a misconfigured deployment silently signs tokens with a known secret.
- Logging uses `console.log` and is not structured.
- There are no integration or e2e tests.
- Verification is off by default (`REQUIRE_EMAIL_VERIFICATION=false`), so existing deployments keep letting unverified users in. Accounts created before this change have no token; they can ask for one with `/resend-verification`.
- `/resend-verification` has no rate limit, so it can be used to send repeated emails to an address.
- The companion columns (`personality_archetype`, `avatar_config`, `communication_style`) belong in AuraMind's per-tenant assistant settings,, not on `users`.
