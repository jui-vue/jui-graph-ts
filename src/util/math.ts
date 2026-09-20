// Port of juijs-graph's `src/util/math.js` ("util.math").
//
// Pure math/geometry utility functions used across scales, axes, and the 3D polygon engine. Kept
// as plain exported functions per PORT_STATUS.md Phase 0 rule 3 - this was a grab-bag utility
// namespace in the original too, never part of an `extend` chain.
//
// Cross-checked against jui-chart-vue's `src/composables/mathUtil.ts` (a hand-port of a subset of
// this exact file, already hand-traced/verified for `nice`/`fixed`/`div`/`radian`/`rotate`/
// `scaleValue` in jui-chart-vue's own Phase F audit - see that project's PORT_STATUS.md). This
// file ports the FULL original, including the matrix helpers and `resize`/`degree`/`angle`/
// `interpolateRound`/`round`/`multi`/`remain` that jui-chart-vue never needed.
//
// Bugs/quirks preserved byte-faithfully (Phase 0 rule 6) - see this project's PORT_STATUS.md for
// the full writeup:
//  1. `nice(min, max, ticks, true)` (the "isNice"/round-to-1-2-5-10 branch) always throws a
//     `ReferenceError` at runtime in the original. `niceNum()`'s inner result variable is
//     assigned via the undeclared identifier `niceFraction` (a typo - a *different*, unused
//     variable `nickFraction` is the one actually declared with `var`). Because the original file
//     is an ES module (`import`/`export`), it runs in strict mode in every distributed form of
//     the library (confirmed: `dist/jui-graph.cjs.js`/`.esm.js`/`.js` all start with
//     `'use strict'`), so assigning to an undeclared identifier throws rather than silently
//     creating a global. This is reachable in practice, not just theoretical dead code: grid/
//     range.js's `nice` grid option is threaded straight into this call as `isNice`, so any
//     consumer that configures `nice: true` on a range grid gets a hard crash. Preserved here by
//     literally throwing the same `ReferenceError` with the same message.
//  2. `fixed(x).div(a, b)` throws a `TypeError` at runtime (`this.getFixed` is not a function).
//     `.div` was written assuming `this` is the top-level `util.math` namespace object (true for
//     the standalone `math.div()`, which also calls `this.getFixed`), but `this` is actually the
//     `fixed()` instance it's attached to, which has no `getFixed` property. `.plus`/`.minus`/
//     `.multi`/`.remain` on a `fixed()` instance all work fine (none of them reference `this`).
//     Dead in practice - grepping the whole engine, only `.plus`/`.minus` are ever called on a
//     `fixed()` instance (by scale.js/linear.js/grid-range.js's tick-stepping loops).
//  3. `inverseMatrix3d()` has two independent bugs, both preserved:
//     a. Two of its cofactor assignments target `te[3][4]` instead of `te[3][3]` (a transcription
//        typo). `te` is a 4-element `Float32Array` per row (valid indices 0-3), so writing index
//        4 is a silent no-op (typed arrays ignore out-of-range writes) and reading it back is
//        `undefined`. Net effect: `te[3][3]` (the bottom-right element of the result) is always
//        left at its default `0`, and the `*= det` pass over `te[3][4]` is also a no-op. The
//        returned "inverse" matrix's `[3][3]` entry is therefore always `0` instead of the
//        expected ~`1` for an affine transform - `inverseMatrix3d` is subtly wrong for every
//        input.
//     b. The singular-matrix fallback (`if (det === 0) { ...identity... }`) can never trigger for
//        an actually-singular matrix: `det` is computed as `1 / sum`, so a singular matrix (whose
//        cofactor-weighted `sum` is `0`) produces `det = Infinity`, not `0`. The check should have
//        been on `sum === 0` *before* taking the reciprocal. As written, a singular matrix falls
//        through to the `else` branch and every element gets multiplied by `Infinity`, producing
//        `Infinity`/`NaN` entries instead of the intended identity-matrix fallback.

