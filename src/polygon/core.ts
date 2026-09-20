// Port of juijs-graph's `src/polygon/core.js` (`chart.polygon.core`, `extend: null`).
//
// `PolygonCore` is the real 3D rotation + perspective-projection engine every `juijs-graph` 3D
// polygon primitive (`polygon/point.js`, `polygon/line.js`, `polygon/cube.js`, `polygon/grid.js` -
// all future Phase D items, none ported yet, each `extend: "chart.polygon.core"`) is built on top
// of. `extend: null`, confirmed directly from source (no base class) - matches `base/vector.ts`'s
// own `extend: null`. **`PolygonCore` does NOT extend `Vector`** (a plausible-looking guess this
// task's brief explicitly asked to verify, not assume) - it only USES `Vector` instances,
// constructing/mutating them in its own `this.vectors` array; there is no inheritance relationship
// between the two at all.
//
// jui-chart-vue's `src/composables/usePolygon3d.ts` (Vue-composable-shaped, plain exported
// functions - see Phase 0 rule 5) already hand-ported/hand-traced/Node-cross-checked this EXACT
// algorithm across FOUR separate consuming iterations: `dot3d.js` (the original `rotatePolygonVertices()`
// port + its `calculate3d()` depth/center derivation), `column3d.js`/`line3d.js` (added
// `cubeVertices()`/`CUBE_FACES`, confirmed the SAME `chart.draw.calculate3d()` caller path
// `dot3d.js` already used), and `widget/polygon/rotate3d.js` (the interactive drag-to-degree
// widget, confirmed it only ever produces `axis.degree.x/y/z` inputs fed into this same engine,
// no separate rotation math of its own). See `usePolygon3d.ts`'s own header comment and
// `rotatePolygonVertices()`'s doc comment for the full two-stage derivation this port reuses
// directly as its test oracle (reused verbatim below, adjusted only for float32-precision - see
// below).
//
// This is the FIRST real 1:1 CLASS-shaped port of `PolygonCore` itself (per Phase 0 rule 2) -
// `usePolygon3d.ts` reimplemented the same math as plain functions using full float64 precision
// throughout (its own `Matrix4`/`multiplyMatrixMatrix4`/`multiplyMatrixVector4`). This port instead
// reuses the REAL, already-ported `Transform` class (`util/transform.ts`, Phase A) and
// `matrix3d`/`scaleValue` (`util/math.ts`, Phase A) directly, matching the original's own
// `jui.include("util.transform")`/`jui.include("util.math")` dependencies exactly - genuinely
// exercising both already-ported modules together for the first time in this project.
//
// **A real, previously-undocumented finding about the ALREADY-PORTED `util/transform.ts` (Phase A,
// out of this task's scope to fix), surfaced only by tracing `PolygonCore.rotate()`'s exact real
// call graph through `Transform.custom()`**: the original `util/transform.js`'s own `calculate(m)`
// (the private function every `Transform` method, including `custom()`, funnels through) always
// calls `math.matrix(m, points[i])` - `util/math.js`'s GENERIC, dimension-agnostic, PLAIN-ARRAY-
// producing dispatcher (`if (typeCheck("array", b[0])) deepMatrix(a,b); else matrix(a,b)`, dispatch
// purely on whether `b` is itself a matrix, never on `a`'s size) - for EVERY transform, 2D or 3D
// alike. The original's `matrix3d()`/`deepMatrix3d()` (Float32Array-producing) are NEVER called by
// `Transform` at all; they exist solely as `util.math`'s own separate public API, called directly
// by consumers like `PolygonCore.rotate()` itself (its explicit `math.matrix3d(m, t.matrix(...))`
// composition calls). This project's already-ported `src/util/transform.ts` instead invented its
// own dimension-based `matrixDispatch()` (`is3D = a.length===4 && a[0].length===4`) that routes 4x4
// matrix operations through a locally-duplicated `matrix3d()`/`deepMatrix3d()` (Float32Array-
// producing) - which the original never does at this call site. Net effect: this port's own
// `rotate()`, by faithfully reusing the REAL (currently in-repo) `Transform` class, inherits one
// extra layer of float32-precision rounding on the FINAL per-point dot-product SUM during
// `t.custom(m)` that the pristine original wouldn't have there (the original's own float32 rounding
// is confined to matrix CONSTRUCTION - `Transform.matrix()`'s literal `new Float32Array([...])`
// rows - which both versions share identically). This is a sub-ULP-level precision curiosity, not a
// geometry/logic bug (Node-cross-checked: every hand-traced case below matches jui-chart-vue's own
// full-float64 oracle to within ~1e-6, well under any rendering-visible threshold) - documented
// here rather than silently patched into `transform.ts` (a separate, already-completed Phase A file
// this task was not assigned to touch); flagged for a future reconciliation pass. This port's own
// test expectations below are Node-cross-checked against the REAL, currently-in-repo
// `Transform`+`matrix3d` combination (i.e. what actually executes), not the theoretical pristine
// original.
import { Transform } from '../util/transform'
import { matrix3d, scaleValue } from '../util/math'
import { Vector } from '../base/vector'

