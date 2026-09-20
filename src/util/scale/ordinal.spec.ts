import { describe, expect, it } from 'vitest'
import { ordinal } from './ordinal'

// Expected values reused directly from jui-chart-vue's `src/composables/useScale.spec.ts`
// (`createOrdinalScale`), which is a direct 1:1 port of THIS file's `rangePoints()` + `invert()` -
// see ordinal.ts's header comment for the full cross-check writeup and discrepancy finding vs.
// `../scale.ts`'s simpler embedded `ordinal()`.

describe('ordinal scale - rangePoints', () => {
  it('places domain entries evenly spaced, centered within the interval', () => {
    const scale = ordinal().domain(['1Q', '2Q', '3Q', '4Q']).rangePoints([0, 400])
    expect(scale('1Q')).toBe(50)
    expect(scale('2Q')).toBe(150)
    expect(scale('3Q')).toBe(250)
    expect(scale('4Q')).toBe(350)
  })

  it('resolves an integer index to the same pixel position as its domain label', () => {
    const scale = ordinal().domain(['1Q', '2Q', '3Q', '4Q']).rangePoints([0, 400])
    expect(scale(0)).toBe(50)
    expect(scale(2)).toBe(250)
  })

  it('returns null for an unknown label', () => {
    const scale = ordinal().domain(['1Q', '2Q']).rangePoints([0, 400])
    expect(scale('9Q')).toBeNull()
  })

  it('reports rangeBand as the unit spacing', () => {
    const scale = ordinal().domain(['1Q', '2Q', '3Q', '4Q']).rangePoints([0, 400])
    expect(scale.rangeBand()).toBe(100)
  })

  describe('invert (rangePoints mode - the fuller, `_isRangePoints`-aware branch)', () => {
    it('recovers the exact index for a pixel that lands exactly on that index (round-trip via scale())', () => {
      const scale = ordinal().domain(['1Q', '2Q', '3Q', '4Q']).rangePoints([0, 400])
      expect(scale.invert(scale(0) as number)).toBe(0)
      expect(scale.invert(scale(2) as number)).toBe(2)
      expect(scale.invert(scale(3) as number)).toBe(3)
    })

    it('clamps an out-of-range (too-low) pixel to index 0, matching the original\'s clamp-before-floor', () => {
      const scale = ordinal().domain(['1Q', '2Q', '3Q', '4Q']).rangePoints([0, 400])
      expect(scale.invert(-100)).toBe(0)
    })

    it('PRESERVED BUG: NaN for a single-item domain (Math.min(_range[0], _range[1]) with _range[1] undefined)', () => {
      const scale = ordinal().domain(['A']).rangePoints([0, 100])
      expect(scale.invert(50)).toBeNaN()
    })
  })
})

describe('ordinal scale - rangeBands', () => {
  it('places the first domain entry at the interval start, each subsequent one `band` apart', () => {
    const scale = ordinal().domain(['A', 'B', 'C']).rangeBands([0, 200])
    expect(scale('A')).toBe(0)
    expect(scale('B')).toBe(100)
    expect(scale('C')).toBe(200)
    expect(scale.rangeBand()).toBe(100)
  })

  it('invert (non-rangePoints mode) uses the simple ceil-division form, no clamp', () => {
    const scale = ordinal().domain(['A', 'B', 'C']).rangeBands([0, 200])
    // min = Math.min(_range[0], _range[1]) = Math.min(0, 100) = 0
    expect(scale.invert(0)).toBe(0)
    expect(scale.invert(50)).toBe(1) // ceil(50/100)
    expect(scale.invert(100)).toBe(1)
    expect(scale.invert(150)).toBe(2) // ceil(150/100)
  })
})

describe('ordinal scale - FIXME (upstream, preserved): resolving a numeric index never records it into domain', () => {
  it('a numeric-index lookup does not append to domain() even though it resolves via _range', () => {
    const scale = ordinal().domain(['A', 'B']).rangePoints([0, 200])
    expect(scale.domain()).toEqual(['A', 'B'])
    scale(0) // resolves via `_range[0]`, NOT via a domain match
    expect(scale.domain()).toEqual(['A', 'B']) // still unchanged - the FIXME'd line is commented out
  })
})