export interface Point2D {
  x: number
  y: number
}

/** Rotates point (x, y) by `radian` around the origin. */
export function rotate(x: number, y: number, radian: number): Point2D {
  return {
    x: x * Math.cos(radian) - y * Math.sin(radian),
    y: x * Math.sin(radian) + y * Math.cos(radian),
  }
}

export interface ResizedBox {
  width: number
  height: number
}

/** Scales (objectWidth, objectHeight) down/up to fit within (maxWidth, maxHeight), keeping ratio. */
export function resize(maxWidth: number, maxHeight: number, objectWidth: number, objectHeight: number): ResizedBox {
  const ratio = objectHeight / objectWidth

  if (objectWidth >= maxWidth && ratio <= 1) {
    objectWidth = maxWidth
    objectHeight = maxHeight * ratio
  } else if (objectHeight >= maxHeight) {
    objectHeight = maxHeight
    objectWidth = maxWidth / ratio
  }

  return { width: objectWidth, height: objectHeight }
}

/** Converts degrees to radians. */
export function radian(degree: number): number {
  return (degree * Math.PI) / 180
}

/** Converts radians to degrees. */
export function degree(radianValue: number): number {
  return (radianValue * 180) / Math.PI
}

/** Angle (radians) of the vector from (x1,y1) to (x2,y2), via `Math.atan2`. */
export function angle(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.atan2(dy, dx)
}

/** Builds a linear-interpolation callback between `a` and `b` (t in [0,1], unrounded). */
export function interpolateNumber(a: number, b: number): (t: number) => number {
  const dist = b - a
  return (t: number) => a + dist * t
}

/** Same as `interpolateNumber`, rounded to the nearest integer. */
export function interpolateRound(a: number, b: number): (t: number) => number {
  const dist = b - a
  return (t: number) => Math.round(a + dist * t)
}

/** Number of decimal places needed to represent `a` or `b` exactly, whichever needs more. */
export function getFixed(a: number | string, b: number | string): number {
  const aArr = `${a}`.split('.')
  const aLen = aArr.length < 2 ? 0 : aArr[1].length

  const bArr = `${b}`.split('.')
  const bLen = bArr.length < 2 ? 0 : bArr[1].length

  return aLen > bLen ? aLen : bLen
}

export interface FixedMath {
  (value: number): number
  plus(a: number, b: number): number
  minus(a: number, b: number): number
  multi(a: number, b: number): number
  /**
   * Preserved-broken: throws a `TypeError` at runtime. See this file's header comment (quirk 2).
   * Never called anywhere in the original engine.
   */
  div(a: number, b: number): number
  remain(a: number, b: number): number
}

/** Returns decimal-precision-safe arithmetic helpers, fixed to `fixedValue`'s own decimal precision. */
export function fixed(fixedValue: number): FixedMath {
  const fixedNumber = getFixed(fixedValue, 0)
  const pow = Math.pow(10, fixedNumber)

  const func = ((value: number) => Math.round(value * pow) / pow) as FixedMath

  func.plus = (a, b) => Math.round(a * pow + b * pow) / pow
  func.minus = (a, b) => Math.round(a * pow - b * pow) / pow
  func.multi = (a, b) => Math.round(a * pow * (b * pow)) / (pow * pow)

  func.div = function (this: FixedMath, a: number, b: number): number {
    const result = (a * pow) / (b * pow)
    // Preserved bug (quirk 2 above): `this` is `func` here, which has no `getFixed` - throws.
    const thisAsNamespace = this as unknown as { getFixed(a: number, b: number): number }
    const pow2 = Math.pow(10, thisAsNamespace.getFixed(result, 0))
    return Math.round(result * pow2) / pow2
  }

  func.remain = (a, b) => Math.round((a * pow) % (b * pow)) / pow

  return func
}

