// Port of juijs-graph's `src/util/color.js` ("util.color").
//
// Color-parsing/formatting/gradient/scale utilities. Plain exported functions per PORT_STATUS.md
// Phase 0 rule 3 - this was a grab-bag utility namespace in the original too.
//
// jui-chart-vue's `useColorScale.ts` only AUDITED this file (Phase F: confirmed none of its own
// color-interpolation functions vendor from it, and confirmed `util.color.js`'s own `scale`/
// `map`/`HSVtoRGB`/`RGBtoHSV`/`colorHash` are never called anywhere in the juijs-graph engine
// itself - only `ColorUtil.parse`, for gradient-string parsing in `base/builder.js`, is actually
// used internally). This is therefore the first real 1:1 port of the whole file.
//
// Quirks/bugs preserved byte-faithfully:
//  - `rgb()` returns its input completely unchanged when given a non-string, AND when given a
//    string that doesn't match any of the `rgb(`/`rgba(`/`#`-prefixed branches (e.g. a bare CSS
//    color name like `"red"`) - not parsed, not an error, just passed through. Typed loosely here
//    (`RgbColor | string`) to reflect that.
//  - `parseGradient()` similarly returns its input unchanged (a bare string, not a gradient
//    descriptor object) when the `linear(...)`/`radial(...)` regex doesn't match.
//  - `scale().ticks(n)` walks `t` from 0 to 1 in `1/n` steps using `math.plus` (decimal-safe
//    addition) specifically to dodge floating-point drift in the loop's `<= 1` termination check -
//    preserved by importing this project's own `plus()` from `./math.ts`.
//  - `colorHash`'s `generateHash` only looks at the first 6 characters of the name (`max_char = 6`
//    - note the loop's `i > max_char` check means it actually reads indices 0-6, i.e. 7
//    characters, an off-by-one against the "6 characters" doc comment - preserved as-is).

import { plus } from './math'

export interface RgbColor {
  r: number
  g: number
  b: number
  a?: number
}

export interface HsvColor {
  h: number
  s: number
  v: number
}

function generateHash(name: string): number {
  // Return a vector (0.0->1.0) that is a hash of the input string.
  // The hash is computed to favor early characters over later ones, so
  // that strings with similar starts have similar vectors. Only the first
  // 6 characters are considered.
  let hash = 0
  let weight = 1
  let maxHash = 0
  const mod = 10
  const maxChar = 6

  if (name) {
    for (let i = 0; i < name.length; i++) {
      if (i > maxChar) {
        break
      }
      hash += weight * (name.charCodeAt(i) % mod)
      maxHash += weight * (mod - 1)
      weight *= 0.7
    }
    if (maxHash > 0) {
      hash = hash / maxHash
    }
  }

  return hash
}

/** Matches a `linear(...)`/`radial(...)` gradient descriptor string. */
export const regex = /(linear|radial)\((.*)\)(.*)/i

/**
 * Converts an `{r,g,b[,a]}` object to a CSS color string.
 *
 *     format({ r: 255, g: 255, b: 255 }, 'hex')  // '#FFFFFF'
 *     format({ r: 255, g: 255, b: 255, a: 0.5 }, 'rgb')  // 'rgba(255,255,255,0.5)'
 *
 * Returns `obj` unchanged for any other `type` (matching the original).
 */
export function format(obj: RgbColor, type?: string): string | RgbColor {
  if (type == 'hex') {
    let r = obj.r.toString(16)
    if (obj.r < 16) r = '0' + r

    let g = obj.g.toString(16)
    if (obj.g < 16) g = '0' + g

    let b = obj.b.toString(16)
    if (obj.b < 16) b = '0' + b

    return '#' + [r, g, b].join('').toUpperCase()
  } else if (type == 'rgb') {
    if (typeof obj.a == 'undefined') {
      return 'rgb(' + [obj.r, obj.g, obj.b].join(',') + ')'
    } else {
      return 'rgba(' + [obj.r, obj.g, obj.b, obj.a].join(',') + ')'
    }
  }

  return obj
}

export function trim(str: string): string {
  return (str || '').replace(/^\s+|\s+$/g, '')
}

/**
 * Parses a color string to an `{r,g,b,a}` object. Passes non-string input through unchanged, and
 * also passes an unrecognized string (no `rgb(`/`rgba(`/`#` prefix) through unchanged - see this
 * file's header comment.
 */
