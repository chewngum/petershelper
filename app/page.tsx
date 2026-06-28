"use client";

import { useEffect, useRef, useState } from "react";

type Row = Record<string, unknown>;

const TABS = [
  "Chat",
  "Tasks",
  "Habits",
  "Goals",
  "Notes",
  "Wishlist",
  "Manage",
] as const;
type Tab = (typeof TABS)[number];

async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("Chat");
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      <header className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-semibold tracking-tight">PetersHelper</h1>
        <p className="text-sm text-zinc-500">
          Your self-improving life assistant.
        </p>
      </header>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition ${
              tab === t
                ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>
      <main className="flex-1 px-4 pb-8">
        {tab === "Chat" && <Chat />}
        {tab === "Tasks" && <Tasks />}
        {tab === "Habits" && <Habits />}
        {tab === "Goals" && <Goals />}
        {tab === "Notes" && <Notes />}
        {tab === "Wishlist" && <Wishlist />}
        {tab === "Manage" && <Manage />}
      </main>
    </div>
  );
}

function Chat() {
  const [msgs, setMsgs] = useState<Row[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = () => api("chat").then(setMsgs);
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const reader = res.body?.getReader();
      if (reader) {
        // Stream the assistant's reply in, appending each chunk as it arrives.
        const decoder = new TextDecoder();
        let acc = "";
        let started = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          if (!started) {
            started = true;
            setBusy(false);
            setMsgs((m) => [...m, { role: "assistant", content: acc }]);
          } else {
            setMsgs((m) => {
              const copy = m.slice();
              copy[copy.length - 1] = { role: "assistant", content: acc };
              return copy;
            });
          }
        }
      }
    } catch {
      // Fall through to reload, which surfaces whatever was persisted.
    }
    setBusy(false);
    load();
  };

  return (
    <div className="flex h-[70vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto py-2">
        {msgs.length === 0 && (
          <p className="text-sm text-zinc-400">
            Try: &ldquo;Remind me to call the dentist tomorrow&rdquo; or
            &ldquo;Start tracking a reading habit&rdquo;.
          </p>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === "user"
                ? "ml-auto bg-blue-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            {String(m.content)}
          </div>
        ))}
        {busy && <div className="text-sm text-zinc-400">thinking…</div>}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 pt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Tell me what you need…"
          className="flex-1 rounded-full border border-zinc-300 px-4 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          onClick={send}
          disabled={busy}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Send
        </button>
      </div>
    </div>
  );
}

// Small reusable "add a row" input + list scaffold.
function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="mb-3 flex gap-2">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && v.trim()) {
            onAdd(v.trim());
            setV("");
          }
        }}
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        onClick={() => {
          if (v.trim()) {
            onAdd(v.trim());
            setV("");
          }
        }}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
      >
        Add
      </button>
    </div>
  );
}

