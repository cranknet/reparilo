<!--
  Sync Impact Report
  ==================
  Version change: (none) → 1.0.0
  Modified principles: N/A (initial ratification)
  Added sections: All (Core Principles, Technology & Constraints, Development Workflow, Governance)
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md       ✅ aligned (Constitution Check section references principles)
    - .specify/templates/spec-template.md        ✅ aligned (requirements map to principles)
    - .specify/templates/tasks-template.md       ✅ aligned (task phases reflect workflow)
  Follow-up TODOs: None
-->

# Reparilo Constitution

## Core Principles

### I. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, MUST rewrite it.

Rationale: Over-engineering in a small-team project compounds technical
debt faster than any other factor.

### II. Surgical Changes

Touch only what you MUST. Clean up only your own mess.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports, variables, and functions that YOUR changes made unused.

Rationale: Unnecessary changes increase diff noise, risk regressions,
and slow review.

### III. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

Rationale: Premature implementation without clarity leads to rework
that could have been avoided with a single question.

### IV. Goal-Driven Execution

Define success criteria. Loop until verified.

- Transform tasks into verifiable goals.
- "Add validation" → write tests for invalid inputs, then make them pass.
- "Fix the bug" → write a test that reproduces it, then make it pass.
- "Refactor X" → ensure tests pass before and after.
- Multi-step tasks MUST state a brief plan with verification steps.

Rationale: Weak success criteria ("make it work") require constant
clarification. Strong criteria enable independent progress.

### V. Shared Source of Truth

Reuse established single sources of truth; do not duplicate or invent.

- `shared/errors/AppError` is the SSOT error handler — do not create,
  invent, or throw custom errors; reuse it.
- `server/plugins/security.ts` is the SSOT for backend security —
  reuse or improve it when working with APIs.
- Shared types, constants, and schemas live in `shared/` — frontend
  and server MUST import from there, not duplicate them.
- Locale keys MUST be added to `en.json` and synced via
  `bun run sync-locales`.
- Prisma migrations MUST be created after every schema change.

Rationale: Duplication across the shared boundary (frontend ↔ server)
is the single highest-risk area for inconsistency bugs.

### VI. Trilingual by Default

Every user-facing string MUST support Arabic, French, and English.

- New UI text MUST go through i18n — no hardcoded strings.
- RTL layout MUST work for Arabic.
- Translation keys MUST be added to `en.json` first, then synced.

Rationale: The product serves trilingual users; retrofitting i18n is
far more expensive than building it in from the start.

### VII. Quality Gates

No lint warnings; no skipped checks; no suppressed errors.

- Run `bun run check` or `bun run fix` — never suppress lint warnings.
- Always apply best practices.
- After creating a new worktree, run `bun run setup-worktree`.
- When running tests, build, or lint — collect output in a single run.
- Always collect and flag console errors during QA.

Rationale: Suppressed warnings accumulate into an unreliable codebase.

## Technology & Constraints

**Language**: TypeScript (strict mode)
**Runtime**: Bun ≥ 1.3.0
**Package Manager**: Bun (bun install, bun add, bun run, bunx)

**Frontend**: React 19 · Vite 8 · Tailwind 4 · Zustand · TanStack Query
**Backend**: Fastify 5 · Prisma 7 · PostgreSQL
**Mobile**: Capacitor (Android)
**i18n**: i18next (AR/FR/EN) with RTL support
**Validation**: Zod (shared schemas)
**Auth**: Better Auth
**Lint**: ultracite (`bun run check` / `bun run fix`)

**Constraints**:
- Single `package.json` — monorepo is not used.
- API proxy: Vite dev server proxies `/api` → `:4000`.
- No barrel files — use explicit imports.
- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` MUST stay in sync — use `cp`.

## Development Workflow

1. **Plan**: State assumptions, present alternatives, pick simplest
   approach.
2. **Implement**: Minimal code. Follow existing patterns. Use shared
   utilities.
3. **Verify**: Run `bun run check`. Run `bun test`. Collect console errors.
4. **Iterate**: Loop until success criteria are met — no unresolved
   lint warnings, no failing tests.

**Stitch Design Rules** (UI design work only):
- Stitch MCP is the ONLY tool for UI design and implementation.
- Always use project ID `17739395020081356283`.
- List all screens and check update time before creating a new screen.
- After generating, get HTML & Image, then convert to React components.
- If Stitch fails, wait and check — do not retry immediately.

## Governance

This constitution supersedes all other development practices and
preferences. Amendments require:

1. A written proposal documenting the change and rationale.
2. A migration plan for any code that violates the new rule.
3. Verification that existing templates, specs, and tasks still align.

All PRs and reviews MUST verify compliance with these principles.
Complexity that contradicts Principle I MUST be justified in writing.

When I bring an issue, the role is not to fix it directly — instead,
open a brief discussion: ask clarifying questions, explore the problem
space, and propose industry best-practice solutions. Decide together.

**Version**: 1.0.0 | **Ratified**: 2026-04-29 | **Last Amended**: 2026-04-29