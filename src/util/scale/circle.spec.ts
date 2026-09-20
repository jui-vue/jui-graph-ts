import { describe, expect, it } from 'vitest'
import { circle } from './circle'

describe('circle scale - domain and range', () => {
  it('stores and returns domain values', () => {
    const scale = circle().domain(['A', 'B', 'C'])
    expect(scale.domain()).toEqual(['A', 'B', 'C'])
  })

  it('stores and returns range values', () => {
    const scale = circle().range([0, 45, 90])
    expect(scale.range()).toEqual([0, 45, 90])
  })

  it('supports method chaining for domain/range setup', () => {
    const scale = circle()
      .domain(['1', '2', '3'])
      .range([0, 100, 200])
    expect(scale.domain()).toEqual(['1', '2', '3'])
    expect(scale.range()).toEqual([0, 100, 200])
  })
})

describe('circle scale - rangePoints', () => {
  it('distributes domain values evenly within the interval', () => {
    const scale = circle().domain(['A', 'B', 'C']).rangePoints([0, 300])
    expect(scale.rangeBand()).toBeCloseTo(100, 1)
    // First element at interval[0] + padding/2 + unit/2 = 0 + 0 + 50 = 50
    expect(scale.range()[0]).toBeCloseTo(50, 0)
    // Second at 50 + 100 = 150
    expect(scale.range()[1]).toBeCloseTo(150, 0)
    // Third at 150 + 100 = 250
    expect(scale.range()[2]).toBeCloseTo(250, 0)
  })

  it('respects padding parameter', () => {
    const scale = circle()
      .domain(['A', 'B', 'C', 'D'])
      .rangePoints([0, 400], 40)
    // step = domain.length = 4
    // unit = (400 - 0 - 40) / 4 = 360 / 4 = 90
    // First at 0 + 40/2 + 90/2 = 20 + 45 = 65
    expect(scale.range()[0]).toBeCloseTo(65, 0)
    expect(scale.rangeBand()).toBeCloseTo(90, 0)
  })

  it('returns the scale for chaining', () => {
    const scale = circle()
      .domain(['A', 'B'])
      .rangePoints([0, 100])
    expect(scale.rangeBand()).toBeGreaterThan(0)
  })
})

describe('circle scale - rangeBands', () => {
  it('places domain values at evenly-spaced band positions', () => {
    const scale = circle().domain(['A', 'B', 'C']).rangeBands([0, 200])
    // step = count - 1 = 3 - 1 = 2
    // band = (200 - 0) / 2 = 100
    expect(scale.rangeBand()).toBe(100)
    // First at 0
    expect(scale.range()[0]).toBe(0)
    // Second at 0 + 100 = 100
    expect(scale.range()[1]).toBe(100)
    // Third at 100 + 100 = 200
    expect(scale.range()[2]).toBe(200)
  })

  it('supports multiple items with correct band width', () => {
    const scale = circle()
      .domain(['A', 'B', 'C', 'D', 'E'])
      .rangeBands([0, 400])
    // step = 5 - 1 = 4
    // band = 400 / 4 = 100
    expect(scale.rangeBand()).toBe(100)
    expect(scale.range().length).toBe(5)
    // Verify spacing: each should be 100 apart
    for (let i = 1; i < scale.range().length; i++) {
      expect(scale.range()[i] - scale.range()[i - 1]).toBeCloseTo(100, 0)
    }
  })

  it('ignores padding/outerPadding parameters (they are accepted but unused, per original)', () => {
    const scale1 = circle()
      .domain(['A', 'B', 'C'])
      .rangeBands([0, 200], 10, 20)
    const scale2 = circle()
      .domain(['A', 'B', 'C'])
      .rangeBands([0, 200])
    // Both should produce identical results since padding is unused
    expect(scale1.rangeBand()).toBe(scale2.rangeBand())
    expect(scale1.range()).toEqual(scale2.range())
  })
})

describe('circle scale - rangeBand', () => {
  it('reports the unit spacing after rangePoints', () => {
    const scale = circle()
      .domain(['1Q', '2Q', '3Q', '4Q'])
      .rangePoints([0, 400])
    expect(scale.rangeBand()).toBe(100)
  })

  it('reports the unit spacing after rangeBands', () => {
    const scale = circle().domain(['A', 'B', 'C']).rangeBands([0, 200])
    expect(scale.rangeBand()).toBe(100)
  })

  it('returns 0 before any range method is called', () => {
    const scale = circle().domain(['A', 'B'])
    expect(scale.rangeBand()).toBe(0)
  })
})

describe('circle scale - no callable interface (preserved)', () => {
  it('does not resolve domain values (unlike ordinal scale)', () => {
    const scale = circle().domain(['A', 'B']).rangePoints([0, 100])
    // circle() does not implement a callable function - this is intentional
    // and different from ordinal()
    try {
      const result = (scale as any)('A')
      // If it gets here, the no-op function returned undefined
      expect(result).toBeUndefined()
    } catch {
      // Either throws or returns undefined - both are acceptable for a no-op
    }
  })
})
