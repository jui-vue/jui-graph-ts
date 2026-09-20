import { describe, expect, it } from 'vitest'
import { GridPolygon } from './grid'
import { PolygonCore } from './core'
import { Vector } from '../base/vector'

// Hand-traced/Node-cross-checked test oracle for `polygon/grid.js` -> `grid.ts`. No existing
// jui-chart-vue reference exists for this file (its 3D charts use a simplified linear/ordinal
// z-axis, not a real ported 3D grid mesh - see `grid.ts`'s header comment), so every expected value
// below is derived directly from a literal hand-transcription of the original's own `matrix` object
// (`x = x || 0; y = y || 0; width = x + width; height = y + height;`, then the three per-type
// 4-vertex `Float32Array([X, Y, Z, 1])` lists), not borrowed from anywhere else.

describe('GridPolygon', () => {
  it('extends PolygonCore', () => {
    const p = new GridPolygon('center', 10, 20, 5, 1, 2)
    expect(p).toBeInstanceOf(PolygonCore)
  })

  it('builds the "center" quad: x=1,y=2,width=10,height=20,depth=5 -> far corner (11,22), all at z=depth', () => {
    const p = new GridPolygon('center', 10, 20, 5, 1, 2)
    expect(Array.from(p.vertices[0])).toEqual([1, 2, 5, 1])
    expect(Array.from(p.vertices[1])).toEqual([11, 2, 5, 1])
    expect(Array.from(p.vertices[2])).toEqual([11, 22, 5, 1])
    expect(Array.from(p.vertices[3])).toEqual([1, 22, 5, 1])
  })

  it('builds the "horizontal" quad: z spans 0..depth at the far y edge (height)', () => {
    const p = new GridPolygon('horizontal', 10, 20, 5, 1, 2)
    expect(Array.from(p.vertices[0])).toEqual([1, 22, 0, 1])
    expect(Array.from(p.vertices[1])).toEqual([11, 22, 0, 1])
    expect(Array.from(p.vertices[2])).toEqual([11, 22, 5, 1])
    expect(Array.from(p.vertices[3])).toEqual([1, 22, 5, 1])
  })

  it('builds the "vertical" quad: z spans 0..depth at the far x edge (width)', () => {
    const p = new GridPolygon('vertical', 10, 20, 5, 1, 2)
    expect(Array.from(p.vertices[0])).toEqual([11, 2, 0, 1])
    expect(Array.from(p.vertices[1])).toEqual([11, 22, 0, 1])
    expect(Array.from(p.vertices[2])).toEqual([11, 22, 5, 1])
    expect(Array.from(p.vertices[3])).toEqual([11, 2, 5, 1])
  })

  it('defaults x/y to 0 when omitted (matching `x = x || 0; y = y || 0`)', () => {
    const p = new GridPolygon('center', 10, 20, 5)
    expect(Array.from(p.vertices[0])).toEqual([0, 0, 5, 1])
    expect(Array.from(p.vertices[2])).toEqual([10, 20, 5, 1])
  })

  it('preserves the falsy-coercion quirk: NaN/0 for x or y both become 0, not just `undefined`', () => {
    const p = new GridPolygon('center', 10, 20, 5, NaN, 0)
    // x = NaN || 0 -> 0 (NaN is falsy in JS); y = 0 || 0 -> 0 (explicit 0 stays 0, same result)
    expect(Array.from(p.vertices[0])).toEqual([0, 0, 5, 1])
    expect(Array.from(p.vertices[2])).toEqual([10, 20, 5, 1])
  })

  it('keeps a genuinely negative x/y (truthy, so NOT coerced to 0)', () => {
    const p = new GridPolygon('center', 10, 20, 5, -3, -4)
    // x = -3 || 0 -> -3 (non-zero numbers are truthy); width = -3 + 10 = 7
    expect(Array.from(p.vertices[0])).toEqual([-3, -4, 5, 1])
    expect(Array.from(p.vertices[2])).toEqual([7, 16, 5, 1])
  })

  it('initializes vectors to an empty array, not undefined (required for PolygonCore.rotate() to populate it)', () => {
    const p = new GridPolygon('center', 10, 20, 5, 1, 2)
    expect(p.vectors).toEqual([])
  })

  it('preserves the unvalidated-type-string quirk: bypassing the typed constructor with an unknown type leaves vertices undefined, crashing min()/max() exactly like the original', () => {
    // Real callers (grid/draw3d.js) only ever pass "center"/"horizontal"/"vertical" - this `as any`
    // simulates what the original's own untyped JS `type` parameter allows, to prove the original's
    // "matrix[type] is undefined for an unrecognized key" behavior is still reachable, not silently
    // patched over by the TS union type.
    const p = new GridPolygon('diagonal' as any, 10, 20, 5, 1, 2)
    expect(p.vertices).toBeUndefined()
    expect(() => p.min()).toThrow(TypeError)
  })

  it('min()/max() (inherited from PolygonCore, unrotated) read the four raw vertices correctly for each quad type', () => {
    const center = new GridPolygon('center', 10, 20, 5, 1, 2)
    expect(center.min()).toEqual({ x: 1, y: 2, z: 5 })
    expect(center.max()).toEqual({ x: 11, y: 22, z: 5 })

    const horizontal = new GridPolygon('horizontal', 10, 20, 5, 1, 2)
    expect(horizontal.min()).toEqual({ x: 1, y: 22, z: 0 })
    expect(horizontal.max()).toEqual({ x: 11, y: 22, z: 5 })

    const vertical = new GridPolygon('vertical', 10, 20, 5, 1, 2)
    expect(vertical.min()).toEqual({ x: 11, y: 2, z: 0 })
    expect(vertical.max()).toEqual({ x: 11, y: 22, z: 5 })
  })

  it('integrates with the inherited PolygonCore.rotate() exactly like grid/draw3d.js\'s drawAxisLine() will use it: identity rotation + perspective=1 (scale factor forced to 1) leaves vectors matching the raw vertices 1:1', () => {
    // Mirrors `base/draw.ts`'s `calculate3d()` calling contract precisely: it sets `p.perspective`
    // then calls `p.rotate(depth, degree, cx, cy, cz)`. `perspective = 1` makes `scaleValue`'s
    // `range = maxScale - minScale = 0`, so stage 2's per-vertex scale factor is exactly 1
    // regardless of `far`/`depth` - isolating stage 1 (rotation) as a pure identity transform when
    // `degree` is all zero and the rotation center is the origin, so the rotated result should equal
    // the original vertices exactly (mirrors core.spec.ts's own "identity rotation" oracle case).
    const p = new GridPolygon('center', 10, 20, 5, 1, 2)
    p.perspective = 1
    p.rotate(100, { x: 0, y: 0, z: 0 }, 0, 0, 0)

    expect(p.vectors).toHaveLength(4)
    const expected = [
      { x: 1, y: 2, z: 5 },
      { x: 11, y: 2, z: 5 },
      { x: 11, y: 22, z: 5 },
      { x: 1, y: 22, z: 5 },
    ]
    for (let i = 0; i < 4; i++) {
      const v = p.vectors![i]
      expect(v).toBeInstanceOf(Vector)
      expect(v.x).toBeCloseTo(expected[i].x, 5)
      expect(v.y).toBeCloseTo(expected[i].y, 5)
      expect(v.z).toBeCloseTo(expected[i].z, 5)
    }
  })
})
