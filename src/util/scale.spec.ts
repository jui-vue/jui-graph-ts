import { describe, expect, it } from 'vitest'
import { circle, linear, log, ordinal, time } from './scale'

// This file exercises `util/scale.js`'s ("util.scale") embedded factories - the module grid code
// actually consumes (see scale.ts's header comment). `linear()`/`ordinal()`'s core interpolation
// behavior is exhaustively covered by `./scale/linear.spec.ts`/`./scale/ordinal.spec.ts` already
// (this file's `linear()` is logically identical, just a separate closure) - the tests here focus
// on what's DIFFERENT about this module: the discrepancy in `ordinal()`'s `invert()`, and the
// `circle()`/`time()`/`log()` factories that only exist here.

describe('linear (embedded duplicate) - sanity check against ./scale/linear.ts', () => {
  it('behaves identically to the standalone module for basic interpolation', () => {
    const scale = linear().domain([0, 10]).range([0, 100])
    expect(scale(5)).toBe(50)
    expect(scale.invert(50)).toBe(5)
    expect(scale.ticks(5, false)).toEqual([0, 2, 4, 6, 8, 10])
  })
})

describe('ordinal (embedded, SIMPLE invert - the discrepancy vs ./scale/ordinal.ts)', () => {
  it('rangePoints() placement is identical to the standalone module', () => {
    const scale = ordinal().domain(['1Q', '2Q', '3Q', '4Q']).rangePoints([0, 400])
    expect(scale('1Q')).toBe(50)
    expect(scale('4Q')).toBe(350)
    expect(scale.rangeBand()).toBe(100)
  })

  it('DISCREPANCY: invert() has NO rangePoints-mode branch - plain Math.ceil(x/_rangeBand), unlike ./scale/ordinal.ts', () => {
    const scale = ordinal().domain(['1Q', '2Q', '3Q', '4Q']).rangePoints([0, 400])
    // The standalone ./scale/ordinal.ts's invert(50) would floor+clamp to index 0 (rangePoints
    // mode). This embedded version instead does Math.ceil(50 / 100) = 1 - genuinely different
    // observable behavior for the exact same rangePoints() setup. See scale.ts's header comment
    // and this project's PORT_STATUS.md for the full discrepancy writeup.
    expect(scale.invert(50)).toBe(1)
  })

  it('FIXME (upstream, preserved): resolving a numeric index MUTATES `_domain`, overwriting that slot (unlike ./scale/ordinal.ts, where this line is commented out)', () => {
    // This embedded version's equivalent of ./scale/ordinal.ts's commented-out FIXME line is NOT
    // commented out here - `_domain[t] = t` actually runs. Node-cross-checked: calling the scale
    // with a numeric index silently overwrites that slot of the domain array with the raw index,
    // clobbering whatever label was there. A second, independent, small divergence between the
    // two "ordinal" implementations, beyond `invert()`.
    const scale = ordinal().domain(['A', 'B']).rangePoints([0, 200])
    expect(scale.domain()).toEqual(['A', 'B'])
    expect(scale(0)).toBe(50)
    expect(scale.domain()).toEqual([0, 'B'])
  })
})

describe('circle', () => {
  it('func(t) is a no-op (never assigned in the original) and returns undefined', () => {
    const scale = circle()
    expect(scale(0.5)).toBeUndefined()
  })

  it('rangePoints() places domain entries evenly spaced, same formula as ordinal', () => {
    const scale = circle().domain([0, 1, 2, 3]).rangePoints([0, 400])
    expect(scale.range()).toEqual([50, 150, 250, 350])
    expect(scale.rangeBand()).toBe(100)
  })

  it('rangeBands() places the first entry at the interval start', () => {
    const scale = circle().domain([0, 1, 2]).rangeBands([0, 200])
    expect(scale.range()).toEqual([0, 100, 200])
  })
})

describe('time', () => {
  it('is a linear scale over +date domain values, with date-aware ticks()', () => {
    const start = new Date(2024, 0, 1)
    const end = new Date(2024, 0, 6) // 5 days later
    const scale = time().domain([start, end]).range([0, 500])

    expect(scale(+start)).toBe(0)
    expect(scale(+end)).toBe(500)

    const ticks = scale.ticks('days', 1)
    expect(ticks).toHaveLength(6)
    expect(+ticks[0]).toBe(+start)
    expect(+ticks[ticks.length - 1]).toBe(+end)
    // Each day should be 100 range-units apart (500 / 5 days).
    expect(scale.rangeBand()).toBe(100)
  })

  it('invert() maps a range position back to a Date', () => {
    const start = new Date(2024, 0, 1)
    const end = new Date(2024, 0, 6)
    const scale = time().domain([start, end]).range([0, 500])

    const inverted = scale.invert(250)
    expect(inverted).toBeInstanceOf(Date)
    expect(+inverted).toBe(+start + (+end - +start) / 2)
  })
})

describe('log', () => {
  it('maps domain 0 to range 0 and domain max to range max', () => {
    const scale = log(10).domain([0, 1000000]).range([0, 300])
    expect(scale(0)).toBe(0)
    expect(scale(1000000)).toBe(300)
  })

  it('ticks() produces powers-of-base-ish steps (Node-cross-checked against the original algorithm)', () => {
    // Node-cross-checked exact values against a literal transcription of the original `log()`/
    // `linear().ticks()` algorithm (see this project's PORT_STATUS.md) - NOT the original's own
    // doc comment example (`log.ticks(4) == [0, 100, 10000, 1000000]`), which does not actually
    // match this algorithm's real output for this domain (a pre-existing inaccurate doc comment
    // in the upstream source, not something this port introduced).
    const scale = log(10).domain([0, 1000000]).range([0, 300])
    const ticks = scale.ticks(4)
    expect(ticks[0]).toBe(0)
    expect(ticks[2]).toBeCloseTo(1000)
    expect(ticks[ticks.length - 1]).toBeCloseTo(1000000)
  })

  it('invert() undoes the log mapping (round-trips through pow(base, ...))', () => {
    const scale = log(10).domain([0, 1000000]).range([0, 300])
    expect(scale.invert(0)).toBe(0)
    expect(scale.invert(300)).toBeCloseTo(1000000)
  })
})
