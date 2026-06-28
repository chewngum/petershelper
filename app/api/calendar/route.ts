import { db, ensureSchema } from "@/lib/db";

// Read-only iCalendar (.ics) feed of tasks that have a due date. Point Google
// Calendar (or any calendar app) at this URL via "Add calendar → From URL" to
// see your task due dates as all-day events. The feed refreshes on its own,
// since the calendar app re-fetches it periodically.

// iCalendar text values must escape \, ; , and newlines (RFC 5545 §3.3.11).
function escape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// "2026-06-28" -> "20260628" (all-day DATE value). Returns null if not a date.
function toIcsDate(due: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(due);
  return m ? `${m[1]}${m[2]}${m[3]}` : null;
}

// "20260628" -> "20260629" (DTEND is exclusive for all-day events).
function nextDay(yyyymmdd: string): string {
  const y = Number(yyyymmdd.slice(0, 4));
  const mo = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  const dt = new Date(Date.UTC(y, mo - 1, d + 1));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}`;
}

export async function GET() {
  await ensureSchema();
  const r = await db().execute(
    "SELECT id, title, done, due FROM tasks WHERE due IS NOT NULL AND due != '' ORDER BY due ASC",
  );

  const stamp =
    new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PetersHelper//Tasks//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:PetersHelper Tasks",
  ];

  for (const row of r.rows) {
    const start = toIcsDate(String(row.due));
    if (!start) continue;
    const done = !!row.done;
    const title = `${done ? "✓ " : ""}${String(row.title)}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:task-${String(row.id)}@petershelper`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${nextDay(start)}`,
      `SUMMARY:${escape(title)}`,
      `STATUS:${done ? "COMPLETED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  // RFC 5545 wants CRLF line endings.
  const body = lines.join("\r\n") + "\r\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="petershelper.ics"',
      "Cache-Control": "no-cache",
    },
  });
}
