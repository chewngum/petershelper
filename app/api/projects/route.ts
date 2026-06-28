import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export async function GET() {
  await ensureSchema();
  const r = await db().execute(
    "SELECT * FROM projects ORDER BY updated_at DESC, id DESC",
  );
  return NextResponse.json(r.rows);
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const { name } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "name required" }, { status: 400 });
  const r = await db().execute({
    sql: "INSERT INTO projects (name) VALUES (?) RETURNING *",
    args: [name.trim()],
  });
  return NextResponse.json(r.rows[0] ?? { ok: true });
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const { id, name, body } = await req.json();
  if (id == null)
    return NextResponse.json({ error: "id required" }, { status: 400 });
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (typeof name === "string" && name.trim()) {
    sets.push("name = ?");
    args.push(name.trim());
  }
  if (typeof body === "string") {
    sets.push("body = ?");
    args.push(body);
  }
  if (sets.length === 0)
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  sets.push("updated_at = datetime('now')");
  args.push(id);
  await db().execute({
    sql: `UPDATE projects SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const { id } = await req.json();
  await db().execute({ sql: "DELETE FROM projects WHERE id = ?", args: [id] });
  return NextResponse.json({ ok: true });
}
