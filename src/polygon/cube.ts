// Port of juijs-graph's `src/polygon/cube.js` (`chart.polygon.cube`, `CubePolygon`).
//
// **`extend` chain, confirmed directly from source**: `extend: "chart.polygon.core"` - `CubePolygon`
// extends `PolygonCore` (`core.ts`, `extend: null`) DIRECTLY, same single-level shape as
// `point.ts`/`line.ts` (not, say, a `LinePolygon`/`PointPolygon` subclass - confirmed false the same
// way, the factory only ever does `jui.use(core)`). Constructor body touches `this.vertices`/
// `this.vectors` (both inherited from `PolygonCore`) plus a genuinely NEW field, `this.faces`, that
// `PolygonCore` itself never declares - the only one of the three point/line/cube primitives to add
// a field beyond what its base class already has.
//
// **Cross-check against jui-chart-vue's `usePolygon3d.ts` - direct, exact match, per this task's own
// instruction**: `usePolygon3d.ts`'s `cubeVertices(x, y, z, w, h, d)` + `CUBE_FACES` were added
// SPECIFICALLY as a port of this exact file, confirmed from jui-chart-vue's own `PORT_STATUS.md`
// (`column3d.js`/`line3d.js` entry, ~line 5893-5900): "`column3d.js`'s `createColumn` builds a `new
// CubePolygon(x, yy, z, w, y-yy, h)` (`chart.polygon.cube`, 8 vertices/6 faces, `extend:
// "chart.polygon.core"` ...) ... `usePolygon3d.ts` needed exactly one addition: `cubeVertices()` +
// `CUBE_FACES` (ported from `chart.polygon.cube` ...)". Both the 8-vertex construction order and the
// 6-face index quadruples below are BYTE-IDENTICAL to `cubeVertices()`/`CUBE_FACES` (own source
// comment there: "in the EXACT order the original builds them (needed for `CUBE_FACES`'s
// vertex-index references to line up)") - this port's own vertex/face literals are transcribed
// directly from the original `cube.js` (which `cubeVertices()`/`CUBE_FACES` were themselves already
// verified against), and re-confirmed against `usePolygon3d.spec.ts`'s own
// `cubeVertices`/`CUBE_FACES` hand-traced test block (`cubeVertices(1,2,3,10,20,30)` ->
// `[[1,2,3],[11,2,3],[11,2,33],[1,2,33],[1,22,3],[11,22,3],[11,22,33],[1,22,33]]`; face `[0,1,5,4]`
// is the cube's z-constant front face) - both reused directly below as this file's own test oracle,
// adjusted only for the `Float32Array` vertex shape and the `d1`-style constructor parameter names
// (`w`/`h`/`d`, matching the original's own signature, not `usePolygon3d.ts`'s `Vertex4`-object
// shape).
import { PolygonCore } from './core'

/**
 * Port of `chart.polygon.cube`'s `CubePolygon(x, y, z, w, h, d)`. Builds a `PolygonCore` with 8
 * homogeneous vertices forming an axis-aligned box from `(x, y, z)` to `(x+w, y+h, z+d)`, in the
 * EXACT construction order the original uses (needed for `this.faces`' vertex-index references to
 * line up - matches `usePolygon3d.ts`'s already-verified `cubeVertices()` order 1:1), plus `this.faces`
 * (6 quad faces as index quadruples into `vertices`, also in the original's own literal order - matches
 * `usePolygon3d.ts`'s `CUBE_FACES` 1:1) and an empty `vectors` array.
 */
export class CubePolygon extends PolygonCore {
  faces: readonly (readonly [number, number, number, number])[]

  constructor(x: number, y: number, z: number, w: number, h: number, d: number) {
    super()
    this.vertices = [
      new Float32Array([x, y, z, 1]),
      new Float32Array([x + w, y, z, 1]),
      new Float32Array([x + w, y, z + d, 1]),
      new Float32Array([x, y, z + d, 1]),

      new Float32Array([x, y + h, z, 1]),
      new Float32Array([x + w, y + h, z, 1]),
      new Float32Array([x + w, y + h, z + d, 1]),
      new Float32Array([x, y + h, z + d, 1]),
    ]

    this.faces = [
      [0, 1, 2, 3],
      [3, 2, 6, 7],
      [0, 3, 7, 4],
      [1, 2, 6, 5],
      [0, 1, 5, 4],
      [4, 5, 6, 7],
    ]

    this.vectors = []
  }
}