export function rgb(str: string | RgbColor): RgbColor | string {
  if (typeof str == 'string') {
    if (str.indexOf('rgb(') > -1) {
      const parts = str.replace('rgb(', '').replace(')', '').split(',')
      const arr = parts.map((v) => parseInt(trim(v), 10))

      return { r: arr[0], g: arr[1], b: arr[2], a: 1 }
    } else if (str.indexOf('rgba(') > -1) {
      const parts = str.replace('rgba(', '').replace(')', '').split(',')
      const arr = parts.map((v, i) => (i === parts.length - 1 ? parseFloat(trim(v)) : parseInt(trim(v), 10)))

      return { r: arr[0], g: arr[1], b: arr[2], a: arr[3] }
    } else if (str.indexOf('#') == 0) {
      const hex = str.replace('#', '')
      const arr: number[] = []

      if (hex.length == 3) {
        for (let i = 0; i < hex.length; i++) {
          const char = hex.substr(i, 1)
          arr.push(parseInt(char + char, 16))
        }
      } else {
        for (let i = 0; i < hex.length; i += 2) {
          arr.push(parseInt(hex.substr(i, 2), 16))
        }
      }

      return { r: arr[0], g: arr[1], b: arr[2], a: 1 }
    }
  }

  return str
}

export interface ColorScale {
  (t: number, type?: string): string | RgbColor
  domain(start: string | RgbColor, end: string | RgbColor): ColorScale
  ticks(n: number): string[]
}

/**
 * Builds a color-interpolation scale.
 *
 *     const c = scale().domain('#FF0000', '#00FF00')
 *     c(0.5)        // middle color, e.g. '#808000' when a `type` of 'hex' is given
 *     c.ticks(20)    // middle color LIST: [startColor, ..., endColor], as hex strings
 */
export function scale(): ColorScale {
  let startColor: RgbColor
  let endColor: RgbColor

  const func = ((t: number, type?: string): string | RgbColor => {
    const obj: RgbColor = {
      r: parseInt(String(startColor.r + (endColor.r - startColor.r) * t), 10),
      g: parseInt(String(startColor.g + (endColor.g - startColor.g) * t), 10),
      b: parseInt(String(startColor.b + (endColor.b - startColor.b) * t), 10),
    }

    return format(obj, type)
  }) as ColorScale

  func.domain = (start, end) => {
    startColor = rgb(start) as RgbColor
    endColor = rgb(end) as RgbColor

    return func
  }

  func.ticks = (n: number): string[] => {
    const unit = 1 / n

    let start = 0
    const colors: string[] = []
    while (start <= 1) {
      const c = func(start, 'hex') as string
      colors.push(c)
      start = plus(start, unit)
    }

    return colors
  }

  return func
}

export interface ColorMap {
  (colorList: (string | RgbColor)[], count?: number): string[]
  parula(count?: number): string[]
  jet(count?: number): string[]
  hsv(count?: number): string[]
  hot(count?: number): string[]
  pink(count?: number): string[]
  bone(count?: number): string[]
  copper(count?: number): string[]
}

/**
 * Builds a color map by chaining `scale().ticks()` across each consecutive pair of
 * `colorList` stops.
 *
 *     const colors = map(['#352a87', '#0f5cdd', '#00b5a6', '#ffc337', '#fdff00'], count)
 */
export const map = ((colorList: (string | RgbColor)[], count?: number): string[] => {
  let colors: string[] = []
  count = count || 5
  const s = scale()

  for (let i = 0, len = colorList.length - 1; i < len; i++) {
    if (i == 0) {
      colors = s.domain(colorList[i], colorList[i + 1]).ticks(count)
    } else {
      const colors2 = s.domain(colorList[i], colorList[i + 1]).ticks(count)
      colors2.shift()
      colors = colors.concat(colors2)
    }
  }

  return colors
}) as ColorMap

map.parula = (count) => map(['#352a87', '#0f5cdd', '#00b5a6', '#ffc337', '#fdff00'], count)
map.jet = (count) => map(['#00008f', '#0020ff', '#00ffff', '#51ff77', '#fdff00', '#ff0000', '#800000'], count)
map.hsv = (count) => map(['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'], count)
map.hot = (count) => map(['#0b0000', '#ff0000', '#ffff00', '#ffffff'], count)
map.pink = (count) => map(['#1e0000', '#bd7b7b', '#e7e5b2', '#ffffff'], count)
map.bone = (count) => map(['#000000', '#4a4a68', '#a6c6c6', '#ffffff'], count)
map.copper = (count) => map(['#000000', '#3d2618', '#9d623e', '#ffa167', '#ffc77f'], count)

/**
 * Converts HSV (H: 0-360, S/V: 0-1) to RGB (0-255 channels, `Math.ceil`-rounded).
 *
 *     HSVtoRGB(0, 0, 1)  // { r: 255, g: 255, b: 255 }
 */
