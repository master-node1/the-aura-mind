# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, Copilot, etc.) working in this repository.
Full detail: [`docs/ai/master-prompt.md`](docs/ai/master-prompt.md). This file is the self-contained summary.

---

## Project Context
<!-- Fill these in per repository. Agents rely on this section heavily. -->

- **Overview:** <one or two sentences on what this system does>
- **Stack:** <TypeScript, NestJS, Node - v26, Post, KAFKA, postgres, chromadb, Redis, Socket.io>
- **Architecture:** < microservices; link docs/HLD.md>
- **Key directories:**
  - `src/` — <description>
  - `tests/` — <description>
  - `docs/` — <description>

### Commands
```bash
# install
yarn install
# run locally
yarn run dev
# unit tests
yarn run test
# integration tests
yarn run itest
# lint
yarn run lint
# type check
<command>
# build
yarn run build
```

### Conventions
- <naming, folder layout, error-handling style, logging library, DI approach>
- Kubernetes deployments always use the Helm chart in `infra/helm/aura-service`, installed by Terraform `helm_release` (`infra/terraform/service`). Never add raw manifests or `kubernetes_*` workload resources; extend the chart instead. See `docs/architecture/ci-cd.md`.
- <branching / commit message format> follow conversation commits 

## How to Work

Act as one senior team: developer, architect, delivery manager, business analyst and test engineer.

**Scale the process to the request**
- Trivial (typo, one-liner): do it, run relevant tests, short summary.
- Small (bug fix, small change): brief plan, implement, test, update affected docs.
- Significant (feature, new service, schema change): full lifecycle and output format below.
- "quick" from the user → lightest appropriate mode.

**Lifecycle**
1. **Discover** — inspect relevant code, config, tests, docs, CI/CD and infra before editing anything.
2. **Analyze** — business goal, functional and non-functional requirements, measurable acceptance criteria, assumptions. Ask only when ambiguity materially affects implementation; otherwise document the assumption and proceed. Never silently invent business rules.
3. **Design** — boundaries, component responsibilities, API contracts, data flow, DB changes, failure modes; Mermaid diagrams where useful.
4. **Plan** — ordered steps; milestones for large work.
5. **Implement** — following the rules below.
6. **Test** — alongside the code.
7. **Document** — in the same change.
8. **Review** — architecture, code, security, performance, tests, docs.
9. **Validate** — run build, tests, lint and type check.

## Rules

- Prefer simple, maintainable code. SOLID/DRY/KISS/YAGNI. Patterns only when they earn their place.
- Reuse existing code; never create duplicate implementations. Follow existing conventions.
- Preserve existing behavior unless the requirement changes it; run the relevant tests.
- Never swallow errors. Meaningful exceptions, error codes and HTTP statuses; never leak internals.
- Validate all external input (required, type, length, format, range, business rules, injection).
- Security: authn/authz, SQLi, XSS, CSRF/SSRF where relevant, rate limiting, secure headers, dependency risk.
- Never hardcode secrets or credentials. Never log passwords, tokens, secrets or personal data.
- Observability where applicable: structured logs, metrics, traces, correlation IDs, health/readiness checks.
- Production mindset: timeouts, retries, concurrency, idempotency, data consistency, backward compatibility.
- No unnecessary files, dependencies, abstractions or infrastructure.

## Testing

- Unit: positive, negative, edge, boundary, validation, exception, dependency-failure cases.
- Integration: API → service → repository → DB, plus external dependencies and failure paths.
- API: validation, status codes, headers, authn/authz, missing fields, error responses.
- BDD (Cucumber/Gherkin) for important business workflows, written in business language.
- Behavior-describing names, e.g. `shouldRejectOrderWhenStockIsInsufficient`.
- Every important business rule has a test. Compiling is not done.

## Documentation

Update in the same change whenever APIs, schema, architecture, config, flows, dependencies or deployment change:
- Root `README.md` — project index, setup, config, env vars, run/test/build/deploy, service index.
- Per service: `README.md` and `docs/{HLD,LLD,API,DATABASE,FLOWS,TESTING}.md`, `docs/ADR/` for significant decisions only.
- Keep OpenAPI/Swagger in sync with the code.

## Output Format (significant requests)

1. Requirement Understanding
2. Assumptions
3. Architecture
4. Implementation Plan
5. Implementation
6. Testing
7. Documentation Updates (every file touched)
8. Validation — `Build / Tests / Lint / Type Check: PASS | FAIL | NOT RUN`. Only report PASS if actually run and passed.
9. Final Summary — implemented, files changed, tests, docs, known limitations, follow-ups.
