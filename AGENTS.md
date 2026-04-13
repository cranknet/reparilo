# Reparilo — Repair Shop Management System

Single-location mobile phone repair shop management. Web + Android (Capacitor). Trilingual (AR/FR/EN).

## Commands

| Command | Action |
|---|---|
| `pnpm dev` | Start Vite frontend + Fastify server concurrently |
| `pnpm dev:front` | Vite frontend only |
| `pnpm server` | Fastify server only (tsx watch) |
| `pnpm build` | Production build to dist/ |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:push` | Push schema to DB without migration |
| `pnpm db:studio` | Prisma Studio GUI |

| `pnpm db:seed` | Seed database with initial data |
| `pnpm scan-i18n` | Scan for missing i18n keys |
| `pnpm sync-locales` | Sync and auto-translate locale files |

## Tech Stack

- **Frontend:** React 19, Vite 8, TypeScript 6, Tailwind CSS 4, React Router 7, TanStack Query 5, Zustand 5
- **Backend:** Fastify 5, Prisma 7, PostgreSQL 17, @fastify/websocket
- **Auth:** Better Auth (username + password)
- **i18n:** i18next — Arabic (RTL), French, English
- **AI:** OpenAI SDK (owner-only analyst chat)
- **Android:** Capacitor (wraps Vite build)

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

## Key Conventions

- Single `package.json` — no monorepo. Frontend and backend share TypeScript types via `shared/`.
- **Frontend imports:** Use path aliases `@/` → `src/`, `@shared/` → `shared/` (configured in vite.config.ts)
- **Server imports:** Use relative imports (e.g., `../shared/constants/index.js`). `tsx` does not resolve `tsconfig.json` path aliases at runtime.
- API routes prefixed with `/api/`, proxied by Vite dev server to `localhost:4000`
- Prisma 7 requires `prisma.config.ts` for datasource URL (not in schema.prisma)
- Prisma 7 requires `@prisma/adapter-pg` driver adapter for PrismaClient instantiation
- All `DateTime` fields use `@db.Timestamptz`
- Jobs are never deleted — use `CANCELLED` status instead. `AuditLog.jobId` uses `onDelete: Restrict` so audit trails survive. If a job must be removed, cancel it first then archive.
- Job cost is computed on read: `Sum(JobRepair.price) + Sum(JobPart.totalCost)`
- `JobCounter` uses `year` as natural PK — increment via serializable transaction
- `.env` is gitignored. Copy `.env.example` to `.env` for local dev
- Docker Compose provides PostgreSQL. Start with `docker compose up -d` before `db:migrate`
- Shared types are re-exported from `@prisma/client` in `shared/types/index.ts` — never manually define types that Prisma generates
- Zod v4 uses `{ error: "message" }` instead of `"message"` for custom error messages
- Server entry loads `dotenv/config` at the top; `tsx --env-file=.env` is configured in the server script