export function HSVtoRGB(H: number, S: number, V: number): RgbColor {
  if (H == 360) {
    H = 0
  }

  const C = S * V
  const X = C * (1 - Math.abs(((H / 60) % 2) - 1))
  const m = V - C

  let temp: number[] = []

  if (0 <= H && H < 60) {
    temp = [C, X, 0]
  } else if (60 <= H && H < 120) {
    temp = [X, C, 0]
  } else if (120 <= H && H < 180) {
    temp = [0, C, X]
  } else if (180 <= H && H < 240) {
    temp = [0, X, C]
  } else if (240 <= H && H < 300) {
    temp = [X, 0, C]
  } else if (300 <= H && H < 360) {
    temp = [C, 0, X]
  }

  return {
    r: Math.ceil((temp[0] + m) * 255),
    g: Math.ceil((temp[1] + m) * 255),
    b: Math.ceil((temp[2] + m) * 255),
  }
}

/** Converts RGB (0-255 channels) to HSV (H: 0-360, S/V: 0-1). */
export function RGBtoHSV(R: number, G: number, B: number): HsvColor {
  const R1 = R / 255
  const G1 = G / 255
  const B1 = B / 255

  const MaxC = Math.max(R1, G1, B1)
  const MinC = Math.min(R1, G1, B1)

  const DeltaC = MaxC - MinC

  let H = 0

  if (DeltaC == 0) {
    H = 0
  } else if (MaxC == R1) {
    H = 60 * (((G1 - B1) / DeltaC) % 6)
  } else if (MaxC == G1) {
    H = 60 * ((B1 - R1) / DeltaC + 2)
  } else if (MaxC == B1) {
    H = 60 * ((R1 - G1) / DeltaC + 4)
  }

  if (H < 0) {
    H = 360 + H
  }

  let S = 0

  if (MaxC == 0) S = 0
  else S = DeltaC / MaxC

  const V = MaxC

  return { h: H, s: S, v: V }
}

/** Lightens (positive `rate`) or darkens (negative `rate`) a `#rrggbb` color string. */
export function lighten(color: string, rate: number): string {
  color = color.replace(/[^0-9a-f]/gi, '')
  rate = rate || 0

  const rgbParts: string[] = []
  for (let i = 0; i < 6; i += 2) {
    let c = parseInt(color.substr(i, 2), 16)
    const cStr = Math.round(Math.min(Math.max(0, c + c * rate), 255)).toString(16)
    rgbParts.push(('00' + cStr).substr(cStr.length))
  }

  return '#' + rgbParts.join('')
}

export function darken(color: string, rate: number): string {
  return lighten(color, -rate)
}

/** Gradient color string parsing - alias for `parseGradient`. */
export function parse(color: string): GradientDescriptor | string {
  return parseGradient(color)
}

export interface GradientDescriptor {
  type: string
  attr: LinearAttr | RadialAttr
  children: GradientStop[]
}

export interface LinearAttr {
  x1: number
  y1: number
  x2: number
  y2: number
  direction?: string
}

export interface RadialAttr {
  cx: number
  cy: number
  r: number
  fx: number
  fy: number
}

/**
 * Parses a gradient descriptor string, e.g.:
 *
 *      linear(left) #fff,#000
 *      linear(right) #fff,50 yellow,black
 *      radial(50%,50%,50%,50,50)
 *
 * Returns the input string unchanged if it doesn't match the `linear(...)`/`radial(...)` pattern.
 */
export function parseGradient(color: string): GradientDescriptor | string {
  const matches = color.match(regex)

  if (!matches) return color

  const type = trim(matches[1])
  const attr = parseAttr(type, trim(matches[2]))
  const stops = parseStop(trim(matches[3]))

  return { type: type + 'Gradient', attr, children: stops }
}

export interface GradientStop {
  type: string
  attr: Record<string, string | number>
  /**
   * PRESERVED BUG: this is a SEPARATE, top-level field from `attr.offset` (the one actually
   * parsed out of e.g. `"50% yellow"`). The original's interpolation pass (below) reads/writes
   * `stop.offset` directly on the stop object, never `stop.attr.offset` - so it's blind to any
   * offset a stop was actually constructed with, and only ever sees the values it force-assigns
   * to the first (`0`) and last (`1`) stops itself. In practice this means the "interpolate
   * missing offsets evenly between two known ones" logic never consults real percentage-offset
   * stops at all - see this file's header comment and `parseStop`'s doc comment.
   */
  offset?: number
}