/** Rounds `num` to `fixedPlaces` decimal places. */
export function round(num: number, fixedPlaces: number): number {
  const fixedNumber = Math.pow(10, fixedPlaces)
  return Math.round(num * fixedNumber) / fixedNumber
}

export function plus(a: number, b: number): number {
  const pow = Math.pow(10, getFixed(a, b))
  return Math.round(a * pow + b * pow) / pow
}

export function minus(a: number, b: number): number {
  const pow = Math.pow(10, getFixed(a, b))
  return Math.round(a * pow - b * pow) / pow
}

export function multi(a: number, b: number): number {
  const pow = Math.pow(10, getFixed(a, b))
  return Math.round(a * pow * (b * pow)) / (pow * pow)
}

/** Decimal-safe division: `a / b`, re-rounded to the decimal precision of the raw result. */
export function div(a: number, b: number): number {
  const pow = Math.pow(10, getFixed(a, b))
  const result = (a * pow) / (b * pow)
  const pow2 = Math.pow(10, getFixed(result, 0))
  return Math.round(result * pow2) / pow2
}

export function remain(a: number, b: number): number {
  const pow = Math.pow(10, getFixed(a, b))
  return Math.round((a * pow) % (b * pow)) / pow
}

export interface NiceResult {
  min: number
  max: number
  range: number
  spacing: number
}

function niceNum(_range: number, _round: boolean): number {
  // Preserved bug (quirk 1 above): always throws. `_range`/`_round` intentionally unused - the
  // original never reaches its own body logic either.
  throw new ReferenceError('niceFraction is not defined')
}

/**
 * Computes a "nice" tick range/spacing for [min, max] split into roughly `ticks` steps.
 * `isNice: true` rounds the spacing to a 1/2/5/10 * 10^n step instead of dividing evenly - but
 * see quirk 1 above: that branch always throws in the original, preserved here.
 */
export function nice(min: number, max: number, ticks: number, isNice = false): NiceResult {
  const _min = min > max ? max : min
  const _max = min > max ? min : max

  const range = isNice ? niceNum(_max - _min, false) : _max - _min
  const spacing = isNice ? niceNum(range / ticks, true) : range / ticks
  const niceMin = isNice ? Math.floor(_min / spacing) * spacing : _min
  const niceMax = isNice ? Math.floor(_max / spacing) * spacing : _max

  return { min: niceMin, max: niceMax, range, spacing }
}

function matrixVector(a: number[][], b: number[]): number[] {
  const m: number[] = []

  for (let i = 0; i < a.length; i++) {
    let sum = 0
    for (let j = 0; j < a[i].length; j++) {
      sum += a[i][j] * b[j]
    }
    m.push(sum)
  }

  return m
}

function deepMatrix(a: number[][], b: number[][]): number[][] {
  const m: number[][] = []
  const nm: number[][] = []

  for (let i = 0; i < b.length; i++) {
    m[i] = []
    nm[i] = []
  }

  for (let i = 0; i < b.length; i++) {
    for (let j = 0; j < b[i].length; j++) {
      m[j].push(b[i][j])
    }
  }

  for (let i = 0; i < m.length; i++) {
    const mm = matrixVector(a, m[i])
    for (let j = 0; j < mm.length; j++) {
      nm[j].push(mm[j])
    }
  }

  return nm
}

/**
 * 2x1/3x1/NxN-style matrix-vector product. `b` may be a flat vector (`number[]`) or a "vector of
 * vectors" (`number[][]`, dispatched to the deep/`NxN` variant) - matching the original's
 * `_.typeCheck("array", b[0])` dispatch, ported here as `Array.isArray(b[0])`.
 */
export function matrix(a: number[][], b: number[] | number[][]): number[] | number[][] {
  if (Array.isArray(b[0])) {
    return deepMatrix(a, b as number[][])
  }

  return matrixVector(a, b as number[])
}

type Vec4 = number[] | Float32Array
type Mat4 = [Float32Array, Float32Array, Float32Array, Float32Array]

