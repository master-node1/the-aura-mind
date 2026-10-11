# AuraMind

**AuraMind** (formerly Sora) is an AI chat agent built to plug into any product. Today it is an emotionally aware companion with real-time chat, long-term memory and selectable personalities; the roadmap turns it into customer order-support chat, call emotion analysis and admin help for host products such as theauralab and theauracoach, integrated through APIs and adapters rather than shared databases.

The goal: AI that chats and analyses calls, chats and videos, shares users' experience with the product with admins, and integrates with any public-facing service such as e-commerce or OTT.

It was split out of [master-node1/the-aura-lab](https://github.com/master-node1/the-aura-lab) with its full history. It has its own login, database and signing secret.

| | |
|---|---|
| **Languages** | TypeScript (NestJS 10), Python 3.11 (FastAPI) |
| **Data** | PostgreSQL 16 (Prisma 6), Redis 7, ChromaDB 0.4 |
| **AI** | OpenAI through LangChain |
| **Edge** | nginx API gateway on `:8001` |
| **Runtime** | Docker Compose |

---

## Documentation index

### Architecture and services

| Document | Contents |
|---|---|
| [services/README.md](services/README.md) | **Start here.** System HLD, service index, shared database ER diagram, Redis contracts, end-to-end flows, configuration and known issues |
| [services/DEPLOYMENT.md](services/DEPLOYMENT.md) | Docker Compose deployment and troubleshooting |
| [docs/architecture/ci-cd.md](docs/architecture/ci-cd.md) | GitHub Actions CI/CD: tests and Terraform plans for changed services; manual ECR build and EKS deploy |

### Per-service docs

Each README covers HLD, LLD, API, DB schema, flows, configuration and limitations.

| Domain | Service | README |
|---|---|---|
| Edge | api-gateway (nginx) | [services/api-gateway](services/api-gateway/README.md) |
| AuraMind | auth-service | [services/auth-service](services/auth-service/README.md) |
| AuraMind | chat-service | [services/chat-service](services/chat-service/README.md) |
| AuraMind | memory-service | [services/memory-service](services/memory-service/README.md) |
| AuraMind | companion-service | [services/companion-service](services/companion-service/README.md) |
| AuraMind | analytics-service | [services/analytics-service](services/analytics-service/README.md) |
| AuraMind | ai-service (Python) | [services/ai-service](services/ai-service/README.md) |
| Library | shared types | [services/shared](services/shared/README.md) |

### Contributor guidance

| Document | Contents |
|---|---|
| [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md) | Rules for AI coding agents |
| [docs/ai/master-prompt.md](docs/ai/master-prompt.md) | Detailed engineering process |

---

## Repository structure

```text
.
├── docker-compose.yml        # full stack: postgres, redis, chromadb, 6 services + gateway
├── .env.example              # root environment template (copy to .env)
├── services/                 # all microservices (see services/README.md)
├── docs/                     # CI/CD guide and agent guidance
├── infra/helm/aura-service/  # Helm chart used for every Kubernetes deployment
├── infra/terraform/service/  # per-service EKS deployment stack (Terraform → Helm release)
├── .github/                  # CI/CD workflow and change-detection script
├── .githooks/                # pre-commit / pre-push quality hooks
├── eslint.config.mjs         # ESLint config for all TypeScript services
└── package.json              # root lint / quality scripts
```

## Quick start

```sh
cp .env.example .env          # then set SECRET_KEY and OPENAI_API_KEY
docker compose up -d --build
curl http://localhost:8001/health

```

Swagger UI for each NestJS service is at `/api/<service>/docs` when `NODE_ENV` isn't `production` (compose defaults to `production`, so set `NODE_ENV=development` in `.env` to see it). The [service index](services/README.md#service-index) lists the ports and routes, and [known issues](services/README.md#cross-cutting-known-issues) lists the problems that currently affect startup.

## Local quality checks

Install the repository's linting tools and enable its Git hooks:

```sh
npm install
npm run hooks:install
```

The pre-commit hook checks whitespace and lints staged TypeScript files. The
pre-push hook runs ESLint across the TypeScript services and checks Python
syntax in `services/ai-service`. Run the full checks manually with
`npm run quality`. Run the unit tests with `npm test` (each tested service needs `npm install` first).
