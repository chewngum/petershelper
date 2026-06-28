import { createClient, type Client } from "@libsql/client";

// One shared libSQL client. In production set TURSO_DATABASE_URL (and
// TURSO_AUTH_TOKEN) to a Turso database; locally we fall back to a SQLite
// file so the app runs with zero setup.
let _client: Client | null = null;

export function db(): Client {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  _client = createClient(authToken ? { url, authToken } : { url });
  return _client;
}

// Create tables on first use. Cheap and idempotent (IF NOT EXISTS), so we
// call it at the top of every API route via ensureSchema().
let _ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (_ready) return _ready;
  _ready = (async () => {
    const c = db();
    await c.batch(
      [
        `CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          done INTEGER NOT NULL DEFAULT 0,
          due TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          body TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS habits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          minutes INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS habit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          habit_id INTEGER NOT NULL,
          day TEXT NOT NULL,
          UNIQUE (habit_id, day)
        )`,
        `CREATE TABLE IF NOT EXISTS goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS wishlist (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          body TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'open',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL,
          model TEXT,
          input_tokens INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
      ],
      "write",
    );
    // Lightweight migrations for columns added to tables that may already
    // exist in production. ALTER TABLE ADD COLUMN throws if the column is
    // already there, so we run each one tolerantly.
    await addColumnIfMissing(c, "habits", "minutes", "INTEGER");
  })();
  return _ready;
}

// Add a column to an existing table, ignoring the error raised when it is
// already present. Keeps migrations idempotent without a version table.
async function addColumnIfMissing(
  c: Client,
  table: string,
  column: string,
  type: string,
): Promise<void> {
  try {
    await c.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch {
    // Column already exists — nothing to do.
  }
}