function Tasks() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = () => api("tasks").then(setRows);
  useEffect(() => {
    load();
  }, []);
  return (
    <div>
      <AddRow
        placeholder="New task…"
        onAdd={async (title) => {
          await api("tasks", "POST", { title });
          load();
        }}
      />
      <ul className="space-y-1">
        {rows.map((t) => (
          <li
            key={String(t.id)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <input
              type="checkbox"
              checked={!!t.done}
              onChange={async () => {
                await api("tasks", "PATCH", { id: t.id, done: !t.done });
                load();
              }}
            />
            <span className={`flex-1 text-sm ${t.done ? "text-zinc-400 line-through" : ""}`}>
              {String(t.title)}
              {t.due ? <span className="ml-2 text-xs text-zinc-400">{String(t.due)}</span> : null}
            </span>
            <Del onClick={async () => { await api("tasks", "DELETE", { id: t.id }); load(); }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Habits() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = () => api("habits").then(setRows);
  useEffect(() => {
    load();
  }, []);
  return (
    <div>
      <AddRow
        placeholder="New habit…"
        onAdd={async (name) => {
          await api("habits", "POST", { name });
          load();
        }}
      />
      <ul className="space-y-1">
        {rows.map((h) => (
          <li
            key={String(h.id)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <button
              onClick={async () => {
                await api("habits", "PATCH", { id: h.id });
                load();
              }}
              className={`h-6 w-6 rounded-full border text-xs ${
                h.doneToday
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-zinc-300 dark:border-zinc-600"
              }`}
            >
              {h.doneToday ? "✓" : ""}
            </button>
            <span className="flex-1 text-sm">{String(h.name)}</span>
            <span className="text-xs text-zinc-400">{String(h.last7)}/7</span>
            <Del onClick={async () => { await api("habits", "DELETE", { id: h.id }); load(); }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Goals() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = () => api("goals").then(setRows);
  useEffect(() => {
    load();
  }, []);
  return (
    <div>
      <AddRow
        placeholder="New goal…"
        onAdd={async (title) => {
          await api("goals", "POST", { title });
          load();
        }}
      />
      <ul className="space-y-1">
        {rows.map((g) => (
          <li
            key={String(g.id)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <input
              type="checkbox"
              checked={g.status === "done"}
              onChange={async () => {
                await api("goals", "PATCH", {
                  id: g.id,
                  status: g.status === "done" ? "active" : "done",
                });
                load();
              }}
            />
            <span className={`flex-1 text-sm ${g.status === "done" ? "text-zinc-400 line-through" : ""}`}>
              {String(g.title)}
            </span>
            <Del onClick={async () => { await api("goals", "DELETE", { id: g.id }); load(); }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Notes() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = () => api("notes").then(setRows);
  useEffect(() => {
    load();
  }, []);
  return (
    <div>
      <AddRow
        placeholder="New note…"
        onAdd={async (body) => {
          await api("notes", "POST", { body });
          load();
        }}
      />
      <ul className="space-y-2">
        {rows.map((n) => (
          <li
            key={String(n.id)}
            className="flex items-start gap-2 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
          >
            <span className="flex-1 whitespace-pre-wrap">{String(n.body)}</span>
            <Del onClick={async () => { await api("notes", "DELETE", { id: n.id }); load(); }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Wishlist() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = () => api("wishlist").then(setRows);
  useEffect(() => {
    load();
  }, []);
  return (
    <div>
      <p className="mb-3 text-sm text-zinc-500">
        What should this app do better? Anything you add here is fed to the daily
        self-improvement agent, which proposes a change as a pull request for you
        to approve.
      </p>
      <AddRow
        placeholder="I wish this app could…"
        onAdd={async (body) => {
          await api("wishlist", "POST", { body });
          load();
        }}
      />
      <ul className="space-y-2">
        {rows.map((w) => (
          <li
            key={String(w.id)}
            className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20"
          >
            <span className="flex-1 whitespace-pre-wrap">{String(w.body)}</span>
            <Del onClick={async () => { await api("wishlist", "DELETE", { id: w.id }); load(); }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

type ManageData = {
  latestRun: Row | null;
  runs: Row[];
  prs: Row[];
  stats: Record<string, number | boolean>;
  usage: Record<string, number>;
  githubError: string | null;
};

function Manage() {
  const [passcode, setPasscode] = useState<string>("");
  const [entered, setEntered] = useState(false);
  const [data, setData] = useState<ManageData | null>(null);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ph_passcode");
    if (saved) {
      setPasscode(saved);
      setEntered(true);
    }
  }, []);

  const load = async (code: string) => {
    setError("");
    const res = await fetch("/api/manage", { headers: { "x-passcode": code } });
    if (res.status === 401) {
      setError("Wrong passcode.");
      setEntered(false);
      localStorage.removeItem("ph_passcode");
      return;
    }
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Error");
      setData(null);
      return;
    }
    localStorage.setItem("ph_passcode", code);
    setData(await res.json());
  };

  useEffect(() => {
    if (entered && passcode) load(passcode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered]);

  const act = async (action: string, number?: number) => {
    setBusy(true);
    const res = await fetch("/api/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-passcode": passcode },
      body: JSON.stringify({ action, number }),
    });
    setBusy(false);
    if (!res.ok) {
      const e = (await res.json().catch(() => ({})))?.error ?? "Action failed";
      setError(String(e));
      return;
    }
    setError("");
    setTimeout(() => load(passcode), 1500); // give GitHub a moment
  };

  if (!entered) {
    return (
      <div className="mx-auto max-w-sm pt-8">
        <p className="mb-3 text-sm text-zinc-500">
          Enter your management passcode.
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setEntered(true)}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="passcode"
          />
          <button
            onClick={() => setEntered(true)}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
          >
            Unlock
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  if (!data) {
    return (
      <p className="pt-6 text-sm text-zinc-500">
        {error || "Loading…"}
        {error && (
          <button
            onClick={() => {
              setEntered(false);
              localStorage.removeItem("ph_passcode");
            }}
            className="ml-2 underline"
          >
            re-enter passcode
          </button>
        )}
      </p>
    );
  }

  const s = data.stats;
  const u = data.usage;
  const openPrs = data.prs.filter((p) => p.state === "open");

  return (
    <div className="space-y-6 py-2">
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Status + control */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Status
          </h2>
          <button
            onClick={() => act("run")}
            disabled={busy || !!s.runInProgress}
            className="rounded-full bg-green-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {s.runInProgress ? "Run in progress…" : "Run improvement now"}
          </button>
        </div>
        {data.latestRun ? (
          <p className="text-sm">
            Last run #{String(data.latestRun.run_number)} —{" "}
            <StatusBadge run={data.latestRun} />{" "}
            <a
              href={String(data.latestRun.html_url)}
              target="_blank"
              className="text-zinc-400 underline"
            >
              logs
            </a>
          </p>
        ) : (
          <p className="text-sm text-zinc-500">No runs yet.</p>
        )}
        {data.githubError && (
          <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/30">
            GitHub not connected: {data.githubError}. Set the <code>GH_PAT</code>{" "}
            env var to enable run/PR controls.
          </p>
        )}
      </section>

      {/* Stats */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Statistics
        </h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Runs" value={Number(s.runsTotal)} />
          <Stat label="Succeeded" value={Number(s.runsSucceeded)} />
          <Stat label="Failed" value={Number(s.runsFailed)} />
          <Stat label="PRs merged" value={Number(s.prsMerged)} />
          <Stat label="PRs open" value={Number(s.prsOpen)} />
          <Stat label="PRs dismissed" value={Number(s.prsClosed)} />
        </div>
      </section>

      {/* Usage */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Chat API usage
        </h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Messages" value={u.chatMessages} />
          <Stat
            label="Tokens"
            value={u.inputTokens + u.outputTokens}
          />
          <Stat label="Est. cost" value={`$${u.estCostUsd.toFixed(3)}`} />
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          Daily self-improvement runs on your Claude subscription (no per-token
          API cost), so they&apos;re counted as runs above, not tokens here.
        </p>
      </section>

      {/* Open proposals */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Proposals awaiting your approval
        </h2>
        {openPrs.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing pending.</p>
        ) : (
          <ul className="space-y-3">
            {openPrs.map((p) => (
              <li
                key={String(p.number)}
                className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={String(p.html_url)}
                    target="_blank"
                    className="text-sm font-medium underline"
                  >
                    #{String(p.number)} {String(p.title)}
                  </a>
                </div>
                {p.body ? (
                  <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs text-zinc-500">
                    {String(p.body)}
                  </p>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => act("merge", p.number as number)}
                    disabled={busy}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                  >
                    Approve &amp; deploy
                  </button>
                  <button
                    onClick={() => act("close", p.number as number)}
                    disabled={busy}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700"
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* History */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          History
        </h2>
        <ul className="space-y-1 text-sm">
          {data.prs.map((p) => (
            <li key={String(p.number)} className="flex items-center gap-2">
              <PrBadge pr={p} />
              <a
                href={String(p.html_url)}
                target="_blank"
                className="flex-1 truncate underline"
              >
                #{String(p.number)} {String(p.title)}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function StatusBadge({ run }: { run: Row }) {
  const status = String(run.status);
  const conclusion = run.conclusion ? String(run.conclusion) : null;
  const text = status !== "completed" ? status : (conclusion ?? "done");
  const color =
    conclusion === "success"
      ? "text-green-600"
      : conclusion === "failure"
        ? "text-red-600"
        : "text-amber-600";
  return <span className={`font-medium ${color}`}>{text}</span>;
}

function PrBadge({ pr }: { pr: Row }) {
  const merged = !!pr.merged_at;
  const open = pr.state === "open";
  const [label, cls] = merged
    ? ["merged", "bg-purple-100 text-purple-700"]
    : open
      ? ["open", "bg-green-100 text-green-700"]
      : ["closed", "bg-zinc-200 text-zinc-600"];
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs ${cls}`}>{label}</span>
  );
}

function Del({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-zinc-300 hover:text-red-500"
      aria-label="delete"
    >
      ✕
    </button>
  );
}
