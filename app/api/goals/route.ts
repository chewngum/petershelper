import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export async function GET() {
  await ensureSchema();
  const r = await db().execute(
    "SELECT * FROM goals ORDER BY status ASC, id DESC",
  );
  return NextResponse.json(r.rows);
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const { title } = await req.json();
  if (!title?.trim())
    return NextResponse.json({ error: "title required" }, { status: 400 });
  await db().execute({
    sql: "INSERT INTO goals (title) VALUES (?)",
    args: [title.trim()],
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const { id, status } = await req.json();
  await db().execute({
    sql: "UPDATE goals SET status = ? WHERE id = ?",
    args: [status, id],
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const { id } = await req.json();
  await db().execute({ sql: "DELETE FROM goals WHERE id = ?", args: [id] });
  return NextResponse.json({ ok: true });
}
