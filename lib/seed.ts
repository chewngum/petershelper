import { type Client } from "@libsql/client";

// One-time, non-destructive content seeds. Each seed inserts only when its
// target is missing, so it never overwrites Peter's own edits and is safe to
// run on every boot (called from ensureSchema()).

// A starter ruleset for the "Pipe Dream" project (wishlist #10). It lands in
// the Projects tab as an editable draft Peter can rework, trim, or replace.
const PIPE_DREAM_RULES = `Pipe Dream — Draft Rules (v0.1)

A tile-laying race game for 2-4 plumbers. Build an unbroken pipeline from
your source to your drain before the rising water reaches an open end. This
is a first draft meant to be played, broken, and rewritten.

== Goal ==
Be the first plumber to connect your source tap to your drain with a
continuous run of pipe. If the water reaches an open-ended pipe before you
finish, that line bursts and you lose the tiles after the break.

== Components ==
- 1 shared 9x9 grid board (or draw one on paper).
- ~60 pipe tiles in five shapes: straight, elbow, T-junction, cross, and cap.
- 1 source tap and 1 drain marker per player, in player colours.
- 1 "water" token that advances along finished pipe.
- 1 six-sided die.

== Setup ==
1. Each player places their source tap on an edge square and their drain on
   the opposite edge. Sources and drains may not share a square.
2. Shuffle the pipe tiles into a face-down draw pile.
3. Each player draws a hand of 3 tiles.
4. Youngest player goes first; play passes clockwise.

== A Turn ==
On your turn, in order:
1. Draw 1 tile (keep your hand at a maximum of 4; discard down if over).
2. Place exactly 1 tile from your hand onto an empty square. The new tile
   must connect to an existing open end of YOUR line (or to your source on
   your first placement). Openings must line up edge-to-edge.
3. Optionally, pay 1 tile from your hand to the discard pile to rotate any
   one tile already on the board by 90 degrees (yours or an opponent's).

You may not place a tile that points into the board edge or into an
occupied square unless the shapes connect.

== The Water ==
After every full round (all players have taken a turn), roll the die. On a
4-6, the water token on each player's line advances one tile from the
source. If the water enters a tile with an open, unconnected end, that line
springs a leak: remove every tile beyond the leak and the water stops there.

== Winning ==
The first player to join source to drain in one continuous, leak-free run
wins immediately. If the draw pile runs out, the player whose pipeline
reaches closest to their drain wins; ties are shared.

== Variants to try ==
- Sabotage: spend 2 discards to remove one of an opponent's tiles.
- Pressure: on a roll of 6 the water advances two tiles instead of one.
- Co-op: one shared pipeline; everyone wins or loses together.

== Open questions (playtest these) ==
- Is a 9x9 grid too cramped for 4 players? Try 11x11.
- Should rotating an opponent's tile cost more?
- Does the cross tile make connections too easy?
`;

export async function seedProjects(c: Client): Promise<void> {
  const existing = await c.execute({
    sql: "SELECT 1 FROM projects WHERE lower(name) = lower(?) LIMIT 1",
    args: ["Pipe Dream"],
  });
  if (existing.rows.length > 0) return; // already there — leave Peter's edits alone
  await c.execute({
    sql: "INSERT INTO projects (name, body) VALUES (?, ?)",
    args: ["Pipe Dream", PIPE_DREAM_RULES],
  });
}
