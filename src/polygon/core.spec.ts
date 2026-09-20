import { describe, expect, it } from 'vitest'
import { PolygonCore } from './core'
import { Vector } from '../base/vector'

// Test oracle: cases 1-4 are reused directly from jui-chart-vue's `usePolygon3d.spec.ts`
// (`rotatePolygonVertices` describe block), which hand-traced/Node-cross-checked this exact
// algorithm using full float64 precision. This port's own `rotate()` reuses the REAL, already-ported
// `Transform`/`matrix3d` (Phase A) - which, per `core.ts`'s header comment, introduces one extra
// layer of float32-precision rounding on the final per-vertex dot-product sum that jui-chart-vue's
// pure-float64 reimplementation doesn't have. A standalone Node re-simulation of the real
// `Transform`+`matrix3d` combination (literal transcription, not assumed) was run against these
// exact inputs before writing the assertions below; values matched to the precision asserted.
describe('PolygonCore', () => {
  it('defaults perspective to 0.9, matching the original constructor', () => {
    const polygon = new PolygonCore()
    expect(polygon.perspective).toBe(0.9)
  })

  describe('rotate()', () => {
    it('identity rotation, vertex at z=0 (near plane): scaleValue(far=depth,0,depth,p,1)=1, vertex UNCHANGED', () => {
      const polygon = new PolygonCore()
      polygon.vertices = [[100, 50, 0, 1]]

      polygon.rotate(200, { x: 0, y: 0, z: 0 }, 100, 100, 50)

      expect(polygon.vertices[0][0]).toBeCloseTo(100, 5)
      expect(polygon.vertices[0][1]).toBeCloseTo(50, 5)
      expect(polygon.vertices[0][2]).toBeCloseTo(0, 5)
    })

    it('identity rotation, vertex at z=depth (far plane): scale shrinks toward perspective (0.9) around (cx,cy,depth/2)', () => {
      // far = |200-200| = 0 -> s = scaleValue(0,0,200,0.9,1) = 0.9
      // scale center = (100,100,100) [depth/2=100]: x=100+(150-100)*0.9=145, y=145, z=100+(200-100)*0.9=190
      const polygon = new PolygonCore()
      polygon.vertices = [[150, 150, 200, 1]]

      polygon.rotate(200, { x: 0, y: 0, z: 0 }, 100, 100, 50)

      expect(polygon.vertices[0][0]).toBeCloseTo(145, 5)
      expect(polygon.vertices[0][1]).toBeCloseTo(145, 5)
      expect(polygon.vertices[0][2]).toBeCloseTo(190, 5)
    })

    it('both above cases hold independently within a SINGLE rotate() call (per-vertex scale factor varies by each vertex\'s own rotated z)', () => {
      const polygon = new PolygonCore()
      polygon.vertices = [
        [100, 50, 0, 1],
        [150, 150, 200, 1],
      ]

      polygon.rotate(200, { x: 0, y: 0, z: 0 }, 100, 100, 50)

      expect(polygon.vertices[0][0]).toBeCloseTo(100, 5)
      expect(polygon.vertices[0][1]).toBeCloseTo(50, 5)
      expect(polygon.vertices[0][2]).toBeCloseTo(0, 5)
      expect(polygon.vertices[1][0]).toBeCloseTo(145, 5)
      expect(polygon.vertices[1][1]).toBeCloseTo(145, 5)
      expect(polygon.vertices[1][2]).toBeCloseTo(190, 5)
    })

    it('hand-traced: rotY(90) around the origin with perspective=1 (no scale distortion) rotates (1,0,0) -> (0,0,-1)', () => {
      const polygon = new PolygonCore()
      polygon.perspective = 1
      polygon.vertices = [[1, 0, 0, 1]]

      polygon.rotate(1000, { x: 0, y: 90, z: 0 }, 0, 0, 0)

      // Node-cross-checked real value: 6.123234262925839e-17 (float32-rounded cos(90 deg)), not
      // exactly 0 - well within float-precision tolerance of the mathematically-exact answer.
      expect(polygon.vertices[0][0]).toBeCloseTo(0, 5)
      expect(polygon.vertices[0][1]).toBeCloseTo(0, 5)
      expect(polygon.vertices[0][2]).toBeCloseTo(-1, 5)
    })

    it('rotating around a non-origin center keeps the center point fixed', () => {
      const polygon = new PolygonCore()
      polygon.perspective = 1
      polygon.vertices = [[50, 60, 0, 1]]

      // depth huge relative to z so the perspective-scale step is a no-op (isolates rotation-only
      // behavior) - matches usePolygon3d.spec.ts's own isolation technique exactly.
      polygon.rotate(100000, { x: 0, y: 45, z: 0 }, 50, 60, 0)

      // Node-cross-checked real value: z lands at 5.960464477539062e-7 (float32-precision residue),
      // not exactly 0 - `toBeCloseTo(0, 5)`'s threshold (5e-6) comfortably covers it.
      expect(polygon.vertices[0][0]).toBeCloseTo(50, 5)
      expect(polygon.vertices[0][1]).toBeCloseTo(60, 5)
      expect(polygon.vertices[0][2]).toBeCloseTo(0, 5)
    })

    it('creates a new Vector per vertex when `vectors` is an array with holes (== null branch)', () => {
      const polygon = new PolygonCore()
      polygon.vertices = [[100, 50, 0, 1]]
      polygon.vectors = []

      polygon.rotate(200, { x: 0, y: 0, z: 0 }, 100, 100, 50)

      expect(polygon.vectors[0]).toBeInstanceOf(Vector)
      expect(polygon.vectors[0].x).toBeCloseTo(100, 5)
      expect(polygon.vectors[0].y).toBeCloseTo(50, 5)
      expect(polygon.vectors[0].z).toBeCloseTo(0, 5)
    })

    it('mutates an existing Vector in place (same reference) rather than replacing it, when `vectors[i]` already exists', () => {
      const polygon = new PolygonCore()
      polygon.vertices = [[100, 50, 0, 1]]
      const existing = new Vector(0, 0, 0)
      polygon.vectors = [existing]

      polygon.rotate(200, { x: 0, y: 0, z: 0 }, 100, 100, 50)

      expect(polygon.vectors[0]).toBe(existing)
      expect(existing.x).toBeCloseTo(100, 5)
      expect(existing.y).toBeCloseTo(50, 5)
      expect(existing.z).toBeCloseTo(0, 5)
    })

    it('leaves `vectors` untouched (stays undefined, no throw) when it is not an array - matches `_.typeCheck("array", ...)` guard', () => {
      const polygon = new PolygonCore()
      polygon.vertices = [[100, 50, 0, 1]]

      expect(() => polygon.rotate(200, { x: 0, y: 0, z: 0 }, 100, 100, 50)).not.toThrow()
      expect(polygon.vectors).toBeUndefined()
    })
  })

  describe('min()', () => {
    it('returns the componentwise minimum across all vertices', () => {
      const polygon = new PolygonCore()
      polygon.vertices = [
        [5, -3, 10, 1],
        [-2, 8, 4, 1],
        [1, 1, -6, 1],
      ]

      expect(polygon.min()).toEqual({ x: -2, y: -3, z: -6 })
    })

    it('single vertex returns its own coordinates', () => {
      const polygon = new PolygonCore()
      polygon.vertices = [[3, 4, 5, 1]]

      expect(polygon.min()).toEqual({ x: 3, y: 4, z: 5 })
    })
  })

  describe('max()', () => {
    it('returns the componentwise maximum across all vertices', () => {
      const polygon = new PolygonCore()
      polygon.vertices = [
        [5, -3, 10, 1],
        [-2, 8, 4, 1],
        [1, 1, -6, 1],
      ]

      expect(polygon.max()).toEqual({ x: 5, y: 8, z: 10 })
    })

    it('single vertex returns its own coordinates', () => {
      const polygon = new PolygonCore()
      polygon.vertices = [[3, 4, 5, 1]]

      expect(polygon.max()).toEqual({ x: 3, y: 4, z: 5 })
    })
  })
})