function matrix3dVector(a: number[][], b: Vec4): Float32Array {
  const m = new Float32Array(4)

  m[0] = a[0][0] * b[0] + a[0][1] * b[1] + a[0][2] * b[2] + a[0][3] * b[3]
  m[1] = a[1][0] * b[0] + a[1][1] * b[1] + a[1][2] * b[2] + a[1][3] * b[3]
  m[2] = a[2][0] * b[0] + a[2][1] * b[1] + a[2][2] * b[2] + a[2][3] * b[3]
  m[3] = a[3][0] * b[0] + a[3][1] * b[1] + a[3][2] * b[2] + a[3][3] * b[3]

  return m
}

function deepMatrix3d(a: number[][], b: Vec4[]): Mat4 {
  const nm: Mat4 = [new Float32Array(4), new Float32Array(4), new Float32Array(4), new Float32Array(4)]

  const m: Mat4 = [
    new Float32Array([b[0][0], b[1][0], b[2][0], b[3][0]]),
    new Float32Array([b[0][1], b[1][1], b[2][1], b[3][1]]),
    new Float32Array([b[0][2], b[1][2], b[2][2], b[3][2]]),
    new Float32Array([b[0][3], b[1][3], b[2][3], b[3][3]]),
  ]

  nm[0][0] = a[0][0] * m[0][0] + a[0][1] * m[0][1] + a[0][2] * m[0][2] + a[0][3] * m[0][3]
  nm[1][0] = a[1][0] * m[0][0] + a[1][1] * m[0][1] + a[1][2] * m[0][2] + a[1][3] * m[0][3]
  nm[2][0] = a[2][0] * m[0][0] + a[2][1] * m[0][1] + a[2][2] * m[0][2] + a[2][3] * m[0][3]
  nm[3][0] = a[3][0] * m[0][0] + a[3][1] * m[0][1] + a[3][2] * m[0][2] + a[3][3] * m[0][3]

  nm[0][1] = a[0][0] * m[1][0] + a[0][1] * m[1][1] + a[0][2] * m[1][2] + a[0][3] * m[1][3]
  nm[1][1] = a[1][0] * m[1][0] + a[1][1] * m[1][1] + a[1][2] * m[1][2] + a[1][3] * m[1][3]
  nm[2][1] = a[2][0] * m[1][0] + a[2][1] * m[1][1] + a[2][2] * m[1][2] + a[2][3] * m[1][3]
  nm[3][1] = a[3][0] * m[1][0] + a[3][1] * m[1][1] + a[3][2] * m[1][2] + a[3][3] * m[1][3]

  nm[0][2] = a[0][0] * m[2][0] + a[0][1] * m[2][1] + a[0][2] * m[2][2] + a[0][3] * m[2][3]
  nm[1][2] = a[1][0] * m[2][0] + a[1][1] * m[2][1] + a[1][2] * m[2][2] + a[1][3] * m[2][3]
  nm[2][2] = a[2][0] * m[2][0] + a[2][1] * m[2][1] + a[2][2] * m[2][2] + a[2][3] * m[2][3]
  nm[3][2] = a[3][0] * m[2][0] + a[3][1] * m[2][1] + a[3][2] * m[2][2] + a[3][3] * m[2][3]

  nm[0][3] = a[0][0] * m[3][0] + a[0][1] * m[3][1] + a[0][2] * m[3][2] + a[0][3] * m[3][3]
  nm[1][3] = a[1][0] * m[3][0] + a[1][1] * m[3][1] + a[1][2] * m[3][2] + a[1][3] * m[3][3]
  nm[2][3] = a[2][0] * m[3][0] + a[2][1] * m[3][1] + a[2][2] * m[3][2] + a[2][3] * m[3][3]
  nm[3][3] = a[3][0] * m[3][0] + a[3][1] * m[3][1] + a[3][2] * m[3][2] + a[3][3] * m[3][3]

  return nm
}

