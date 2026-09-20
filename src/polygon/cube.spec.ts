import { describe, expect, it } from 'vitest'
import { CubePolygon } from './cube'
import { PolygonCore } from './core'

// Test oracle: reused directly from jui-chart-vue's `usePolygon3d.spec.ts` `cubeVertices`/
// `CUBE_FACES` describe block, which hand-traced these exact values against a direct read of this
// same source file (`chart.polygon.cube`) - `cubeVertices(1,2,3,10,20,30)` ->
// `[[1,2,3],[11,2,3],[11,2,33],[1,2,33],[1,22,3],[11,22,3],[11,22,33],[1,22,33]]`, and face
// `[0,1,5,4]` is the cube's z-constant front face. Adjusted only for this port's `Float32Array`
// vertex shape (vs. `usePolygon3d.ts`'s `Vertex4` object shape) and constructor parameter order
// (`x,y,z,w,h,d`, matching the original's own signature 1:1).
describe('CubePolygon', () => {
  it('extends PolygonCore', () => {
    const c = new CubePolygon(0, 0, 0, 1, 1, 1)
    expect(c).toBeInstanceOf(PolygonCore)
  })

  it('builds the 8 vertices in the exact source order (reused from usePolygon3d.spec.ts\'s cubeVertices oracle)', () => {
    const c = new CubePolygon(1, 2, 3, 10, 20, 30)
    const asPlain = c.vertices.map((v) => Array.from(v as Float32Array).slice(0, 3))

    expect(asPlain).toEqual([
      [1, 2, 3],
      [11, 2, 3],
      [11, 2, 33],
      [1, 2, 33],
      [1, 22, 3],
      [11, 22, 3],
      [11, 22, 33],
      [1, 22, 33],
    ])
    // Homogeneous w is always 1, matching every other polygon primitive here.
    expect(c.vertices.every((v) => v[3] === 1)).toBe(true)
  })

  it('builds the 6 quad faces in the exact source order (reused from usePolygon3d.spec.ts\'s CUBE_FACES oracle)', () => {
    const c = new CubePolygon(0, 0, 0, 1, 1, 1)
    expect(c.faces).toEqual([
      [0, 1, 2, 3],
      [3, 2, 6, 7],
      [0, 3, 7, 4],
      [1, 2, 6, 5],
      [0, 1, 5, 4],
      [4, 5, 6, 7],
    ])
  })

  it("face [0,1,5,4] is the cube's z=z0-constant front face (reused from usePolygon3d.spec.ts)", () => {
    const c = new CubePolygon(0, 0, 0, 10, 20, 30)
    const face = c.faces[4].map((i) => c.vertices[i])
    expect(face.every((v) => v[2] === 0)).toBe(true)
  })

  it('initializes vectors as an empty array', () => {
    const c = new CubePolygon(0, 0, 0, 1, 1, 1)
    expect(c.vectors).toEqual([])
  })

  it('min()/max() span the full box across all 8 vertices', () => {
    const c = new CubePolygon(1, 2, 3, 10, 20, 30)
    expect(c.min()).toEqual({ x: 1, y: 2, z: 3 })
    expect(c.max()).toEqual({ x: 11, y: 22, z: 33 })
  })

  it('rotate(): identity rotation, all vertices at z within [z, z+d] near the near plane, scale factor still applies per-vertex (sanity: no throw, vectors populated for all 8)', () => {
    const c = new CubePolygon(0, 0, 0, 10, 10, 10)
    expect(() => c.rotate(200, { x: 0, y: 0, z: 0 }, 5, 5, 5)).not.toThrow()
    expect(c.vertices).toHaveLength(8)
    expect(c.vectors).toHaveLength(8)
    for (const v of c.vectors!) {
      expect(v).toBeDefined()
      expect(Number.isFinite(v.x)).toBe(true)
      expect(Number.isFinite(v.y)).toBe(true)
      expect(Number.isFinite(v.z)).toBe(true)
    }
  })
})
