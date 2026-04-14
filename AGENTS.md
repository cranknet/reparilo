# Reparilo — Repair Shop Management System

Single-location mobile phone repair shop management. Web + Android (Capacitor). Trilingual (AR/FR/EN).

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
- use ultracite skill when working with code edits.
- Never suppress lint warnings — always apply best practices
- Explain tasks, errors, and solutions in plain English with minimal jargon
- after using SKILL audit or critique, run recommanded actions in parallel and finish with polish 

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
- When you geenrate new screen, get HTML & Image then convert it to React components.
- After using generate from text tool, wait for 1 min to let the stitch generate the screen.
- Do not try to create if stitch is somehow failed, wait , check update time.s