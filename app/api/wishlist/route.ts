import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

// The wishlist is how you steer the daily self-improvement agent: anything you
// jot here becomes input to tomorrow's improvement plan.
export async function GET() {
  await ensureSchema();
  const r = await db().execute("SELECT * FROM wishlist ORDER BY id DESC");
  return NextResponse.json(r.rows);
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const { body } = await req.json();
  if (!body?.trim())
    return NextResponse.json({ error: "body required" }, { status: 400 });
  await db().execute({
    sql: "INSERT INTO wishlist (body) VALUES (?)",
    args: [body.trim()],
  });
  return NextResponse.json({ ok: true });
}

// Mark an item completed ('done') or pending ('open').
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const { id, status } = await req.json();
  await db().execute({
    sql: "UPDATE wishlist SET status = ? WHERE id = ?",
    args: [status === "done" ? "done" : "open", id],
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const { id } = await req.json();
  await db().execute({ sql: "DELETE FROM wishlist WHERE id = ?", args: [id] });
  return NextResponse.json({ ok: true });
}
