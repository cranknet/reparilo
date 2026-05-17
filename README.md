# Reparilo

Repair-shop management software for single-location mobile phone repair shops. Track intake, jobs, parts, returns, customers, and receipts from one app — on web or Android.

**Trilingual out of the box: Arabic (RTL), French, English.** Built for shops in the MENA region and francophone markets where most off-the-shelf tools are English-only.

> **Status:** Early, solo-maintained. Used in one real shop. APIs and the database schema may change. Issues and PRs are welcome on a best-effort basis.

## Highlights

- **Job intake → repair → return** workflow with photos, status timeline, and customer notifications
- **Receipts & QR tracking** — customers scan a QR code to see job status
- **Returns tracking** — separate workflow for rework, refunds, and warranty claims
- **AI assistant** (optional) — bring your own OpenAI key; the key is AES-256 encrypted at rest
- **Capacitor Android build** for in-shop tablets
- **Single-tenant by design** — built for one shop, not a SaaS platform

## Stack

- **Runtime:** [Bun](https://bun.sh) `1.3.x`
- **Server:** Fastify 5, Better Auth (sessions), Zod validation
- **Frontend:** React 19, Vite, Tailwind CSS 4, react-i18next, Zustand, react-router 7
- **Data:** PostgreSQL via Prisma 7 (pg driver adapter)
- **Mobile:** Capacitor 8 (Android)
- **Quality:** Biome + ultracite, Vitest

## Quickstart

You'll need [Bun](https://bun.sh) `1.3.13` and a PostgreSQL database.

```bash
git clone https://github.com/<your-fork>/reparilo.git
cd reparilo
bun install

cp .env.example .env
# Fill in DATABASE_URL, BETTER_AUTH_SECRET, AI_ENCRYPTION_KEY, SEED_ADMIN_PASSWORD
# Generate secrets with:
#   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"

bun run db:migrate
bun run db:seed
bun run dev
```

Then open <http://localhost:5173> and sign in with `admin` + the `SEED_ADMIN_PASSWORD` you set. You'll be forced to change it on first login.

### Android build

```bash
bun run build:mobile   # builds web, syncs to Capacitor
bun run android        # opens Android Studio
```

For the Android build, set `VITE_API_BASE_URL` in `.env` to your public API origin before building.

## Configuration

Every environment variable is documented inline in [`.env.example`](./.env.example). The server refuses to boot in production if required secrets are missing or use placeholder values.

## Development

```bash
bun run dev          # frontend + server with hot reload
bun run test         # vitest
bun run check        # ultracite lint
bun run fix          # auto-fix lint
bun run db:studio    # Prisma Studio
```

After creating a git worktree, run `bun run setup-worktree` once.

## Contributing

Solo-maintained. Before opening a PR:

1. Open an issue first for anything bigger than a typo or one-line bug fix — I'd rather align on scope than reject a finished PR.
2. Run `bun run check` and `bun run test`.
3. Keep changes focused — one concern per PR.

I respond when I can. Please don't take silence personally.

## Security

Found a vulnerability? See [SECURITY.md](./SECURITY.md). Please **do not** open a public issue for security problems.

## License

[MIT](./LICENSE) © 2026 Bechar Gherbi

The Reparilo name is not licensed under MIT — if you fork, please rename your distribution.
