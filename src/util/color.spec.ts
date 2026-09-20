import { describe, expect, it } from 'vitest'
import {
  colorHash,
  darken,
  format,
  HSVtoRGB,
  lighten,
  map,
  parseGradient,
  parseStop,
  regex,
  RGBtoHSV,
  rgb,
  scale,
} from './color'

describe('format', () => {
  it('formats {r,g,b} as an uppercase hex string, zero-padding single-digit channels', () => {
    expect(format({ r: 255, g: 255, b: 255 }, 'hex')).toBe('#FFFFFF')
    expect(format({ r: 1, g: 2, b: 3 }, 'hex')).toBe('#010203')
  })

  it('formats as rgb()/rgba() depending on whether `a` is present', () => {
    expect(format({ r: 1, g: 2, b: 3 }, 'rgb')).toBe('rgb(1,2,3)')
    expect(format({ r: 1, g: 2, b: 3, a: 0.5 }, 'rgb')).toBe('rgba(1,2,3,0.5)')
  })

  it('returns the input object unchanged for an unrecognized type', () => {
    const obj = { r: 1, g: 2, b: 3 }
    expect(format(obj, 'nope')).toBe(obj)
  })
})

describe('rgb (parsing)', () => {
  it('parses rgb(...) strings', () => {
    expect(rgb('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30, a: 1 })
  })

  it('parses rgba(...) strings, with the last channel as a float', () => {
    expect(rgb('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 })
  })

  it('parses 3-digit and 6-digit hex strings', () => {
    expect(rgb('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(rgb('#112233')).toEqual({ r: 17, g: 34, b: 51, a: 1 })
  })

  it('PRESERVED QUIRK: passes an unrecognized string through unchanged (no parsing, no error)', () => {
    expect(rgb('notacolor')).toBe('notacolor')
  })

  it('PRESERVED QUIRK: passes a non-string input through unchanged', () => {
    const obj = { r: 1, g: 2, b: 3 }
    expect(rgb(obj)).toBe(obj)
  })
})

describe('scale', () => {
  it('interpolates the midpoint color between domain endpoints', () => {
    const c = scale().domain('#FF0000', '#00FF00')
    // Hand-traced: parseInt(255 + (0-255)*0.5, 10) = 127 = 0x7F; parseInt(0 + (255-0)*0.5, 10) = 127.
    // NOTE the original doc comment claims 0.5 -> '#808000' - that's wrong, the real (and this
    // port's) value is '#7F7F00' (127 decimal truncates from parseInt, not rounds).
    expect(c(0.5, 'hex')).toBe('#7F7F00')
  })

  it('ticks(n) returns n+1 evenly-spaced hex swatches from domain start to end', () => {
    const c = scale().domain('#FF0000', '#00FF00')
    expect(c.ticks(4)).toEqual(['#FF0000', '#BF3F00', '#7F7F00', '#3FBF00', '#00FF00'])
  })
})

describe('map', () => {
  it('chains scale().ticks() across each consecutive color-stop pair, without duplicating shared stops', () => {
    const colors = map(['#FF0000', '#00FF00', '#0000FF'], 2)
    // 2 segments x ticks(2)=3 colors each, minus 1 shared boundary color de-duplicated per join.
    expect(colors).toHaveLength(5)
    expect(colors[0]).toBe('#FF0000')
    expect(colors[colors.length - 1]).toBe('#0000FF')
  })

  it('exposes named preset palettes as callable shortcuts', () => {
    expect(typeof map.parula).toBe('function')
    expect(map.jet(2).length).toBeGreaterThan(0)
  })
})

describe('HSVtoRGB / RGBtoHSV', () => {
  it('HSVtoRGB: white/red/green primaries', () => {
    expect(HSVtoRGB(0, 0, 1)).toEqual({ r: 255, g: 255, b: 255 })
    expect(HSVtoRGB(0, 1, 1)).toEqual({ r: 255, g: 0, b: 0 })
    expect(HSVtoRGB(120, 1, 1)).toEqual({ r: 0, g: 255, b: 0 })
  })

  it('RGBtoHSV: red/blue/white primaries', () => {
    expect(RGBtoHSV(255, 0, 0)).toEqual({ h: 0, s: 1, v: 1 })
    expect(RGBtoHSV(0, 0, 255)).toEqual({ h: 240, s: 1, v: 1 })
    expect(RGBtoHSV(255, 255, 255)).toEqual({ h: 0, s: 0, v: 1 })
  })
})

describe('lighten / darken', () => {
  it('lighten increases channel values by `rate`, clamped to 255', () => {
    expect(lighten('#808080', 0.5)).toBe('#c0c0c0')
  })

  it('darken is lighten with a negated rate', () => {
    expect(darken('#808080', 0.5)).toBe(lighten('#808080', -0.5))
    expect(darken('#808080', 0.5)).toBe('#404040')
  })
})

describe('colorHash', () => {
  it('hashes a name to a warm-palette rgb object', () => {
    expect(colorHash('abc')).toEqual({ r: 247, g: 32, b: 8 })
  })

  it('falls back to vector=0 for an empty/falsy name', () => {
    expect(colorHash('')).toEqual({ r: 200, g: 230, b: 55 })
  })

  it('feeds the 0-1 hash vector to a callback instead, when given', () => {
    const result = colorHash('abc', (vector) => vector)
    expect(typeof result).toBe('number')
    expect(result as number).toBeGreaterThan(0)
    expect(result as number).toBeLessThanOrEqual(1)
  })
})

describe('parseGradient', () => {
  it('matches the linear(...)/radial(...) regex export', () => {
    expect(regex.test('linear(left) #fff,#000')).toBe(true)
    expect(regex.test('not-a-gradient')).toBe(false)
  })

  it('parses a linear(left) gradient into a descriptor with attr + stops', () => {
    const result = parseGradient('linear(left) #fff,#000')
    expect(result).toMatchObject({
      type: 'linearGradient',
      attr: { x1: 0, y1: 0, x2: 1, y2: 0, direction: 'left' },
    })
    if (typeof result !== 'string') {
      expect(result.children).toHaveLength(2)
      expect(result.children[0].attr['stop-color']).toBe('#fff')
      expect(result.children[1].attr['stop-color']).toBe('#000')
    }
  })

  it('PRESERVED QUIRK: returns the input string unchanged when it does not match the gradient pattern', () => {
    expect(parseGradient('not-a-gradient')).toBe('not-a-gradient')
  })
})

describe('parseStop - PRESERVED BUG: explicit percentage offsets on middle stops are ignored', () => {
  it('assigns top-level offset 0/1 only to the first/last stop, never populating it from attr.offset', () => {
    const stops = parseStop('#fff,#000')
    expect(stops).toEqual([
      { type: 'stop', attr: { 'stop-color': '#fff' }, offset: 0 },
      { type: 'stop', attr: { 'stop-color': '#000' }, offset: 1 },
    ])
  })

  it('a middle stop\'s real "50%" offset (in attr.offset) is never read by the interpolation pass, which never runs for a single middle stop', () => {
    // Hand-traced against a literal transcription of the original algorithm (Node cross-check,
    // see this project's PORT_STATUS.md): the middle stop's `attr.offset` stays "50%" (parsed
    // as-is from the input string) but it never gets a top-level `offset` assigned at all -
    // the interpolation section that would assign one requires finding a SECOND stop with an
    // undefined top-level offset before the scan reaches the last stop, which never happens here.
    const stops = parseStop('#fff,50% yellow,black')
    expect(stops[0]).toEqual({ type: 'stop', attr: { 'stop-color': '#fff' }, offset: 0 })
    expect(stops[1]).toEqual({ type: 'stop', attr: { offset: '50%', 'stop-color': 'yellow' } })
    expect(stops[1].offset).toBeUndefined()
    expect(stops[2]).toEqual({ type: 'stop', attr: { 'stop-color': 'black' }, offset: 1 })
  })

  it('the "interpolate between two undefined-offset stops" branch is ALSO broken for adjacent stops (empty loop range)', () => {
    // Node-cross-checked against a literal transcription of the original: with 4 bare-color
    // stops, `start` lands on index 1 and `end` on index 2 (both undefined top-level offsets).
    // `count = end - start = 1`, and the fill loop is `for (index = start+1; index < end;
    // index++)` i.e. `for (index = 2; index < 2; index++)` - zero iterations. So even the ONE
    // case where this pass finds two candidates to interpolate between silently interpolates
    // nothing: stops[1] and stops[2] are left with NO top-level `offset` at all, only the
    // first/last stops (force-set to 0/1) end up with one.
    const stops = parseStop('red,orange,yellow,green')
    expect(stops[0].offset).toBe(0)
    expect(stops[1].offset).toBeUndefined()
    expect(stops[2].offset).toBeUndefined()
    expect(stops[3].offset).toBe(1)
  })
})
