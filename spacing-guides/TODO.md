# Known gaps

Prototype scope, tracked here so they don't get lost. Add to this list as you
run into more while using the plugin.

- **No snapping.** The guide is purely visual — it shows when gaps match but
  doesn't pull the dragged shape into place. PowerPoint/Slides-style smart
  guides snap; this doesn't yet.
- **Single-shape drags only.** `context.shapes.length !== 1` short-circuits
  to no guide. Multi-select moves are ignored entirely.
- **BPMN-flow neighbors only.** Matches are computed against the shape's
  sequence-flow predecessor/successor, not arbitrary nearby shapes. Elements
  without sequence flows (boundary events, elements in a pool with no
  flow, lanes/pools themselves) never get a guide.
- **Never tested inside the real Camunda Modeler.** Verified so far only in
  a bare bpmn-js harness (`dev/`). Needs a pass in the actual desktop app —
  behavior around zoom levels, container nesting (subprocesses), and
  attachers (boundary events riding along on a move) is unverified.
- **No vertical-chain field testing.** `getOrientation` picks
  horizontal/vertical from relative shape centers and the math is covered by
  unit tests, but it hasn't been eyeballed on a real top-to-bottom diagram.