/**
 * 4x4-style matrix product for homogeneous-coordinate 3D transforms. `b` may be a single
 * 4-vector (`number[] | Float32Array`) or an array of four such vectors (dispatched to the deep
 * `4x4` variant) - matching the original's `b[0] instanceof Array || b[0] instanceof Float32Array`
 * dispatch.
 */
export function matrix3d(a: number[][], b: Vec4 | Vec4[]): Float32Array | Mat4 {
  if (Array.isArray(b[0]) || b[0] instanceof Float32Array) {
    return deepMatrix3d(a, b as Vec4[])
  }

  return matrix3dVector(a, b as Vec4)
}

/**
 * Inverts a 4x4 matrix (adjugate/determinant method). See this file's header comment (quirk 3)
 * for two preserved bugs: the `[3][3]` entry is always left at `0`, and the singular-matrix
 * identity fallback can never actually trigger.
 */
export function inverseMatrix3d(me: Vec4[]): Mat4 {
  let te: Mat4 = [new Float32Array(4), new Float32Array(4), new Float32Array(4), new Float32Array(4)]

  const n11 = me[0][0]
  const n12 = me[0][1]
  const n13 = me[0][2]
  const n14 = me[0][3]
  const n21 = me[1][0]
  const n22 = me[1][1]
  const n23 = me[1][2]
  const n24 = me[1][3]
  const n31 = me[2][0]
  const n32 = me[2][1]
  const n33 = me[2][2]
  const n34 = me[2][3]
  const n41 = me[3][0]
  const n42 = me[3][1]
  const n43 = me[3][2]
  const n44 = me[3][3]

  te[0][0] = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44
  te[0][1] = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44
  te[0][2] = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44
  te[0][3] = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34
  te[1][0] = n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44
  te[1][1] = n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44
  te[1][2] = n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44
  te[1][3] = n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34
  te[2][0] = n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44
  te[2][1] = n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44
  te[2][2] = n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44
  te[2][3] = n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34
  te[3][0] = n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43
  te[3][1] = n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43
  te[3][2] = n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43
  // Preserved bug (quirk 3a above): should be `te[3][3]` - out-of-range write, silently dropped.
  te[3][4] = n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33

  // Preserved bug (quirk 3b above): should check the pre-reciprocal sum for zero.
  const det = 1 / (n11 * te[0][0] + n21 * te[0][1] + n31 * te[0][2] + n41 * te[0][3])

  if (det === 0) {
    te = [
      new Float32Array([1, 0, 0, 0]),
      new Float32Array([0, 1, 0, 0]),
      new Float32Array([0, 0, 1, 0]),
      new Float32Array([0, 0, 0, 1]),
    ]
  } else {
    te[0][0] *= det
    te[0][1] *= det
    te[0][2] *= det
    te[0][3] *= det
    te[1][0] *= det
    te[1][1] *= det
    te[1][2] *= det
    te[1][3] *= det
    te[2][0] *= det
    te[2][1] *= det
    te[2][2] *= det
    te[2][3] *= det
    te[3][0] *= det
    te[3][1] *= det
    te[3][2] *= det
    // Preserved bug (quirk 3a above): should be `te[3][3]` - reads back `undefined` (NaN * det),
    // then the write to index 4 is silently dropped.
    te[3][4] *= det
  }

  return te
}

/**
 * Linear interpolation of `value` from `[minValue, maxValue]` into `[minScale, maxScale]` (no
 * clamping - values outside `[minValue, maxValue]` extrapolate, matching the original).
 * `minValue === maxValue` is special-cased to `0` (matching the original's
 * `minValue = (minValue == maxValue) ? 0 : minValue` guard, avoiding a `0/0` divide - not
 * obviously "correct" in general, just preserved).
 */
export function scaleValue(value: number, minValue: number, maxValue: number, minScale: number, maxScale: number): number {
  const _minValue = minValue === maxValue ? 0 : minValue
  const range = maxScale - minScale
  const per = (value - _minValue) / (maxValue - _minValue)
  return range * per + minScale
}
