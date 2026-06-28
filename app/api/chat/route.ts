import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db, ensureSchema } from "@/lib/db";

// In-app assistant. Uses Haiku for fast, cheap turns and gives Claude tools so
// it can actually create tasks / notes / habits / goals from plain language.
const MODEL = "claude-haiku-4-5";

const tools: Anthropic.Tool[] = [
  {
    name: "add_task",
    description:
      "Add a to-do item. Use whenever the user says they need to do something.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "The task" },
        due: { type: "string", description: "Optional due date YYYY-MM-DD" },
      },
      required: ["title"],
    },
  },
  {
    name: "add_note",
    description: "Save a note, idea, or piece of information to remember.",
    input_schema: {
      type: "object",
      properties: { body: { type: "string" } },
      required: ["body"],
    },
  },
  {
    name: "add_habit",
    description: "Start tracking a recurring habit.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "add_goal",
    description: "Record a longer-term goal.",
    input_schema: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    },
  },
];

async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  const c = db();
  switch (name) {
    case "add_task":
      await c.execute({
        sql: "INSERT INTO tasks (title, due) VALUES (?, ?)",
        args: [String(input.title), (input.due as string) ?? null],
      });
      return `Added task: ${input.title}`;
    case "add_note":
      await c.execute({
        sql: "INSERT INTO notes (body) VALUES (?)",
        args: [String(input.body)],
      });
      return "Note saved.";
    case "add_habit":
      await c.execute({
        sql: "INSERT INTO habits (name) VALUES (?)",
        args: [String(input.name)],
      });
      return `Now tracking habit: ${input.name}`;
    case "add_goal":
      await c.execute({
        sql: "INSERT INTO goals (title) VALUES (?)",
        args: [String(input.title)],
      });
      return `Added goal: ${input.title}`;
    default:
      return `Unknown tool: ${name}`;
  }
}

async function context(): Promise<string> {
  const c = db();
  const [tasks, goals, habits] = await Promise.all([
    c.execute("SELECT title, done FROM tasks WHERE done = 0 LIMIT 20"),
    c.execute("SELECT title FROM goals WHERE status = 'active' LIMIT 20"),
    c.execute("SELECT name FROM habits LIMIT 20"),
  ]);
  return [
    `Open tasks: ${tasks.rows.map((r) => r.title).join("; ") || "none"}`,
    `Active goals: ${goals.rows.map((r) => r.title).join("; ") || "none"}`,
    `Habits: ${habits.rows.map((r) => r.name).join("; ") || "none"}`,
  ].join("\n");
}

export async function GET() {
  await ensureSchema();
  const r = await db().execute(
    "SELECT role, content FROM messages ORDER BY id ASC LIMIT 100",
  );
  return NextResponse.json(r.rows);
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set" },
      { status: 500 },
    );

  const { message } = await req.json();
  if (!message?.trim())
    return NextResponse.json({ error: "message required" }, { status: 400 });

  const c = db();
  await c.execute({
    sql: "INSERT INTO messages (role, content) VALUES ('user', ?)",
    args: [message.trim()],
  });

  const history = await c.execute(
    "SELECT role, content FROM messages ORDER BY id ASC LIMIT 40",
  );
  const messages: Anthropic.MessageParam[] = history.rows.map((r) => ({
    role: r.role === "assistant" ? "assistant" : "user",
    content: String(r.content),
  }));

  const client = new Anthropic();
  const system = `You are Peter's personal life assistant inside an app called PetersHelper. Be concise and proactive. When the user mentions something to do, remember, track, or aim for, use the matching tool to record it — don't just acknowledge it. Current state:\n${await context()}`;

  // Stream the reply back token-by-token. We run the same manual tool-use loop
  // as before, but pipe each text delta to the client as it's generated and only
  // persist the final assistant message once the loop is done.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      try {
        for (let i = 0; i < 6; i++) {
          const s = client.messages.stream({
            model: MODEL,
            max_tokens: 1024,
            system,
            tools,
            messages,
          });
          s.on("text", (delta) => {
            reply += delta;
            controller.enqueue(encoder.encode(delta));
          });
          const res = await s.finalMessage();
          messages.push({ role: "assistant", content: res.content });

          if (res.stop_reason !== "tool_use") break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of res.content) {
            if (block.type === "tool_use") {
              const out = await runTool(
                block.name,
                block.input as Record<string, unknown>,
              );
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: out,
              });
            }
          }
          messages.push({ role: "user", content: toolResults });
        }
      } catch {
        controller.enqueue(
          encoder.encode("\n\n[Sorry — something went wrong generating a reply.]"),
        );
      } finally {
        reply = reply.trim() || "Done.";
        await c.execute({
          sql: "INSERT INTO messages (role, content) VALUES ('assistant', ?)",
          args: [reply],
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
