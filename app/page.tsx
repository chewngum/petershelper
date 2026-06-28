"use client";

import { useEffect, useRef, useState } from "react";

type Row = Record<string, unknown>;

const TABS = ["Chat", "Tasks", "Habits", "Goals", "Notes", "Wishlist"] as const;
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
    await api("chat", "POST", { message: text });
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
