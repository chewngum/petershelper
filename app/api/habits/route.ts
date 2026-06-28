import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

// Returns each habit with whether it's been checked off today and a 7-day streak count.
export async function GET() {
  await ensureSchema();
  const c = db();
  const habits = await c.execute("SELECT * FROM habits ORDER BY id ASC");
  const today = new Date().toISOString().slice(0, 10);
  const logs = await c.execute(
    "SELECT habit_id, day FROM habit_logs WHERE day >= date('now', '-7 day')",
  );
  const rows = habits.rows.map((h) => {
    const days = logs.rows.filter((l) => l.habit_id === h.id).map((l) => l.day);
    return {
      ...h,
      doneToday: days.includes(today),
      last7: days.length,
    };
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const { name } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "name required" }, { status: 400 });
  await db().execute({
    sql: "INSERT INTO habits (name) VALUES (?)",
    args: [name.trim()],
  });
  return NextResponse.json({ ok: true });
}

// Toggle today's completion for a habit.
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const { id } = await req.json();
  const c = db();
  const today = new Date().toISOString().slice(0, 10);
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
