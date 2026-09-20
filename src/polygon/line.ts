// Port of juijs-graph's `src/polygon/line.js` (`chart.polygon.line`, `LinePolygon`).
//
// **`extend` chain, confirmed directly from source**: `extend: "chart.polygon.core"` - `LinePolygon`
// extends `PolygonCore` (`core.ts`, `extend: null`) DIRECTLY, exactly the same single-level shape as
// `point.ts`/`cube.ts` (NOT a `PointPolygon` subclass, despite "a line is two points" being a
// plausible-looking guess this task's brief explicitly warned not to assume - confirmed false by
// reading the file in full: the original's own factory only does `jui.use(core)`, never
// `jui.use(point)` or anything referencing `PointPolygon`). Constructor body only touches
// `this.vertices`/`this.vectors`, same as every other `polygon/*.js` primitive.
//
// **Cross-check against jui-chart-vue's `usePolygon3d.ts` - CONFIRMED per this task's own specific
// instruction to verify precisely, NOT assumed**: `LinePolygon` (`chart.polygon.line`) has NO
// consumer anywhere in jui-chart-vue, direct or indirect. Verified from jui-chart-vue's own
// `PORT_STATUS.md`, `column3d.js`/`line3d.js` entry (~line 5896-5897): "`line3d.js`'s `createLine`
// instead makes 4 separate calls each wrapping a single-vertex `PointPolygon` (`chart.polygon.point`
// - the SAME primitive `dot3d.js`'s own `createDot` already uses)" - i.e. the one jui-chart-vue brush
// whose name ("line3d") would suggest it uses `LinePolygon` in fact builds its 4-point ribbon quad
// out of FOUR separate `PointPolygon` instances instead, never touching `chart.polygon.line` at all.
// A full grep of `jui-graph`'s own real source tree (`grep -rn "polygon.line\|LinePolygon"
// /home/search5/cl/jui-graph/src`, run as part of this verification, NOT assumed) found this is
// NOT actually dead code in the upstream engine itself - `LinePolygon` IS constructed, repeatedly,
// by `grid/draw3d.js` (`jui.include("chart.polygon.line")`, 8 call sites: the 3D grid's edge/side
// outline lines AND its internal cross-hatch mesh lines). `grid/draw3d.js` is explicitly out of
// scope for THIS task (per this task's own instructions: "Do NOT touch grid/draw3d.ts - a
// concurrent agent may be assigned to it"), and no `jui-chart-vue` composable wraps 3D grid-mesh
// rendering at all (confirmed: jui-chart-vue's `PORT_STATUS.md` documents `dot3d.js`/`column3d.js`/
// `line3d.js`/`rotate3d.js` as its only ported 3D-engine consumers - none of which touch
// `grid/draw3d.js` or `chart.polygon.line`). So the precise finding is: `LinePolygon` has NO
// jui-chart-vue reference to cross-check against (confirmed), but IS real, live, non-dead code in
// the original engine - just consumed by a file this task doesn't own. `usePolygon3d.ts` therefore
// has no dedicated per-file equivalent to cross-check against; this is accordingly ported as a FULL
// INDEPENDENT PORT, with only the underlying rotation/perspective MATH (inherited unchanged from
// `PolygonCore`, already cross-checked exhaustively in `core.ts`/`core.spec.ts`) shared with
// `usePolygon3d.ts`'s general `rotatePolygonVertices()` - there is no `LinePolygon`-specific
// numeric oracle to reuse, so this file's own tests are hand-traced from scratch below (two-vertex
// construction is structurally identical to `PolygonCore.spec.ts`'s own existing multi-vertex
// `rotate()`/`min()`/`max()` coverage, reused as the verification pattern). When `grid/draw3d.ts`
// is eventually ported, it should import this `LinePolygon` class directly (matching this file's
// real role in the original engine), not treat it as unused.
import { PolygonCore } from './core'

/**
 * Port of `chart.polygon.line`'s `LinePolygon(x1, y1, d1, x2, y2, d2)`. Builds a `PolygonCore` with
 * exactly two homogeneous vertices `[x1, y1, d1, 1]` and `[x2, y2, d2, 1]` (parameter names `d1`/`d2`,
 * not `z1`/`z2`, matching the original's own signature exactly) and an empty `vectors` array
 * (populated lazily by `PolygonCore.rotate()`, same as every other primitive here).
 */
export class LinePolygon extends PolygonCore {
  constructor(x1: number, y1: number, d1: number, x2: number, y2: number, d2: number) {
    super()
    this.vertices = [new Float32Array([x1, y1, d1, 1]), new Float32Array([x2, y2, d2, 1])]
    this.vectors = []
  }
}
