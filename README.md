# PetersHelper

A continuously self-improving personal life assistant. It helps you manage
tasks, habits, goals, and notes, has an AI chat that can do those things for you
in plain language — and **improves its own code every day**, proposing each
change as a pull request you approve by merging.

## How the self-improvement works

```
You jot ideas in the Wishlist tab
        │
        ▼
Daily GitHub Action  →  Claude reads your wishlist + the codebase
        │                 picks ONE improvement, writes the code,
        │                 runs the build, opens a Pull Request
        ▼
You tap "Merge" to approve  →  Vercel auto-deploys  →  it's live
```

A pull request *is* the proposal; merging *is* your approval; the auto-deploy
*is* the follow-through. Full version history means any change is one click to
roll back.

## Run it locally

```bash
cp .env.example .env.local      # add your ANTHROPIC_API_KEY
npm install
npm run dev                     # http://localhost:3000
```

Locally it uses a SQLite file (`local.db`) — no database setup needed. The chat
tab needs `ANTHROPIC_API_KEY`; the other tabs work without it.

## Deploy it (free tier)

You need four accounts. You probably already have GitHub.

1. **GitHub** — push this repo to a new GitHub repository.
2. **Anthropic** — get an API key at [console.anthropic.com](https://console.anthropic.com).
   This powers the in-app chat (a few cents of API usage per conversation). The
   daily self-improvement loop runs on your Claude subscription instead — see below.
3. **Turso** ([turso.tech](https://turso.tech)) — create a free database; copy its
   URL and auth token. This is the persistent storage in production.
4. **Vercel** ([vercel.com](https://vercel.com)) — "Import" the GitHub repo. In the
   project's **Settings → Environment Variables** add:
   - `ANTHROPIC_API_KEY`
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`

   Vercel redeploys automatically every time a PR is merged.

### Turn on the daily self-improvement loop

The daily loop runs on your **Claude subscription** (no API billing) via an OAuth
token. You'll want the **Max** plan — the daily run uses Opus and does real work,
which would burn through Pro limits quickly.

1. Generate a token locally (logs in with your Claude subscription):
   ```bash
   claude setup-token
   ```
2. In the GitHub repo: **Secrets and variables → Actions → Secrets** → add
   `CLAUDE_CODE_OAUTH_TOKEN` with that value.
3. **Secrets and variables → Actions → Variables:** add `APP_URL` = your Vercel URL
   (e.g. `https://petershelper.vercel.app`) so the agent can read your wishlist.
4. Install the **Claude GitHub App** on the repo (the workflow uses
   [`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action)).
5. Under **Settings → Actions → General**, allow workflows to **create and approve
   pull requests**.

> The `ANTHROPIC_API_KEY` is still needed in **Vercel** — the in-app chat calls the
> Messages API directly and can't use a consumer subscription. The daily loop is
> the only part that runs on the subscription.

The workflow ([.github/workflows/self-improve.yml](.github/workflows/self-improve.yml))
runs daily at 08:00 UTC, and you can trigger it any time from the **Actions** tab.

## The Manage tab (in-app control center)

The **Manage** tab lets you run and oversee the self-improvement loop from inside
the app — no GitHub or terminal needed:

- **Status & control** — see the last run, and trigger a new improvement on demand.
- **Proposals** — review each open PR and **Approve & deploy** (merge) or **Dismiss** (close).
- **History & statistics** — every run/PR with its state, plus success counts.
- **Usage** — chat API tokens used and estimated cost.

It's protected by a passcode. To enable it, set two env vars (locally in
`.env.local`, in production in Vercel):

- `MANAGE_PASSCODE` — any secret; you'll enter it to unlock the tab.
- `GH_PAT` — a **GitHub fine-grained token** ([create one](https://github.com/settings/tokens?type=beta))
  scoped to this repo with **Actions: Read and write**, **Pull requests: Read and
  write**, **Contents: Read**. Without it the tab still shows usage stats but the
  run/PR controls are disabled.

## Project layout

| Path | What |
|---|---|
| [app/page.tsx](app/page.tsx) | The whole UI (tabs + small fetch helpers) |
| [app/api/](app/api/) | One route per feature: tasks, notes, habits, goals, wishlist, chat |
| [lib/db.ts](lib/db.ts) | Database client + schema |
| [CLAUDE.md](CLAUDE.md) | Guide the daily agent reads before improving the app |
| [.github/workflows/self-improve.yml](.github/workflows/self-improve.yml) | The daily loop |