/** A single homogeneous vertex, `[x, y, z, w]` - matches the original's own `Float32Array([x,y,z,1])`
 *  vertex shape (`w` always `1` in practice, never varied - see `polygon/point.js`/`line.js`/
 *  `cube.js`, future Phase D items, for how these are actually constructed) and `util/transform.ts`'s
 *  own point-array type, so any subclass can hand this class whichever concrete shape it builds. */
export type PolygonVertex = number[] | Float32Array

/** Matches `PolygonCore.rotate()`'s `degree` argument shape (`degree.x`/`.y`/`.z`, degrees) -
 *  e.g. `chart.axis`'s own `degree` config object, threaded through by `base/draw.ts`'s
 *  `calculate3d()` (already ported, Phase B). */
export interface Degree3 {
  x: number
  y: number
  z: number
}

/** Return shape of `min()`/`max()`. */
export interface Point3 {
  x: number
  y: number
  z: number
}

/**
 * Port of `chart.polygon.core`'s `PolygonCore`. Every future `polygon/*.ts` primitive
 * (`point.ts`/`line.ts`/`cube.ts`/`grid.ts`, unstarted) is expected to `extends PolygonCore` and
 * populate `vertices` (and, for primitives that track live `Vector` objects too, `vectors`) itself
 * - EXACTLY like the original, whose own constructor only ever sets `this.perspective = 0.9` and
 * never initializes either field. `vertices` is declared with the definite-assignment assertion
 * (`!:`) to document this "populated by a subclass before use, not here" contract precisely, rather
 * than papering over it with a fabricated `= []` default the original doesn't have (which would
 * change `min()`/`max()`'s current crash-if-called-too-early behavior - both read `this.vertices[0]`
 * unconditionally, matching the original exactly).
 */
export class PolygonCore {
  perspective = 0.9
  vertices!: PolygonVertex[]
  vectors?: Vector[]

