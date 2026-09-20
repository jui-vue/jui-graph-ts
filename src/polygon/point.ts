// Port of juijs-graph's `src/polygon/point.js` (`chart.polygon.point`, `PointPolygon`).
//
// **`extend` chain, confirmed directly from source**: `extend: "chart.polygon.core"` - `PointPolygon`
// extends `PolygonCore` (`core.ts`, `extend: null`) DIRECTLY, not through any intermediate class.
// The original module does `jui.use(core)` (registers the base) then `component: function () {...
// return PointPolygon }` with no other `jui.include(...)` calls inside the factory itself - the
// constructor body only ever touches `this.vertices`/`this.vectors`, both fields `PolygonCore`
// itself declares but never initializes (see `core.ts`'s header comment) - straightforward single-
// level `extends`, no surprise sibling relationship (this task's brief explicitly warned not to
// assume one - confirmed by reading the file in full, there is none).
//
// **Cross-check against jui-chart-vue's `usePolygon3d.ts`**: no direct CLASS-shaped equivalent
// (jui-chart-vue is composable/plain-function-shaped throughout, per Phase 0 rule 5), but a direct
// FUNCTIONAL equivalent exists: `usePolygon3d.ts`'s own `vertex(x, y, z)` helper (`{ x, y, z, w: 1
// }`) builds the exact same single-homogeneous-vertex shape `PointPolygon`'s constructor does
// (`new Float32Array([x, y, d, 1])` - note the original's own third parameter is literally named
// `d`, not `z`, preserved here for 1:1 signature fidelity even though it plays the same role as
// `vertex()`'s `z`). Confirmed via jui-chart-vue's own `PORT_STATUS.md` (`column3d.js`/`line3d.js`
// entry, ~line 5896-5898): `PointPolygon` (`chart.polygon.point`) is the SAME primitive BOTH
// `dot3d.js`'s `createDot` (single point) AND `line3d.js`'s `createLine` (4 separate single-vertex
// `PointPolygon` calls building a ribbon quad, NOT a `LinePolygon`) construct - `usePolygon3d.ts`'s
// `vertex()` is jui-chart-vue's shared plain-function stand-in for exactly this constructor, reused
// by both `useDot3d.ts` and `useLine3d.ts`. No numeric test-oracle values to reuse directly here
// (`vertex()` is a trivial object-literal builder with no computation to hand-trace against), but
// the shape match confirms this port's own single-vertex `vertices` array construction is correct.
import { PolygonCore } from './core'

/**
 * Port of `chart.polygon.point`'s `PointPolygon(x, y, d)`. Builds a `PolygonCore` with exactly one
 * homogeneous vertex `[x, y, d, 1]` (parameter named `d`, not `z`, matching the original's own
 * signature exactly - it plays the same "depth" role `z` does everywhere else in this engine) and
 * an empty `vectors` array (populated lazily by `PolygonCore.rotate()` on first call, per its own
 * `vectors[i] == null` branch).
 */
export class PointPolygon extends PolygonCore {
  constructor(x: number, y: number, d: number) {
    super()
    this.vertices = [new Float32Array([x, y, d, 1])]
    this.vectors = []
  }
}
