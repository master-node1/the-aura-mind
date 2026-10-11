# CLAUDE.md

Claude Code loads this file automatically. Shared rules live in AGENTS.md (used by other agents too), so there is one source of truth.

@AGENTS.md
@docs/ai/master-prompt.md

---

## Claude Code specifics

- **Plan before editing** for significant work: present the requirement understanding, assumptions, design and plan, and wait for confirmation before large or cross-module changes.
- **Discover with tools, don't assume:** read the relevant files, search for existing implementations, and check tests and config before writing code.
- **Verify, don't claim:** run the build, tests, lint and type-check commands from AGENTS.md. Report each as PASS, FAIL or NOT RUN, and show the failing output when something fails.
- **Small, reviewable changes:** keep diffs focused; don't reformat unrelated code.
- **Ask before** adding dependencies, changing public API contracts, running destructive DB or git commands, or touching CI/CD and infrastructure.
- **Secrets:** never read, print or commit `.env` values or credentials; use placeholders in docs and examples.
