import { describe, expect, it } from 'vitest'
import { time } from './time'
import * as timeUtil from '../time'

describe('time scale - domain and range', () => {
  it('accepts Date objects and converts to unix timestamps', () => {
    const d1 = new Date('2024-01-01')
    const d2 = new Date('2024-01-02')
    const scale = time().domain([d1, d2]).range([0, 100])
    expect(scale.domain()).toEqual([+d1, +d2])
  })

  it('accepts unix timestamps directly', () => {
    const t1 = 1704067200000 // 2024-01-01
    const t2 = 1704153600000 // 2024-01-02
    const scale = time().domain([t1, t2]).range([0, 100])
    expect(scale.domain()).toEqual([t1, t2])
  })

  it('interpolates within the domain', () => {
    const d1 = new Date('2024-01-01')
    const d2 = new Date('2024-01-02')
    const scale = time().domain([d1, d2]).range([0, 100])
    expect(scale(d1)).toBe(0)
    expect(scale(d2)).toBe(100)
    // Midpoint
    const mid = new Date((+d1 + +d2) / 2)
    expect(Math.abs(scale(mid) - 50) < 1).toBe(true)
  })
})

describe('time scale - min/max', () => {
  it('min/max return the extremes of the domain', () => {
    const d1 = new Date('2024-01-01')
    const d2 = new Date('2024-12-31')
    const scale = time().domain([d1, d2]).range([0, 100])
    expect(scale.min()).toBe(+d1)
    expect(scale.max()).toBe(+d2)
  })

  it('min/max work with reversed domain', () => {
    const d1 = new Date('2024-12-31')
    const d2 = new Date('2024-01-01')
    const scale = time().domain([d1, d2]).range([0, 100])
    expect(scale.min()).toBe(+d2)
    expect(scale.max()).toBe(+d1)
  })
})

describe('time scale - ticks', () => {
  it('generates daily ticks with interval 1', () => {
    const d1 = new Date('2024-01-01')
    const d2 = new Date('2024-01-05')
    const scale = time().domain([d1, d2]).range([0, 400])
    const ticks = scale.ticks(timeUtil.days, 1)
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks[0] instanceof Date).toBe(true)
    // Should span from start to past end
    expect(ticks[0].getTime()).toBeLessThanOrEqual(d1.getTime())
    expect(ticks[ticks.length - 1].getTime()).toBeGreaterThanOrEqual(d2.getTime())
  })

  it('generates hourly ticks', () => {
    const d1 = new Date('2024-01-01T00:00:00')
    const d2 = new Date('2024-01-01T05:00:00')
    const scale = time().domain([d1, d2]).range([0, 500])
    const ticks = scale.ticks(timeUtil.hours, 1)
    expect(ticks.length).toBeGreaterThanOrEqual(5)
    for (let i = 0; i < ticks.length; i++) {
      expect(ticks[i] instanceof Date).toBe(true)
    }
  })

  it('computes rangeBand from first two ticks', () => {
    const d1 = new Date('2024-01-01')
    const d2 = new Date('2024-01-10')
    const scale = time().domain([d1, d2]).range([0, 900])
    scale.ticks(timeUtil.days, 1)
    const band = scale.rangeBand()
    // rangeBand should be the pixel distance between first two ticks
    expect(typeof band).toBe('number')
    expect(band).toBeGreaterThan(0)
  })
})