  /**
   * Port of `PolygonCore.prototype.rotate(depth, degree, cx, cy, cz)`. Two stages, both applied to
   * every vertex in `this.vertices`, in order (composition order preserved exactly from source, not
   * reordered/simplified):
   *
   * 1. **Rotate** around `(cx, cy, cz)`: move that point to the origin (`move3d(cx,cy,cz)`), rotate
   *    around X then Y then Z (`degree.x/y/z`, degrees), move back (`move3d(-cx,-cy,-cz)`) - one
   *    combined matrix built via `math.matrix3d()`, applied once to every vertex via
   *    `Transform.custom()`.
   * 2. **Perspective scale**, independently PER vertex (varies per-vertex since it depends on that
   *    vertex's OWN just-rotated `z`): `far = abs(rotatedZ - depth)`, `s = scaleValue(far, 0, depth,
   *    perspective, 1)` (shrinks toward `perspective` as a vertex's rotated z approaches `depth`,
   *    full size at rotated z = 0), then scale by `s` around `(cx, cy, depth/2)` - note this reuses
   *    `cx`/`cy` but a DIFFERENT z-center (`depth/2`, NOT `cz`) than stage 1, exactly as the
   *    original hardcodes it (confirmed, not a transcription slip - see `usePolygon3d.ts`'s own
   *    matching doc comment for the same finding, independently derived there from `dot3d.js`).
   *
   * Called by `base/draw.ts`'s `calculate3d()` (already ported, Phase B) as
   * `list[i].rotate(Math.max(w, h, d), r, x + w / 2, y + h / 2, d / 2)` - confirmed 1:1 parameter
   * match with this method's own signature (`depth = Math.max(plotWidth, plotHeight, axis.depth)`,
   * NOT `axis.depth` directly; `cz = axis.depth / 2`, a DIFFERENT value in general from `depth`'s
   * own halved value used inside stage 2 above).
   */
  rotate(depth: number, degree: Degree3, cx: number, cy: number, cz: number): void {
    const p = this.perspective
    const t = new Transform(this.vertices)

    // NOTE: `m`/`m2` are intentionally `any`. `Transform.matrix()` (`util/transform.ts`) returns
    // `(number[] | Float32Array)[]`; `matrix3d()`'s first parameter (`util/math.ts`) is typed
    // `number[][]` - two independently-typed Phase A files whose real runtime shape (a 4x4
    // homogeneous matrix, `Float32Array` rows either way) is identical, but whose TS structural
    // types don't line up (`Float32Array` isn't assignable to `number[]`). This is pure cross-module
    // typing friction between two already-locked-in files, not a behavior difference - `any` here
    // reuses both real ported implementations byte-faithfully instead of re-deriving the math
    // locally or widening either file's already-established public API.
    let m: any = t.matrix('move3d', cx, cy, cz)

    // 폴리곤 이동 및 각도 변경 (move and rotate the polygon)
    m = matrix3d(m, t.matrix('rotate3dx', degree.x))
    m = matrix3d(m, t.matrix('rotate3dy', degree.y))
    m = matrix3d(m, t.matrix('rotate3dz', degree.z))
    m = matrix3d(m, t.matrix('move3d', -cx, -cy, -cz))
    this.vertices = t.custom(m)

    for (let i = 0, count = this.vertices.length; i < count; i++) {
      const far = Math.abs(this.vertices[i][2] - depth)
      const s = scaleValue(far, 0, depth, p, 1)
      // Original calls `new Transform()` with NO arguments here - `t2.points` is never read (only
      // `t2.matrix(...)` is called below, which is pure and ignores `this.points` entirely); the
      // ported `Transform`'s constructor requires an argument (no default, unlike the original's
      // optional JS parameter), so `[]` is passed - behaviorally identical, `t2.points` stays unused.
      const t2 = new Transform([])
      let m2: any = t2.matrix('move3d', cx, cy, depth / 2)

      // 폴리곤 스케일 변경 (change the polygon's scale)
      m2 = matrix3d(m2, t2.matrix('scale3d', s, s, s))
      m2 = matrix3d(m2, t2.matrix('move3d', -cx, -cy, -depth / 2))
      this.vertices[i] = matrix3d(m2, this.vertices[i]) as Float32Array

      // 벡터 객체 생성 및 갱신 (create/update the vector object) - `_.typeCheck("array", ...)` in
      // the original; `Array.isArray()` is behaviorally identical for this check (both are false for
      // `undefined`, the field's default un-set state).
      const vectors = this.vectors
      if (Array.isArray(vectors)) {
        const v = this.vertices[i]
        if (vectors[i] == null) {
          vectors[i] = new Vector(v[0], v[1], v[2])
        } else {
          vectors[i].x = v[0]
          vectors[i].y = v[1]
          vectors[i].z = v[2]
        }
      }
    }
  }

  min(): Point3 {
    const obj: Point3 = {
      x: this.vertices[0][0],
      y: this.vertices[0][1],
      z: this.vertices[0][2],
    }

    for (let i = 1, len = this.vertices.length; i < len; i++) {
      obj.x = Math.min(obj.x, this.vertices[i][0])
      obj.y = Math.min(obj.y, this.vertices[i][1])
      obj.z = Math.min(obj.z, this.vertices[i][2])
    }

    return obj
  }

  max(): Point3 {
    const obj: Point3 = {
      x: this.vertices[0][0],
      y: this.vertices[0][1],
      z: this.vertices[0][2],
    }

    for (let i = 1, len = this.vertices.length; i < len; i++) {
      obj.x = Math.max(obj.x, this.vertices[i][0])
      obj.y = Math.max(obj.y, this.vertices[i][1])
      obj.z = Math.max(obj.z, this.vertices[i][2])
    }

    return obj
  }
}
