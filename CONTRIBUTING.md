# Contributing to Reparilo

Thanks for taking the time to look at this. Reparilo is solo-maintained — contributions are welcome, but please read this short guide first so we don't waste each other's time.

## Before you start

**Open an issue first** for anything bigger than a typo or a one-line bug fix. I'd rather align on scope and approach up front than reject a finished PR. Good first-issue candidates are tagged `good first issue`.

If you're not sure whether a change fits the project's scope, ask. Reparilo is intentionally a **single-tenant, single-location** repair-shop tool — features that push it toward multi-tenant SaaS or generic ERP territory will likely be declined.

## Prerequisites

- [Bun](https://bun.sh) `1.3.13` (pinned in `package.json`)
- PostgreSQL (locally or via Docker)
- For Android work: Android Studio + JDK 17+

## Setup

```bash
git clone https://github.com/<your-fork>/reparilo.git
cd reparilo
bun install

cp .env.example .env
# Fill in DATABASE_URL, BETTER_AUTH_SECRET, AI_ENCRYPTION_KEY, SEED_ADMIN_PASSWORD.
# Generate secrets with:
#   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"

bun run db:migrate
bun run db:seed
bun run dev
```

If you work in a git worktree, run `bun run setup-worktree` once after creating it.

## Development workflow

```bash
bun run dev          # frontend (vite) + server (fastify) with hot reload
bun run test         # vitest
bun run check        # ultracite lint
bun run fix          # auto-fix lint
bun run db:studio    # Prisma Studio
```

### Before every commit

1. `bun run check` passes (zero warnings — we don't suppress lints).
2. `bun run test` passes.
3. No new TypeScript errors.
4. Your changes are scoped to one concern. Don't refactor adjacent code unless your change needs it.

A `husky` pre-commit hook will run these for you, but please run them locally before pushing — failed CI is slow feedback.

## Project conventions

These are documented more fully in `CLAUDE.md` at the repo root. Highlights:

- **Errors:** `shared/errors/AppError` is the single source of truth. Don't introduce custom error classes — extend or reuse `AppError`.
- **Security:** `server/plugins/security.ts` is the SSOT for backend security headers, CSRF, rate limiting, etc. Improve it rather than working around it.
- **No barrel files.** Use explicit imports.
- **No suppressed lints.** Fix the underlying issue.
- **i18n:** Add new strings to `src/locales/en.json`. Then run `bun run sync-locales` to sync and auto-translate the AR and FR locale files. Hard-coded user-facing strings will be rejected.
- **Database changes:** Every schema change needs a Prisma migration generated via `bun run db:migrate`. Don't ship schema edits without the migration file.

## Commits and PRs

### Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(returns): add partial-refund resolution flow
fix(auth): clear session cookie on logout error
docs(readme): correct Android build prerequisites
chore(deps): bump prisma to 7.7.1
test(jobs): cover overdue-alert edge case
```

Type prefixes we use: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `perf`, `style`.

### Pull requests

- One concern per PR. Smaller PRs get reviewed and merged faster.
- Reference the issue it closes: `Closes #123`.
- Include screenshots or short clips for any UI change. Test in all three locales (AR, FR, EN) if your change touches text or layout — RTL surprises are common.
- For database changes, include the generated migration file and call out any data backfill needed.
- Don't bump unrelated dependencies in the same PR.

### When I'll likely say no

- Multi-tenant or SaaS-shaped features.
- Adding heavyweight dependencies for small wins.
- Refactors with no behavior change and no clear payoff.
- Changes that only serve a specific deployment that isn't the reference one.

I'll always explain why. Pushback isn't personal — keeping the surface area small is what makes solo maintenance sustainable.

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Be respectful. Reports go to the address in that file.

## Security

If you've found a security issue, **do not open a public issue or PR**. See [SECURITY.md](./SECURITY.md) for private reporting channels.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
