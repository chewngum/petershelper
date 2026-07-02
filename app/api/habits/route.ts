import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

// Habits roll over at 7am rather than midnight: a check-off before 7am counts
// toward the previous day. The timezone defaults to the deployment's zone (UTC
// on Vercel); set HABIT_TZ to an IANA zone (e.g. "America/New_York") to use
// your own local 7am.
const RESET_HOUR = 7;
const ZONE =
  process.env.HABIT_TZ ||
  Intl.DateTimeFormat().resolvedOptions().timeZone ||
  "UTC";

// The current "habit day" as YYYY-MM-DD, shifted so each day starts at 7am.
function habitDay(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour"); // some envs emit "24"
  // Reconstruct the zoned wall-clock as a UTC instant, then step back the reset
  // hour so anything before 7am lands on the previous date.
  const d = new Date(`${get("year")}-${get("month")}-${get("day")}T${hour}:00:00Z`);
  d.setUTCHours(d.getUTCHours() - RESET_HOUR);
  return d.toISOString().slice(0, 10);
}

// Whole days between two YYYY-MM-DD habit days (parsed as UTC midnight).
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

// Shift a YYYY-MM-DD habit day by n days (n may be negative).
function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Length of the current run of consecutive completed days. The streak is still
// "alive" if the habit was done today or yesterday; a gap breaks it.
function currentStreak(days: Set<string>, today: string): number {
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// Returns each habit with whether it's been checked off today, the number of
// days completed, and the number of days since the habit was added.
export async function GET() {
  await ensureSchema();
  const c = db();
  const habits = await c.execute("SELECT * FROM habits ORDER BY id ASC");
  const logs = await c.execute("SELECT habit_id, day FROM habit_logs");
  const today = habitDay();
  const rows = habits.rows.map((h) => {
    const days = logs.rows
      .filter((l) => l.habit_id === h.id)
      .map((l) => String(l.day));
    // created_at is stored as "YYYY-MM-DD HH:MM:SS" in UTC.
    const createdDay = habitDay(
      new Date(String(h.created_at).replace(" ", "T") + "Z"),
    );
    const totalDays = Math.max(1, daysBetween(createdDay, today) + 1);
    return {
      ...h,
      doneToday: days.includes(today),
      done: days.length,
      totalDays,
      streak: currentStreak(new Set(days), today),
    };
  });
  return NextResponse.json(rows);
}

// Parse a minutes value into a positive integer, or null to clear it.
function parseMinutes(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const { name, minutes } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "name required" }, { status: 400 });
  await db().execute({
    sql: "INSERT INTO habits (name, minutes) VALUES (?, ?)",
    args: [name.trim(), parseMinutes(minutes)],
  });
  return NextResponse.json({ ok: true });
}

// Either set a habit's duration (when `minutes` is provided) or toggle today's
// completion (when it isn't).
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const body = await req.json();
  const { id } = body;
  const c = db();
  if ("minutes" in body) {
    await c.execute({
      sql: "UPDATE habits SET minutes = ? WHERE id = ?",
      args: [parseMinutes(body.minutes), id],
    });
    return NextResponse.json({ ok: true });
  }
  const today = habitDay();
  const existing = await c.execute({
    sql: "SELECT id FROM habit_logs WHERE habit_id = ? AND day = ?",
    args: [id, today],
  });
  if (existing.rows.length) {
    await c.execute({
      sql: "DELETE FROM habit_logs WHERE habit_id = ? AND day = ?",
      args: [id, today],
    });
  } else {
    await c.execute({
      sql: "INSERT INTO habit_logs (habit_id, day) VALUES (?, ?)",
      args: [id, today],
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const { id } = await req.json();
  const c = db();
  await c.execute({ sql: "DELETE FROM habit_logs WHERE habit_id = ?", args: [id] });
  await c.execute({ sql: "DELETE FROM habits WHERE id = ?", args: [id] });
  return NextResponse.json({ ok: true });
}
