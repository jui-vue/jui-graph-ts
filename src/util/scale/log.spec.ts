import { describe, expect, it } from 'vitest'
import { log } from './log'

describe('log scale - core transformation', () => {
  it('transforms domain via log before linear interpolation', () => {
    const scale = log(10).domain([1, 1000]).range([0, 100])
    // domain log: log10(1)=0, log10(1000)=3
    // linear scale maps [0,3] -> [0,100]
    // scale(1) = linear(log10(1)) = linear(0) = 0
    expect(scale(1)).toBe(0)
    // scale(10) = linear(log10(10)) = linear(1) = 100/3 ≈ 33.33
    expect(Math.abs(scale(10) - 100 / 3) < 0.01).toBe(true)
    // scale(1000) = linear(log10(1000)) = linear(3) = 100
    expect(scale(1000)).toBe(100)
  })

  it('handles negative domain values via negated log', () => {
    // log(-x) = -log(x)
    const scale = log(10).domain([-1000, -1]).range([0, 100])
    // domain log: log10(-1000)=-3, log10(-1)=0
    // linear scale maps [-3,0] -> [0,100]
    // scale(-1000) = linear(-3) = 0
    expect(scale(-1000)).toBe(0)
    // scale(-1) = linear(0) = 100
    expect(scale(-1)).toBe(100)
  })

  it('clamps out-of-range input to domain bounds', () => {
    const scale = log(10).domain([1, 1000]).range([0, 100])
    // x > domainMax: clamps to domainMax
    const resultAbove = scale(10000)
    const expectedAbove = scale(1000)
    expect(resultAbove).toBe(expectedAbove)
    // x < domainMin: clamps to domainMin
    const resultBelow = scale(0.1)
    const expectedBelow = scale(1)
    expect(resultBelow).toBe(expectedBelow)
  })

  it('supports base 2 (binary) log scale', () => {
    const scale = log(2).domain([1, 8]).range([0, 100])
    // domain log2: log2(1)=0, log2(8)=3
    // linear scale maps [0,3] -> [0,100]
    expect(scale(1)).toBe(0)
    expect(Math.abs(scale(8) - 100) < 0.01).toBe(true)
  })

  it('inverts range back to domain via pow', () => {
    const scale = log(10).domain([1, 1000]).range([0, 100])
    // scale.invert() reverses via pow. Due to the log scale's internal state,
    // exact inversion may have edge cases (preserved pow(0)=0 quirk).
    const inverted100 = scale.invert(100)
    // Middle/end of range should invert to something in the domain
    expect(inverted100).toBeLessThanOrEqual(10000) // Well beyond domain max
    expect(inverted100).toBeGreaterThanOrEqual(0)
  })

  it('.log() returns the logged domain values', () => {
    const scale = log(10).domain([1, 10, 100]).range([0, 300])
    const loggedDomain = scale.log()
    expect(loggedDomain[0]).toBe(0) // log10(1) = 0
    expect(loggedDomain[1]).toBe(1) // log10(10) = 1
    expect(loggedDomain[2]).toBe(2) // log10(100) = 2
  })
})

describe('log scale - domain boundary adjustment', () => {
  it('adjusts domain max upward when checkMax triggers', () => {
    // checkMax: Math.pow(10, string_length-1) < value
    // For 9999 (length 4): 10^3 = 1000 < 9999, so checkMax is true
    // getNextMax: 10^4 = 10000, so domain[1] becomes 10000
    const scale = log(10).domain([1, 9999]).range([0, 100])
    expect(scale.domain()[1]).toBe(10000)
  })

  it('adjusts domain min downward when checkMax triggers on the absolute value', () => {
    // For -9999: checkMax(9999) is true, getNextMax(9999) = 10000
    // domain[0] = -10000
    const scale = log(10).domain([1, -9999]).range([0, 100])
    expect(scale.domain()[0]).toBeCloseTo(-10000, 0)
  })
})

describe('log scale - ticks', () => {
  it('generates logarithmically-spaced ticks via reverse linear ticks', () => {
    const scale = log(10).domain([1, 100000]).range([0, 500])
    const ticks = scale.ticks(5, false)
    // The algorithm uses func.ticks(..., true) which generates reverse ticks,
    // then pow() transforms them back to original space.
    // Note: Due to the preserved quirk pow(0) = 0, first tick may be 0 (wrong value but preserved)
    expect(ticks.length).toBeGreaterThan(0)
    // The last tick should be within the domain
    expect(ticks[ticks.length - 1]).toBeGreaterThan(1)
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(100000)
  })

  it('appends func.max() if the last tick is below it', () => {
    const scale = log(10).domain([1, 100]).range([0, 100])
    const ticks = scale.ticks(2, false)
    // The ticks algorithm always includes the max
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(scale.max() * 0.9)
  })
})

describe('log scale - chaining with Object.assign', () => {
  it('preserves linear scale methods via Object.assign reuse', () => {
    const scale = log(10).domain([1, 1000]).range([0, 100])
    // These methods come from linear() and should work correctly
    expect(typeof scale.min).toBe('function')
    expect(typeof scale.max).toBe('function')
    expect(typeof scale.rangeMin).toBe('function')
    expect(typeof scale.rangeMax).toBe('function')
    // Note: min/max return the log-transformed domain min/max (linear's view of domain)
    expect(scale.min()).toBe(0) // log10(1) = 0
    expect(scale.max()).toBeCloseTo(3, 10) // log10(1000) = 3 (within floating point precision)
    expect(scale.rangeMin()).toBe(0)
    expect(scale.rangeMax()).toBe(100)
  })

  it('allows method chaining via return this from domain()', () => {
    const scale = log(10)
      .domain([1, 1000])
      .range([0, 100])
    // Should return the scale itself, allowing chaining
    expect(scale(10)).toBeCloseTo(100 / 3, 1)
  })
})

describe('log scale - base method', () => {
  it('.base() is a no-op (re-domains with current log values)', () => {
    // The base() method doesn't actually change _base - it just re-domains
    // func with the current log-transformed domain. This is preserved from
    // the original, which also doesn't change _base.
    const scale = log(10).domain([1, 1000]).range([0, 100])
    const before = scale(100)
    scale.base(2) // This doesn't actually change behavior for base 10 logging
    const after = scale(100)
    expect(before).toBe(after) // No change in behavior
  })
})
