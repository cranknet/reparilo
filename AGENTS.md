# Reparilo — Repair Shop Management System

Single-location mobile phone repair shop management. Web + Android (Capacitor). Trilingual (AR/FR/EN).

## Codebase Search (SocratiCode)

This project is indexed with SocratiCode. Always use its MCP tools to explore the codebase
before reading any files directly.

### Workflow

1. **Start most explorations with `codebase_search`.**
   Hybrid semantic + keyword search (vector + BM25, RRF-fused) runs in a single call.
   - Use broad, conceptual queries for orientation: "how is authentication handled",
     "database connection setup", "error handling patterns".
   - Use precise queries for symbol lookups: exact function names, constants, type names.
   - Prefer search results to infer which files to read — do not speculatively open files.
   - **When to use grep instead**: If you already know the exact identifier, error string,
     or regex pattern, grep/ripgrep is faster and more precise — no semantic gap to bridge.
     Use `codebase_search` when you're exploring, asking conceptual questions, or don't
     know which files to look in.

2. **Follow the graph before following imports.**
   Use `codebase_graph_query` to see what a file imports and what depends on it before
   diving into its contents. This prevents unnecessary reading of transitive dependencies.
   - **Before modifying or deleting a file**, check its dependents with `codebase_graph_query`
     to understand the blast radius.
   - **When planning a refactor**, use the graph to identify all affected files before
     making changes.

3. **Use Impact Analysis BEFORE refactoring, renaming, or deleting code.**
   The symbol-level call graph (`codebase_impact`, `codebase_flow`, `codebase_symbol`,
   `codebase_symbols`) goes one step deeper than the file graph: it knows which
   functions and methods call which.
   - `codebase_impact` answers "what breaks if I change X?" (blast radius — every file
     that transitively calls into the target).
   - `codebase_flow` answers "what does this code do?" by tracing forward from an entry
     point. Call with no `entrypoint` to discover candidate entry points (auto-detected
     via orphans, conventional names like `main()`, framework routes, tests).
   - `codebase_symbol` gives a 360° view of one function: definition, callers, callees.
   - `codebase_symbols` lists symbols in a file or searches by name.
   - Always prefer these over reading multiple files when the question is about
     dependencies between functions, not concepts.

4. **Read files only after narrowing down via search.**
   Once search results clearly point to 1–3 files, read only the relevant sections.
   Never read a file just to find out if it's relevant — search first.

5. **Use `codebase_graph_circular` when debugging unexpected behaviour.**
   Circular dependencies cause subtle runtime issues; check for them proactively.
   Also run `codebase_graph_circular` when you notice import-related errors or unexpected
   initialisation order.

6. **Check `codebase_status` if search returns no results.**
   The project may not be indexed yet. Run `codebase_index` if needed, then wait for
   `codebase_status` to confirm completion before searching.

7. **Leverage context artifacts for non-code knowledge.**
   Projects can define a `.socraticodecontextartifacts.json` config to expose database
   schemas, API specs, infrastructure configs, architecture docs, and other project
   knowledge that lives outside source code. These artifacts are auto-indexed alongside
   code during `codebase_index` and `codebase_update`.
   - Run `codebase_context` early to see what artifacts are available.
   - Use `codebase_context_search` to find specific schemas, endpoints, or configs
     before asking about database structure or API contracts.
   - If `codebase_status` shows artifacts are stale, run `codebase_context_index` to
     refresh them.

### When to use each tool

| Goal | Tool |
|------|------|
| Understand what a codebase does / where a feature lives | `codebase_search` (broad query) |
| Find a specific function, constant, or type | `codebase_search` (exact name) or grep if you know already the exact string |
| Find exact error messages, log strings, or regex patterns | grep / ripgrep |
| See what a file imports or what depends on it | `codebase_graph_query` |
| Check blast radius before modifying or deleting a file | `codebase_impact` (symbol-level) or `codebase_graph_query` (file-level) |
| **What breaks if I change function X?** | `codebase_impact target=X` |
| **What does this entry point actually do?** | `codebase_flow entrypoint=X` |
| **List entry points in this codebase** | `codebase_flow` (no args) |
| **Who calls this function and what does it call?** | `codebase_symbol name=X` |
| **What functions/classes exist in this file?** | `codebase_symbols file=path` |
| **Search for symbols by name across the project** | `codebase_symbols query=X` |
| Spot architectural problems | `codebase_graph_circular`, `codebase_graph_stats` |
| Visualise module structure | `codebase_graph_visualize` |
| Verify index is up to date | `codebase_status` |
| Discover what project knowledge (schemas, specs, configs) is available | `codebase_context` |
| Find database tables, API endpoints, infra configs | `codebase_context_search` |

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

## General Rules

- Sync `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` on any update — use `cp`
- The project uses ultracite for code quality and formatting. use bun run check or bun run fix to fix any lint warnings.
- For Impeccable detector use bunx impeccable --json "File".
- The project uses Bun for package management and runtime. Use `bun install`, `bun add`, `bun run`, and `bunx` instead of pnpm/npm/npx.
- Add locale keys to en.json and use bun run sync-locales to sync and auto-translate other languages files.
- Never suppress lint warnings — always apply best practices
- Explain tasks, errors, and solutions in plain English with minimal jargon
- When I bring you an issue, your job is not to fix it directly. Instead, open a brief discussion: ask clarifying questions, explore the problem space, and propose industry best-practice solutions. Always lean toward the approach that reflects current standards, and walk me through the reasoning so we decide together.
- When dealing with Coderabbit CLI it takes long time to review so use longer timeout.
- `shared/errors/AppError` is the SSOT error handler; do not create, invent, or throw custom errors; reuse it.
- `server/plugins/security.ts` is the SSOT for backend security; reuse or improve it when working with APIs.
- When you dispatch "EXPLORE" agent in parallel, make sure to collect all issues found including minor ones; do not rely solely on the "EXPLORE" agent's recommendation.
- Do not create or use Barrel files; apply best practice with explicit imports.

- Create Prisma manual migrations after every schema change
- Use the Postgres URL from `.env` for DB access

## QA & Dev

- After creating a new worktree, run `bun run setup-worktree`
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

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
specs/002-brand-model-inline-add/plan.md
<!-- SPECKIT END -->
