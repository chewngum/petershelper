import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export async function GET() {
  await ensureSchema();
  const r = await db().execute(
    "SELECT * FROM tasks ORDER BY done ASC, COALESCE(due, '9999') ASC, id DESC",
  );
  return NextResponse.json(r.rows);
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const { title, due } = await req.json();
  if (!title?.trim())
    return NextResponse.json({ error: "title required" }, { status: 400 });
  await db().execute({
    sql: "INSERT INTO tasks (title, due) VALUES (?, ?)",
    args: [title.trim(), due ?? null],
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const body = await req.json();
  const { id } = body;
  if (id == null)
    return NextResponse.json({ error: "id required" }, { status: 400 });
  // Partial update: only touch the fields that were sent.
  if ("done" in body) {
    await db().execute({
      sql: "UPDATE tasks SET done = ? WHERE id = ?",
      args: [body.done ? 1 : 0, id],
    });
  }
  if ("due" in body) {
    const due =
      typeof body.due === "string" && body.due.trim() ? body.due.trim() : null;
    await db().execute({
      sql: "UPDATE tasks SET due = ? WHERE id = ?",
      args: [due, id],
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const { id } = await req.json();
  await db().execute({ sql: "DELETE FROM tasks WHERE id = ?", args: [id] });
  return NextResponse.json({ ok: true });
}
