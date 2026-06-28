// Thin wrapper over the GitHub REST API for the Manage tab. Uses a fine-grained
// token (GH_PAT) scoped to this repo with Actions + Pull requests + Contents.
const REPO = process.env.GH_REPO ?? "chewngum/petershelper";
const WORKFLOW = "self-improve.yml";

function token(): string {
  const t = process.env.GH_PAT;
  if (!t) throw new Error("GH_PAT is not set");
  return t;
}

async function gh(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

export type Run = {
  run_number: number;
  status: string; // queued | in_progress | completed
  conclusion: string | null; // success | failure | cancelled | null
  created_at: string;
  html_url: string;
};

export type PR = {
  number: number;
  title: string;
  body: string | null;
  state: string; // open | closed
  merged_at: string | null;
  created_at: string;
  html_url: string;
};

export async function listRuns(perPage = 30): Promise<Run[]> {
  const r = await gh(
    `/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=${perPage}`,
  );
  if (!r.ok) throw new Error(`runs ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return (j.workflow_runs ?? []).map((w: Record<string, unknown>) => ({
    run_number: w.run_number,
    status: w.status,
    conclusion: w.conclusion,
    created_at: w.created_at,
    html_url: w.html_url,
  }));
}

export async function listPRs(perPage = 30): Promise<PR[]> {
  const r = await gh(
    `/repos/${REPO}/pulls?state=all&sort=created&direction=desc&per_page=${perPage}`,
  );
  if (!r.ok) throw new Error(`pulls ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return (j as Record<string, unknown>[]).map((p) => ({
    number: p.number as number,
    title: p.title as string,
    body: (p.body as string) ?? null,
    state: p.state as string,
    merged_at: (p.merged_at as string) ?? null,
    created_at: p.created_at as string,
    html_url: p.html_url as string,
  }));
}

export async function dispatchRun(): Promise<void> {
  const r = await gh(
    `/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    { method: "POST", body: JSON.stringify({ ref: "main" }) },
  );
  if (!r.ok && r.status !== 204)
    throw new Error(`dispatch ${r.status}: ${await r.text()}`);
}

export async function mergePR(number: number): Promise<void> {
  const r = await gh(`/repos/${REPO}/pulls/${number}/merge`, {
    method: "PUT",
    body: JSON.stringify({ merge_method: "squash" }),
  });
  if (!r.ok) throw new Error(`merge ${r.status}: ${await r.text()}`);
}

export async function closePR(number: number): Promise<void> {
  const r = await gh(`/repos/${REPO}/pulls/${number}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed" }),
  });
  if (!r.ok) throw new Error(`close ${r.status}: ${await r.text()}`);
}
