// Port of juijs-graph's `src/polygon/grid.js` (`chart.polygon.grid`). **Extend chain confirmed
// directly from source, not assumed**: `extend: "chart.polygon.core"` - `GridPolygon extends
// PolygonCore` (`polygon/core.ts`, Phase D, already ported), same pattern every other
// `polygon/*.js` file uses.
//
// **No existing jui-chart-vue reference** for this file (per this task's brief and confirmed by
// re-checking `usePolygon3d.ts`'s own header comment): jui-chart-vue's 3D charts use a simplified
// linear/ordinal z-axis rather than a real ported 3D grid mesh, so `dot3d.js`/`column3d.js`/
// `line3d.js`/`rotate3d.js` never needed a `GridPolygon`-shaped quad. Full independent port +
// verification (Node-hand-traced test oracle, no borrowed expected values).
//
// **Real consumer, read directly (not ported this iteration) to confirm this class's public
// surface satisfies it**: `grid/draw3d.js`'s `drawAxisLine()` is the only real caller in the whole
// engine. It always constructs `new GridPolygon(type, w, h, d, x, y)` with `type` one of exactly
// the three literal strings this class's own `matrix` object defines
// (`"center"`/`"horizontal"`/`"vertical"` - never a fourth), passes it straight into
// `this.calculate3d(p)` (`base/draw.ts`, already ported, Phase B - sets `p.perspective` then calls
// `p.rotate(Math.max(w,h,d), r, x+w/2, y+h/2, d/2)`, exactly like every other `PolygonCore`
// subclass), then reads `p.vectors[i].x`/`p.vectors[i].y` for `i` in `0..p.vectors.length` to build
// a `face` SVG polygon point-by-point. This means `GridPolygon`'s only real contract, beyond what
// `PolygonCore` itself already provides, is: (1) `vertices` must end up a length-4
// `PolygonVertex[]` array (one per quad corner) so `rotate()` has something to rotate, and (2)
// `vectors` must be initialized to `[]` (not left `undefined`) BEFORE `rotate()` runs, so
// `PolygonCore.rotate()`'s own `Array.isArray(this.vectors)` guard populates it with real `Vector`
// instances `draw3d.js` can then read `.x`/`.y` off of. Both are satisfied below, matching the
// original exactly.
//
// **Constructor logic, ported 1:1 including internal parameter-reassignment style** (kept close to
// the original's own shape rather than renamed to fresh locals, for direct line-by-line
// auditability against `grid.js`):
//   `x = x || 0; y = y || 0;` - falsy (not just `undefined`) coercion to `0`, e.g. a caller passing
//   `NaN`/`""` also gets `0` here, same as the original's untyped JS. `width`/`height` are then
//   REASSIGNED in place to `x + width`/`y + height` (the quad's far corner), exactly mirroring the
//   original's own `width = x + width; height = y + height;` - so after this point `width`/`height`
//   no longer mean "size", they mean "far x/far y", used directly (alongside the original, now-`0`-
//   coerced `x`/`y`) to build each of the three quads' four `Float32Array([X, Y, Z, 1])` homogeneous
//   vertices (`w` always `1`, matching `PolygonVertex`'s documented shape from `core.ts`).
//
// **The three quads, Node/hand-traced against the original's literal vertex lists** (`depth` is the
// caller's raw `depth` parameter, unmodified - NOT the `Math.max(w,h,d)` value `calculate3d()`
// later passes into `rotate()`, a different, later stage):
//   - `"center"`: the z = `depth` face, at the FAR end of the box in z (near `x,y` in x/y):
//     `(x,y,depth) -> (width,y,depth) -> (width,height,depth) -> (x,height,depth)`, a plain
//     rectangle in the XY-plane, pushed out to `z = depth`.
//   - `"horizontal"`: a vertical-in-Z quad spanning `z = 0` to `z = depth` at `y = height` (the far
//     y edge): `(x,height,0) -> (width,height,0) -> (width,height,depth) -> (x,height,depth)`.
//   - `"vertical"`: a vertical-in-Z quad spanning `z = 0` to `z = depth` at `x = width` (the far x
//     edge): `(width,y,0) -> (width,height,0) -> (width,height,depth) -> (width,y,depth)`.
//   `this.vertices = matrix[type]` then picks one of the three by the `type` string.
//
// **A real, preserved quirk**: the original's `type` parameter is a plain, unvalidated JS string -
// passing anything other than exactly `"center"`/`"horizontal"`/`"vertical"` makes
// `matrix[type] === undefined`, so `this.vertices` ends up `undefined` too, which would later throw
// a `TypeError` the moment `PolygonCore.rotate()`/`.min()`/`.max()` try to read `this.vertices[0]`
// (same "crashes if populated wrong" contract `core.ts`'s own header comment already documents for
// every subclass). This port encodes the three valid values as a `GridPolygonType` string-literal
// union instead of a bare `string` - the real, sole caller (`grid/draw3d.js`) never passes anything
// else, so this changes nothing about any REAL code path, but does mean the invalid-string crash is
// no longer reachable through the typed constructor signature itself (only via an explicit `as any`
// cast bypassing TS, which would reproduce the exact same `undefined`-vertices/crash behavior as the
// original). Documented rather than silently narrowing the original's looser runtime contract.
import { PolygonCore, type PolygonVertex } from './core'

/** The three quad faces `GridPolygon` can build - exactly the three keys the original's own
 *  `matrix` object defines, and the only three values `grid/draw3d.js`'s `drawAxisLine()` (this
 *  class's only real caller) ever passes. See this file's header comment for the preserved
 *  invalid-string-crashes-later quirk this union deliberately keeps out of reach of typed callers. */
export type GridPolygonType = 'center' | 'horizontal' | 'vertical'

/**
 * Port of `chart.polygon.grid`'s `GridPolygon` (`extend: "chart.polygon.core"`). Builds one
 * rectangular quad face of a 3D grid box - which of the three faces depends on `type` - as four
 * homogeneous `Float32Array` vertices, ready for `PolygonCore.rotate()` (inherited unchanged).
 */
export class GridPolygon extends PolygonCore {
  constructor(type: GridPolygonType, width: number, height: number, depth: number, x?: number, y?: number) {
    super()

    x = x || 0
    y = y || 0
    width = x + width
    height = y + height

    const matrix: Record<GridPolygonType, PolygonVertex[]> = {
      center: [
        new Float32Array([x, y, depth, 1]),
        new Float32Array([width, y, depth, 1]),
        new Float32Array([width, height, depth, 1]),
        new Float32Array([x, height, depth, 1]),
      ],
      horizontal: [
        new Float32Array([x, height, 0, 1]),
        new Float32Array([width, height, 0, 1]),
        new Float32Array([width, height, depth, 1]),
        new Float32Array([x, height, depth, 1]),
      ],
      vertical: [
        new Float32Array([width, y, 0, 1]),
        new Float32Array([width, height, 0, 1]),
        new Float32Array([width, height, depth, 1]),
        new Float32Array([width, y, depth, 1]),
      ],
    }

    this.vertices = matrix[type]
    this.vectors = []
  }
}
