@AGENTS.md

# PetersHelper

A continuously self-improving personal life assistant for one user (Peter).

## What it is

A Next.js (App Router) app with six features, each a tab in the UI:

- **Chat** — an AI assistant (`claude-haiku-4-5`) that can create tasks, notes, habits, and goals from natural language via tool use. See [app/api/chat/route.ts](app/api/chat/route.ts).
- **Tasks**, **Habits**, **Goals**, **Notes** — simple CRUD, one API route each under [app/api/](app/api/).
- **Wishlist** — where Peter writes what the app should do better. This is the steering input for the daily self-improvement loop.

## Architecture

- **UI:** single client component, [app/page.tsx](app/page.tsx). Tabs + small fetch helpers. No component library — plain Tailwind.
- **Data:** libSQL via [lib/db.ts](lib/db.ts). Local SQLite file (`local.db`) in dev; Turso in production (`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`). Schema is created idempotently by `ensureSchema()`, called at the top of every route.
- **AI:** `@anthropic-ai/sdk`, key in `ANTHROPIC_API_KEY`.
- **Hosting:** Vercel (auto-deploys on merge to the default branch).

## Conventions

- Keep it simple and readable — match the existing style. No new dependencies unless clearly justified.
- Every API route calls `await ensureSchema()` first.
- New tables: add a `CREATE TABLE IF NOT EXISTS` to the batch in `ensureSchema()`.
- `npm run build` must pass (it type-checks). Don't break it.

## The self-improvement loop (how YOU improve this app)

Every day a GitHub Action runs you against this repo (see [.github/workflows/self-improve.yml](.github/workflows/self-improve.yml)). Your job:

1. Read `improvement-input.md` (Peter's wishlist, fetched from the live app) if present. It is ordered most-recent-first, so the **oldest pending items are at the bottom** — work those first (oldest-first / FIFO), not the freshest.
2. Work the **oldest pending wishlist items first**, aiming to clear up to **5** of them in this run. Only batch several when each is small, safe, and independent; if an item is large or risky, do just that one (or fewer) and stop. When the wishlist is empty, fall back to one obvious UX/quality win.
3. Implement them. Keep each change focused and the overall diff small and reviewable.
4. Run `npm run build` and fix any errors.
5. Leave the changes in the working tree; the workflow opens a pull request. Peter approves it from the app's **Manage** tab (the "Approve & deploy" button), which merges the PR and deploys it. **Do not push to the default branch directly.**

Guardrails: up to five small, safe wishlist items per run, oldest first — fewer (or one) when any item is non-trivial; keep every change focused and the total diff small and reviewable; never delete user data or features; never commit secrets; **never modify files under `.github/`** (the CI workflow can't be pushed by the run's token and you shouldn't rewrite your own CI); if nothing is worth changing, make no edits and the run will open no PR.
