import { describe, expect, it } from 'vitest'
import { PointPolygon } from './point'
import { PolygonCore } from './core'

// Test oracle: construction shape verified directly against the original's own `new
// Float32Array([x, y, d, 1])` literal; `rotate()`/`min()`/`max()` behavior reused from
// `core.spec.ts`'s already Node-cross-checked cases (PointPolygon adds no override, only a 1-vertex
// constructor - so its own rotate/min/max coverage need only confirm inheritance wiring, not
// re-derive the underlying math from scratch).
describe('PointPolygon', () => {
  it('extends PolygonCore', () => {
    const p = new PointPolygon(1, 2, 3)
    expect(p).toBeInstanceOf(PolygonCore)
  })

  it('builds exactly one homogeneous vertex [x, y, d, 1]', () => {
    const p = new PointPolygon(10, 20, 30)
    expect(p.vertices).toHaveLength(1)
    expect(Array.from(p.vertices[0])).toEqual([10, 20, 30, 1])
    expect(p.vertices[0]).toBeInstanceOf(Float32Array)
  })

  it('initializes vectors as an empty array', () => {
    const p = new PointPolygon(0, 0, 0)
    expect(p.vectors).toEqual([])
  })

  it('inherits perspective = 0.9 default from PolygonCore', () => {
    const p = new PointPolygon(0, 0, 0)
    expect(p.perspective).toBe(0.9)
  })

  it('rotate() populates vectors[0] via the inherited PolygonCore pipeline (identity rotation, near plane -> unchanged)', () => {
    // Reuses core.spec.ts's own hand-traced identity-rotation case directly (same inputs).
    const p = new PointPolygon(100, 50, 0)
    p.rotate(200, { x: 0, y: 0, z: 0 }, 100, 100, 50)

    expect(p.vertices[0][0]).toBeCloseTo(100, 5)
    expect(p.vertices[0][1]).toBeCloseTo(50, 5)
    expect(p.vertices[0][2]).toBeCloseTo(0, 5)
    expect(p.vectors![0].x).toBeCloseTo(100, 5)
    expect(p.vectors![0].y).toBeCloseTo(50, 5)
    expect(p.vectors![0].z).toBeCloseTo(0, 5)
  })

  it('min()/max() on a single-vertex polygon both return that vertex\'s own coordinates', () => {
    const p = new PointPolygon(3, 4, 5)
    expect(p.min()).toEqual({ x: 3, y: 4, z: 5 })
    expect(p.max()).toEqual({ x: 3, y: 4, z: 5 })
  })
})