/**
 * Splits a comma-separated gradient-stop list (e.g. `"#fff,50% yellow,black"`) into stop
 * descriptors.
 *
 * PRESERVED BUG: the "interpolate any stops between two explicit offsets evenly" pass operates on
 * a top-level `stop.offset` field that is NEVER populated from the actually-parsed `stop.attr.
 * offset` (e.g. `"50%"` on a `"50% yellow"` stop) - only the first/last stops get a top-level
 * `.offset` (force-set to `0`/`1`). Net effect: an explicit percentage offset on a middle stop is
 * silently ignored by this interpolation step (it's invisible to the `typeof stop.offset ==
 * 'undefined'` checks, which only ever see the real `.attr.offset`-having stops as "not needing
 * interpolation" by accident, not by design) - see this project's PORT_STATUS.md for the full
 * writeup and a hand-traced example.
 */
export function parseStop(stop: string): GradientStop[] {
  const stopList = stop.split(',')
  const stops: GradientStop[] = []

  for (let i = 0; i < stopList.length; i++) {
    const arr = stopList[i].split(' ')

    if (arr.length == 0) continue

    if (arr.length == 1) {
      stops.push({ type: 'stop', attr: { 'stop-color': arr[0] } })
    } else if (arr.length == 2) {
      stops.push({ type: 'stop', attr: { offset: arr[0], 'stop-color': arr[1] } })
    } else if (arr.length == 3) {
      stops.push({ type: 'stop', attr: { offset: arr[0], 'stop-color': arr[1], 'stop-opacity': arr[2] } })
    }
  }

  let start = -1
  let end = -1
  for (let i = 0, len = stops.length; i < len; i++) {
    const s = stops[i]

    if (i == 0) {
      if (!s.offset) s.offset = 0
    } else if (i == len - 1) {
      if (!s.offset) s.offset = 1
    }

    if (start == -1 && typeof s.offset == 'undefined') {
      start = i
    } else if (end == -1 && typeof s.offset == 'undefined') {
      end = i

      const count = end - start

      const endOffsetRaw = stops[end].offset as unknown
      const startOffsetRaw = stops[start].offset as unknown

      const endOffset =
        typeof endOffsetRaw == 'string' && (endOffsetRaw as string).indexOf('%') > -1
          ? parseFloat(endOffsetRaw as string) / 100
          : Number(endOffsetRaw)
      const startOffset =
        typeof startOffsetRaw == 'string' && (startOffsetRaw as string).indexOf('%') > -1
          ? parseFloat(startOffsetRaw as string) / 100
          : Number(startOffsetRaw)

      const dist = endOffset - startOffset
      const value = dist / count

      let offset = startOffset + value
      for (let index = start + 1; index < end; index++) {
        stops[index].offset = offset
        offset += value
      }

      start = end
      end = -1
    }
  }

  return stops
}

export function parseAttr(type: string, str: string): LinearAttr | RadialAttr {
  if (type == 'linear') {
    switch (str) {
      case '':
      case 'left':
        return { x1: 0, y1: 0, x2: 1, y2: 0, direction: str || 'left' }
      case 'right':
        return { x1: 1, y1: 0, x2: 0, y2: 0, direction: str }
      case 'top':
        return { x1: 0, y1: 0, x2: 0, y2: 1, direction: str }
      case 'bottom':
        return { x1: 0, y1: 1, x2: 0, y2: 0, direction: str }
      case 'top left':
        return { x1: 0, y1: 0, x2: 1, y2: 1, direction: str }
      case 'top right':
        return { x1: 1, y1: 0, x2: 0, y2: 1, direction: str }
      case 'bottom left':
        return { x1: 0, y1: 1, x2: 1, y2: 0, direction: str }
      case 'bottom right':
        return { x1: 1, y1: 1, x2: 0, y2: 0, direction: str }
      default: {
        const arr = str.split(',').map((v) => (v.indexOf('%') == -1 ? parseFloat(v) : v)) as unknown as number[]
        return { x1: arr[0], y1: arr[1], x2: arr[2], y2: arr[3] }
      }
    }
  } else {
    const arr = str.split(',').map((v) => (v.indexOf('%') == -1 ? parseFloat(v) : v)) as unknown as number[]
    return { cx: arr[0], cy: arr[1], r: arr[2], fx: arr[3], fy: arr[4] }
  }
}

/**
 * Hashes `name` to a warm-palette RGB color (or feeds the 0-1 hash vector to `callback`, if
 * given).
 */
export function colorHash(name?: string, callback?: (vector: number) => unknown): RgbColor | unknown {
  let vector = 0

  if (name) {
    name = name.replace(/.*`/, '') // drop module name if present
    name = name.replace(/\(.*/, '') // drop extra info
    vector = generateHash(name)
  }

  if (typeof callback == 'function') {
    return callback(vector)
  }

  return {
    r: 200 + Math.round(55 * vector),
    g: 0 + Math.round(230 * (1 - vector)),
    b: 0 + Math.round(55 * (1 - vector)),
  }
}
