import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export async function GET() {
  await ensureSchema();
  const r = await db().execute("SELECT * FROM notes ORDER BY id DESC");
  return NextResponse.json(r.rows);
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const { body } = await req.json();
  if (!body?.trim())
    return NextResponse.json({ error: "body required" }, { status: 400 });
  await db().execute({
    sql: "INSERT INTO notes (body) VALUES (?)",
    args: [body.trim()],
  });
  return NextResponse.json({ ok: true });
}

// Edit a note's text in place.
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const { id, body } = await req.json();
  if (id == null)
    return NextResponse.json({ error: "id required" }, { status: 400 });
  if (typeof body !== "string" || !body.trim())
    return NextResponse.json({ error: "body required" }, { status: 400 });
  await db().execute({
    sql: "UPDATE notes SET body = ? WHERE id = ?",
    args: [body.trim(), id],
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const { id } = await req.json();
  await db().execute({ sql: "DELETE FROM notes WHERE id = ?", args: [id] });
  return NextResponse.json({ ok: true });
}