describe('time scale - realTicks', () => {
  it('generates ticks aligned to calendar boundaries for years', () => {
    const d1 = new Date('2024-06-15')
    const d2 = new Date('2027-06-15')
    const scale = time().domain([d1, d2]).range([0, 300])
    const ticks = scale.realTicks(timeUtil.years, 1)
    // First tick should be Jan 1 of some year
    expect(ticks[0].getMonth()).toBe(0)
    expect(ticks[0].getDate()).toBe(1)
  })

  it('generates ticks aligned to calendar boundaries for months', () => {
    const d1 = new Date('2024-06-15')
    const d2 = new Date('2024-09-15')
    const scale = time().domain([d1, d2]).range([0, 300])
    const ticks = scale.realTicks(timeUtil.months, 1)
    // Each tick should start on day 1
    for (let i = 0; i < ticks.length; i++) {
      expect(ticks[i].getDate()).toBe(1)
    }
  })

  it('generates ticks aligned to calendar boundaries for days', () => {
    const d1 = new Date('2024-01-01T12:00:00')
    const d2 = new Date('2024-01-05T12:00:00')
    const scale = time().domain([d1, d2]).range([0, 400])
    const ticks = scale.realTicks(timeUtil.days, 1)
    // Each tick should start at midnight (00:00:00)
    for (let i = 0; i < ticks.length; i++) {
      expect(ticks[i].getHours()).toBe(0)
      expect(ticks[i].getMinutes()).toBe(0)
      expect(ticks[i].getSeconds()).toBe(0)
    }
  })

  it('generates ticks aligned to calendar boundaries for hours', () => {
    const d1 = new Date('2024-01-01T12:30:00')
    const d2 = new Date('2024-01-01T18:30:00')
    const scale = time().domain([d1, d2]).range([0, 600])
    const ticks = scale.realTicks(timeUtil.hours, 1)
    // Each tick should start on the hour (:00:00)
    for (let i = 0; i < ticks.length; i++) {
      expect(ticks[i].getMinutes()).toBe(0)
      expect(ticks[i].getSeconds()).toBe(0)
    }
  })

  it('generates ticks aligned to calendar boundaries for minutes', () => {
    const d1 = new Date('2024-01-01T12:30:45')
    const d2 = new Date('2024-01-01T12:40:45')
    const scale = time().domain([d1, d2]).range([0, 600])
    const ticks = scale.realTicks(timeUtil.minutes, 1)
    // Each tick should start on the minute (:00)
    for (let i = 0; i < ticks.length; i++) {
      expect(ticks[i].getSeconds()).toBe(0)
    }
  })

  it('generates ticks aligned to calendar boundaries for seconds', () => {
    const d1 = new Date('2024-01-01T12:00:30.500')
    const d2 = new Date('2024-01-01T12:01:30.500')
    const scale = time().domain([d1, d2]).range([0, 600])
    const ticks = scale.realTicks(timeUtil.seconds, 1)
    // Each tick should start on the second (.000 ms)
    for (let i = 0; i < ticks.length; i++) {
      expect(ticks[i].getMilliseconds()).toBe(0)
    }
  })

  it('generates ticks aligned to calendar boundaries for milliseconds', () => {
    const d1 = new Date('2024-01-01T12:00:00.100')
    const d2 = new Date('2024-01-01T12:00:00.900')
    const scale = time().domain([d1, d2]).range([0, 800])
    const ticks = scale.realTicks(timeUtil.milliseconds, 100)
    expect(ticks.length).toBeGreaterThan(0)
    for (let i = 0; i < ticks.length; i++) {
      expect(ticks[i] instanceof Date).toBe(true)
    }
  })

  it('computes rangeBand for realTicks', () => {
    const d1 = new Date('2024-01-01')
    const d2 = new Date('2024-01-10')
    const scale = time().domain([d1, d2]).range([0, 900])
    scale.realTicks(timeUtil.days, 1)
    const band = scale.rangeBand()
    expect(typeof band).toBe('number')
    expect(band).toBeGreaterThan(0)
  })
})

describe('time scale - invert', () => {
  it('inverts pixel coordinates back to Date objects', () => {
    const d1 = new Date('2024-01-01')
    const d2 = new Date('2024-01-02')
    const scale = time().domain([d1, d2]).range([0, 100])
    const inverted = scale.invert(50)
    expect(inverted instanceof Date).toBe(true)
    // Midpoint of the range should invert to midpoint of domain
    const expectedMid = (d1.getTime() + d2.getTime()) / 2
    expect(Math.abs(inverted.getTime() - expectedMid) < 1000).toBe(true) // within 1 sec
  })

  it('invert at range boundaries recovers domain boundaries', () => {
    const d1 = new Date('2024-01-01')
    const d2 = new Date('2024-01-02')
    const scale = time().domain([d1, d2]).range([0, 100])
    expect(Math.abs(scale.invert(0).getTime() - d1.getTime()) < 1000).toBe(true)
    expect(Math.abs(scale.invert(100).getTime() - d2.getTime()) < 1000).toBe(true)
  })
})
