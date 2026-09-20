import { describe, expect, it } from 'vitest'
import { LinePolygon } from './line'
import { PolygonCore } from './core'

// Test oracle: construction shape verified directly against the original's own two-`Float32Array`
// literal; `rotate()`/`min()`/`max()` behavior reused from `core.spec.ts`'s already Node-cross-
// checked multi-vertex case (`core.spec.ts`'s "both above cases hold independently within a SINGLE
// rotate() call" test uses the exact same two vertices constructed here via `LinePolygon`'s own
// constructor, confirming the inherited pipeline wiring is unchanged for a subclass instance too).
describe('LinePolygon', () => {
  it('extends PolygonCore', () => {
    const l = new LinePolygon(1, 2, 3, 4, 5, 6)
    expect(l).toBeInstanceOf(PolygonCore)
  })

  it('builds exactly two homogeneous vertices [x1,y1,d1,1] and [x2,y2,d2,1]', () => {
    const l = new LinePolygon(10, 20, 30, 40, 50, 60)
    expect(l.vertices).toHaveLength(2)
    expect(Array.from(l.vertices[0])).toEqual([10, 20, 30, 1])
    expect(Array.from(l.vertices[1])).toEqual([40, 50, 60, 1])
    expect(l.vertices[0]).toBeInstanceOf(Float32Array)
    expect(l.vertices[1]).toBeInstanceOf(Float32Array)
  })

  it('initializes vectors as an empty array', () => {
    const l = new LinePolygon(0, 0, 0, 1, 1, 1)
    expect(l.vectors).toEqual([])
  })

  it('rotate(): both endpoints transform independently via the inherited pipeline (reuses core.spec.ts\'s hand-traced identity/far-plane cases)', () => {
    // Reused directly from core.spec.ts's "both above cases hold independently within a SINGLE
    // rotate() call" test - same two vertices, same depth/degree/center, same expected outputs.
    const l = new LinePolygon(100, 50, 0, 150, 150, 200)
    l.rotate(200, { x: 0, y: 0, z: 0 }, 100, 100, 50)

    expect(l.vertices[0][0]).toBeCloseTo(100, 5)
    expect(l.vertices[0][1]).toBeCloseTo(50, 5)
    expect(l.vertices[0][2]).toBeCloseTo(0, 5)
    expect(l.vertices[1][0]).toBeCloseTo(145, 5)
    expect(l.vertices[1][1]).toBeCloseTo(145, 5)
    expect(l.vertices[1][2]).toBeCloseTo(190, 5)
  })

  it('min()/max() span both endpoints componentwise', () => {
    const l = new LinePolygon(5, -3, 10, -2, 8, 4)
    expect(l.min()).toEqual({ x: -2, y: -3, z: 4 })
    expect(l.max()).toEqual({ x: 5, y: 8, z: 10 })
  })
})
