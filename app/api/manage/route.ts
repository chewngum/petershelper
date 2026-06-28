import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import {
  listRuns,
  listPRs,
  dispatchRun,
  mergePR,
  closePR,
  getPRBody,
} from "@/lib/github";

// Haiku 4.5 pricing ($/million tokens) for the chat usage cost estimate.
const PRICE_IN = 1.0;
const PRICE_OUT = 5.0;

function authed(req: NextRequest): boolean {
  const expected = process.env.MANAGE_PASSCODE;
  if (!expected) return false;
  return req.headers.get("x-passcode") === expected;
}

async function usageStats() {
  const r = await db().execute(
    "SELECT COUNT(*) n, COALESCE(SUM(input_tokens),0) i, COALESCE(SUM(output_tokens),0) o FROM usage WHERE kind='chat'",
  );
  const row = r.rows[0] as Record<string, number>;
  const input = Number(row.i);
  const output = Number(row.o);
  return {
    chatMessages: Number(row.n),
    inputTokens: input,
    outputTokens: output,
    estCostUsd: (input / 1e6) * PRICE_IN + (output / 1e6) * PRICE_OUT,
  };
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  if (!process.env.MANAGE_PASSCODE)
    return NextResponse.json(
      { error: "MANAGE_PASSCODE is not set on the server" },
      { status: 503 },
    );
  if (!authed(req))
    return NextResponse.json({ error: "bad passcode" }, { status: 401 });

  try {
    const usage = await usageStats();

    // GitHub may be unconfigured (no GH_PAT) — degrade gracefully.
    let runs: Awaited<ReturnType<typeof listRuns>> = [];
    let prs: Awaited<ReturnType<typeof listPRs>> = [];
    let githubError: string | null = null;
    try {
      [runs, prs] = await Promise.all([listRuns(), listPRs()]);
    } catch (e) {
      githubError = e instanceof Error ? e.message : String(e);
    }

    const stats = {
      runsTotal: runs.length,
      runsSucceeded: runs.filter((r) => r.conclusion === "success").length,
      runsFailed: runs.filter((r) => r.conclusion === "failure").length,
      runInProgress: runs.some((r) => r.status !== "completed"),
      prsOpen: prs.filter((p) => p.state === "open").length,
      prsMerged: prs.filter((p) => p.merged_at).length,
      prsClosed: prs.filter((p) => p.state === "closed" && !p.merged_at).length,
    };

    return NextResponse.json({
      latestRun: runs[0] ?? null,
      runs: runs.slice(0, 10),
      prs: prs.slice(0, 20),
      stats,
      usage,
      githubError,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  if (!authed(req))
    return NextResponse.json({ error: "bad passcode" }, { status: 401 });

  const { action, number, title, feedback } = await req.json();
  try {
    if (action === "run") await dispatchRun();
    else if (action === "merge") {
      // Read the PR body before merging so we can archive any wishlist item it
      // says it implemented (trailer line like "Wishlist-Item: #5").
      const body = await getPRBody(number).catch(() => "");
      await mergePR(number);
      const m = body.match(/Wishlist-Item:\s*#?(\d+)/i);
      if (m)
        await db().execute({
          sql: "UPDATE wishlist SET status = 'done' WHERE id = ?",
          args: [Number(m[1])],
        });
    } else if (action === "close") await closePR(number);
    else if (action === "revise") {
      // "Request a different solution": dismiss this proposal and feed the
      // request back to the agent as a wishlist item, so the next run retries
      // with a different approach.
      const note = String(feedback || "").trim();
      const what = String(title || `PR #${number}`).trim();
      const body =
        `Re-do the change proposed in PR #${number} ("${what}") with a different approach.` +
        (note ? ` What to change: ${note}` : "");
      await db().execute({
        sql: "INSERT INTO wishlist (body) VALUES (?)",
        args: [body],
      });
      await closePR(number);
    } else return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
