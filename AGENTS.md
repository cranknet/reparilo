# Reparilo — Repair Shop Management System

Single-location mobile phone repair shop management. Web + Android (Capacitor). Trilingual (AR/FR/EN).

# Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Folder Structure

```
reparilo/
├── src/                          # React frontend
│   ├── pages/                    #   Route-level components
│   │   ├── dashboard/
│   │   ├── jobs/
│   │   ├── customers/
│   │   ├── settings/
│   │   ├── tracking/             #   Public customer self-tracking (no auth)
│   │   ├── ai-analyst/
│   │   └── auth/
│   ├── components/
│   │   ├── ui/                   #   Base UI components
│   │   └── modules/              #   Feature components (jobs, parts, etc.)
│   ├── hooks/                    #   Custom React hooks
│   ├── lib/                      #   Axios client, utils, formatters
│   ├── stores/                   #   Zustand client state
│   ├── i18n/                     #   Locales (ar/fr/en) + RTL config
│   │   └── locales/
│   ├── assets/
│   ├── App.tsx                   #   Root component + routes
│   ├── main.tsx                  #   Entry point (providers)
│   └── app.css                   #   Tailwind import
├── server/                       # Fastify REST API
│   ├── routes/                   #   Endpoint handlers (jobs, parts, customers, users, notifications, settings, ai)
│   ├── services/                 #   Business logic
│   ├── plugins/                  #   Auth, Prisma, WebSocket
│   ├── middlewares/              #   Role guards, validation
│   ├── ai/                       #   AI analyst (tools, prompt, streaming)
│   ├── utils/                    #   Encryption, job ID generation
│   └── index.ts                  #   Fastify entry point (port 4000)
├── shared/                       # Shared between frontend and server
│   ├── constants/                #   Job statuses, roles, currencies
│   ├── types/                    #   TypeScript interfaces
│   └── schemas/                  #   Zod validation schemas
├── prisma/
│   ├── schema.prisma             #   Prisma 7 schema (PostgreSQL)
│   └── migrations/
├── public/                       # Static assets
│   ├── receipt-templates/
│   └── images/
├── docs/                         # PRD, schema docs
├── docker-compose.yml            # PostgreSQL 17
├── prisma.config.ts              # Prisma 7 datasource config
├── vite.config.ts                # Vite + Tailwind + proxy /api → :4000
├── tsconfig.json                 # Path aliases: @/, @shared/
└── package.json                  # Single package.json
```

## General Rules

- Sync `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` on any update — use `cp`
- The project uses ultracite for code quality and formatting.
- The project uses pnpm for package management.
- Add locale keys to en.json and use pnpm run sync-locales to sync and auto-translate other languages files.
- Never suppress lint warnings — always apply best practices
- Explain tasks, errors, and solutions in plain English with minimal jargon
- When I bring you an issue, your job is not to fix it directly. Instead, open a brief discussion: ask clarifying questions, explore the problem space, and propose industry best-practice solutions. Always lean toward the approach that reflects current standards, and walk me through the reasoning so we decide together.
## Database

- Create Prisma migrations after every schema change
- Use the Postgres URL from `.env` for DB access

## QA & Dev

- After creating a new worktree, run `pnpm setup:worktree`
- Use Chrome DevTools for QA — login with `admin` and the configured `SEED_ADMIN_PASSWORD`
- Always collect and flag console errors
- When running tests, build, or lint — always collect output in a single run
- Check existing code for navigation patterns and follow them

## Stitch Design Rules

- Stitch MCP is the only tool for UI design and implementation.
- always use "Reparilo" project ID: "17739395020081356283" when working with stitch.
- list all screens first and remember update time before creating a new screen.
- When you generate new screen, get HTML & Image then convert it to React components.
- After using generate from text tool, wait for 1 min to let the stitch generate the screen.
- Do not try to create if Stitch somehow fails, wait, check update time.
