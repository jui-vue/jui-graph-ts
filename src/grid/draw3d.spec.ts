import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CoreGrid, registerGridDraw3D, __resetGridDrawMixinsForTesting } from './core'
import type { GridChart } from './core'
import { applyDraw3DGridMixin } from './draw3d'
import { BlockGrid } from './block'
import type { Axis, AxisChart, AreaBox } from '../base/axis'
import { SVG } from '../util/svg'
import type { TransElement } from '../util/svg/element.transform'
import type { PolyElement } from '../util/svg/element.poly'

// Same test-double convention `draw2d.spec.ts`/`panel.spec.ts`/`block.spec.ts` already established
// (no shared test-helper module exists in this port).
//
// **Identity-transform oracle**: every hand-traced test below uses `degree: {x:0,y:0,z:0}` +
// `perspective: 1`, the exact same "isolate pure identity rotation" convention already established
// by `polygon/core.spec.ts`/`polygon/grid.spec.ts` (degree 0 makes the rotation matrix the
// identity; `perspective === 1` forces `PolygonCore.rotate()`'s per-vertex `scaleValue(far,0,depth,
// perspective,1)` to always resolve to exactly `1` regardless of `far`/`depth`, since both ends of
// the interpolation range collapse to `1`). Under this oracle every `Vector.x/.y` a `GridPolygon`/
// `LinePolygon`/`PointPolygon` produces after `calculate3d()` equals its raw, un-rotated `x`/`y`
// vertex coordinate exactly (z is simply dropped from the 2D projection) - which makes every
// coordinate in this file hand-computable without re-deriving the rotation/perspective math itself
// (already exhaustively cross-checked in `polygon/core.spec.ts`/`base/draw.spec.ts`).

function makeChart(overrides: Partial<GridChart> = {}): GridChart & { text: (attr: Record<string, unknown>, content?: unknown) => TransElement } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const svg = new SVG(container, { width: 400, height: 300 })

  const themeValues: Record<string, string | number> = {
    gridXAxisBorderColor: '#x-border',
    gridXAxisBorderWidth: 1,
    gridYAxisBorderColor: '#y-border',
    gridYAxisBorderWidth: 2,
    gridZAxisBorderColor: '#z-border',
    gridZAxisBorderWidth: 3,
    gridFaceBackgroundColor: '#face',
    gridFaceBackgroundOpacity: 0.4,
    gridBorderColor: '#ccc',
    gridBorderWidth: 1,
    gridBorderDashArray: 'none',
    gridTickBorderSize: 5,
    gridTickPadding: 2,
    gridXFontSize: 12,
    gridYFontSize: 18,
    gridZFontSize: 9,
    gridXFontWeight: 'normal',
    gridYFontWeight: 'bold',
    gridZFontWeight: 'lighter',
    gridXFontColor: '#xf',
    gridYFontColor: '#yf',
    gridZFontColor: '#zf',
  }

  const theme = vi.fn((key: unknown) => themeValues[key as string])

  const area: AreaBox = { x: 10, y: 20, x2: 110, y2: 220, width: 100, height: 200 }

  return {
    area: ((key?: string) => (key ? (area as any)[key] : area)) as AxisChart['area'],
    svg,
    index: 0,
    appendDefs: vi.fn(),
    theme: theme as unknown as GridChart['theme'],
    isRender: () => false,
    render: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    gridTypes: {},
    axis: vi.fn(() => undefined),
    color: vi.fn((c: unknown) => `color(${JSON.stringify(c)})`),
    format: (v: unknown) => v,
    text: vi.fn((attr: Record<string, unknown>, content?: unknown) => svg.text(attr as any, content as any)),
    ...overrides,
  }
}

function makeAxisStub(
  overrides: Partial<{ area: AreaBox; depth: number; get: (t: string) => unknown; isFull3D: boolean }> = {},
): Axis {
  const area: AreaBox = overrides.area ?? { x: 10, y: 20, x2: 110, y2: 220, width: 100, height: 200 }

  return {
    area: ((key?: string) => (key ? (area as any)[key] : area)) as Axis['area'],
    depth: overrides.depth ?? 50,
    degree: { x: 0, y: 0, z: 0 },
    perspective: 1,
    isFull3D: () => overrides.isFull3D ?? true,
    data: [],
    get: overrides.get ?? ((type: string) => (type === 'x' || type === 'y' ? { hide: false, orient: type === 'x' ? 'bottom' : 'left' } : undefined)),
  } as unknown as Axis
}

function makeGrid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { orient: 'center', type: 'block', ...overrides }
}

function makeTarget(chartOverrides: Partial<GridChart> = {}, axisOverrides: Parameters<typeof makeAxisStub>[0] = {}) {
  const chart = makeChart(chartOverrides)
  const g = new CoreGrid()
  g.chart = chart
  g.axis = makeAxisStub(axisOverrides)
  g.grid = makeGrid()
  g.svg = chart.svg
  applyDraw3DGridMixin(g)
  return { g, chart }
}

beforeEach(() => {
  document.body.innerHTML = ''
  __resetGridDrawMixinsForTesting()
})

describe('applyDraw3DGridMixin (grid/draw3d.ts)', () => {
  it('assigns all 11 methods (the 4 CoreGrid declares fields for, plus 7 3D-only ones) as OWN properties', () => {
    const g = new CoreGrid()
    applyDraw3DGridMixin(g)

    for (const name of [
      'createGridX',
      'createGridY',
      'drawCenter',
      'drawBaseLine',
      'drawAxisLine',
      'drawValueLine',
      'drawValueLineCenter',
      'drawValueText',
      'drawValueTextCenter',
      'drawPattern',
      'drawImage',
    ]) {
      expect(Object.prototype.hasOwnProperty.call(g, name)).toBe(true)
      expect(typeof (g as any)[name]).toBe('function')
    }
  })

  it('drawPattern/drawImage are literal no-ops (unlike the 2D mixin)', () => {
    const { g } = makeTarget()
    expect((g as any).drawPattern('top', [], [], true)).toBeUndefined()
    expect((g as any).drawImage('top', {} as TransElement, {}, 0, 0, 0)).toBeUndefined()
  })

  describe('createGridX/createGridY', () => {
    it("createGridX builds a bare svg.group() with NO translate (unlike draw2d.ts's own createGridX)", () => {
      const { g } = makeTarget()
      const axisGroup = (g as any).createGridX('top', 0, 15, false, false)
      expect(axisGroup.attr('transform')).toBeUndefined()
    })

    it('createGridX forwards to drawValueLine(position, axis, isActive, line, index, x, isLast) when getLineOption() is truthy', () => {
      const { g } = makeTarget()
      g.grid = makeGrid({ line: 'solid' })
      const spy = vi.fn()
      ;(g as any).drawValueLine = spy

      ;(g as any).createGridX('top', 2, 15, true, false)

      expect(spy).toHaveBeenCalledWith('top', expect.anything(), true, { type: 'solid' }, 2, 15, false)
    })

    it('createGridY forwards y as the xy positional argument (not x)', () => {
      const { g } = makeTarget()
      g.grid = makeGrid({ line: 'solid' })
      const spy = vi.fn()
      ;(g as any).drawValueLine = spy

      ;(g as any).createGridY('left', 1, 99, false, true)

      expect(spy).toHaveBeenCalledWith('left', expect.anything(), false, { type: 'solid' }, 1, 99, true)
    })

    it('skips drawValueLine entirely when getLineOption() is falsy (grid.line defaults to false)', () => {
      const { g } = makeTarget()
      const spy = vi.fn()
      ;(g as any).drawValueLine = spy

      ;(g as any).createGridX('top', 0, 0, false, false)

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('drawAxisLine (identity-transform hand-traced quad-face coordinates)', () => {
    it("'bottom': horizontal quad, w/h/x/y unmutated for the 'bottom' half of the isTopOrBottom branch", () => {
      const { g } = makeTarget()
      const axis = (g.svg as SVG).group()

      ;(g as any).drawAxisLine('bottom', axis)

      const face = (axis as any).children[0] as PolyElement
      // GridPolygon('horizontal', w=100, h=200, d=50, x=10, y=20): width=x+w=110, height=y+h=220.
      // matrix.horizontal = [(x,height,0),(width,height,0),(width,height,depth),(x,height,depth)]
      //                    = [(10,220,0),(110,220,0),(110,220,50),(10,220,50)]
      // Under the identity oracle, vectors drop z: [(10,220),(110,220),(110,220),(10,220)].
      expect((face as any).orders).toEqual(['10,220', '110,220', '110,220', '10,220'])
      // Preserved bug (see draw3d.ts's own header comment): `.join()` is never called, so `points`
      // was never actually written to the DOM attribute, despite 4 real `.point()` calls above.
      expect(face.attr('points')).toBeUndefined()
      // Proof the SAME accumulated points WOULD have produced a real string, had the original
      // called `.join()` (it doesn't) - confirms this is a real, reachable rendering gap, not a
      // false positive from an unrelated cause.
      face.join()
      expect(face.attr('points')).toBe('10,220 110,220 110,220 10,220 10,220')
    })

    it("'top': the isTopOrBottom branch's h-reassignment collapses to 0 (h = (position=='bottom') ? h : 0)", () => {
      const { g } = makeTarget()
      const axis = (g.svg as SVG).group()

      ;(g as any).drawAxisLine('top', axis)

      const face = (axis as any).children[0] as PolyElement
      // h reassigned to 0: GridPolygon('horizontal', w=100, h=0, d=50, x=10, y=20) -> height=y+0=20.
      // matrix.horizontal = [(10,20,0),(110,20,0),(110,20,50),(10,20,50)] -> vectors (z dropped).
      expect((face as any).orders).toEqual(['10,20', '110,20', '110,20', '10,20'])
    })

    it("'left': the vertical branch's w-reassignment collapses to 0 (w = (position=='right') ? w : 0)", () => {
      const { g } = makeTarget()
      const axis = (g.svg as SVG).group()

      ;(g as any).drawAxisLine('left', axis)

      const face = (axis as any).children[0] as PolyElement
      // w reassigned to 0: GridPolygon('vertical', w=0, h=200, d=50, x=10, y=20) -> width=x+0=10.
      // matrix.vertical = [(width,y,0),(width,height,0),(width,height,depth),(width,y,depth)]
      //                  = [(10,20,0),(10,220,0),(10,220,50),(10,20,50)] -> vectors (z dropped).
      expect((face as any).orders).toEqual(['10,20', '10,220', '10,220', '10,20'])
    })

    it("'right': w stays the full area width (position == 'right')", () => {
      const { g } = makeTarget()
      const axis = (g.svg as SVG).group()

      ;(g as any).drawAxisLine('right', axis)

      const face = (axis as any).children[0] as PolyElement
      // GridPolygon('vertical', w=100, h=200, d=50, x=10, y=20) -> width=x+100=110.
      expect((face as any).orders).toEqual(['110,20', '110,220', '110,220', '110,20'])
    })

    it("'center': uses raw w/h/x/y unmutated, and themes with gridZAxisBorder*", () => {
      const { g, chart } = makeTarget()
      const axis = (g.svg as SVG).group()

      ;(g as any).drawAxisLine('center', axis)

      expect(chart.theme).toHaveBeenCalledWith('gridZAxisBorderColor')
      expect(chart.theme).toHaveBeenCalledWith('gridZAxisBorderWidth')

      const face = (axis as any).children[0] as PolyElement
      // GridPolygon('center', w=100, h=200, d=50, x=10, y=20):
      // matrix.center = [(x,y,depth),(width,y,depth),(width,height,depth),(x,height,depth)]
      //               = [(10,20,50),(110,20,50),(110,220,50),(10,220,50)] -> vectors (z dropped).
      expect((face as any).orders).toEqual(['10,20', '110,20', '110,220', '10,220'])
    })

    it("'center': gated on axis.get('y').hide - appended when false, suppressed when true", () => {
      const notHidden = makeTarget({}, { get: (t) => (t === 'y' ? { hide: false, orient: 'left' } : { hide: false, orient: 'bottom' }) })
      const axisA = (notHidden.g.svg as SVG).group()
      ;(notHidden.g as any).drawAxisLine('center', axisA)
      expect((axisA as any).children.length).toBe(1)

      const hidden = makeTarget({}, { get: (t) => (t === 'y' ? { hide: true, orient: 'left' } : { hide: false, orient: 'bottom' }) })
      const axisB = (hidden.g.svg as SVG).group()
      ;(hidden.g as any).drawAxisLine('center', axisB)
      expect((axisB as any).children.length).toBe(0)
    })

    it("non-'center' positions ALWAYS append the face, regardless of axis.get('y').hide (asymmetric with 'center')", () => {
      const hidden = makeTarget({}, { get: (t) => (t === 'y' ? { hide: true, orient: 'left' } : { hide: false, orient: 'bottom' }) })
      const axis = (hidden.g.svg as SVG).group()
      ;(hidden.g as any).drawAxisLine('bottom', axis)
      expect((axis as any).children.length).toBe(1)
    })

    it('themes gridXAxisBorder* for top/bottom, gridYAxisBorder* for left/right', () => {
      const { g, chart } = makeTarget()
      ;(g as any).drawAxisLine('top', (g.svg as SVG).group())
      expect(chart.theme).toHaveBeenCalledWith('gridXAxisBorderColor')

      ;(chart.theme as any).mockClear()
      ;(g as any).drawAxisLine('left', (g.svg as SVG).group())
      expect(chart.theme).toHaveBeenCalledWith('gridYAxisBorderColor')
    })
  })

  describe('drawBaseLine', () => {
    it('wraps a fresh svg.group(), calls drawAxisLine(position, thatGroup), and appends it to g', () => {
      const { g } = makeTarget()
      const spy = vi.fn()
      ;(g as any).drawAxisLine = spy
      const container = (g.svg as SVG).group()

      ;(g as any).drawBaseLine('top', container)

      expect(spy).toHaveBeenCalledTimes(1)
      const [position, axisArg] = spy.mock.calls[0]
      expect(position).toBe('top')
      expect((container as any).children).toContain(axisArg)
    })
  })

  describe('drawCenter', () => {
    it('calls drawValueLineCenter only when getLineOption() is truthy, always calls drawValueTextCenter, then appends to g', () => {
      const { g } = makeTarget()
      g.grid = makeGrid({ line: 'solid' })
      const lineSpy = vi.fn()
      const textSpy = vi.fn()
      ;(g as any).drawValueLineCenter = lineSpy
      ;(g as any).drawValueTextCenter = textSpy
      const container = (g.svg as SVG).group()

      ;(g as any).drawCenter(container, ['a', 'b'], [1, 2], null, 7)

      expect(lineSpy).toHaveBeenCalledWith(expect.anything(), ['a', 'b'], { type: 'solid' })
      expect(textSpy).toHaveBeenCalledWith(expect.anything(), ['a', 'b'], [1, 2], null, 7)
      expect((container as any).children.length).toBe(1)
    })

    it('skips drawValueLineCenter when getLineOption() is falsy', () => {
      const { g } = makeTarget()
      const lineSpy = vi.fn()
      ;(g as any).drawValueLineCenter = lineSpy
      ;(g as any).drawValueTextCenter = vi.fn()

      ;(g as any).drawCenter((g.svg as SVG).group(), ['a'], [1], null, 0)

      expect(lineSpy).not.toHaveBeenCalled()
    })
  })

  describe('drawValueLine (identity-transform hand-traced line coordinates + gating)', () => {
    it("'top': draws l1 (degenerate at xy,y) and l2 (xy,y)->(xy,y+h) when checkDrawLineY allows it", () => {
      const { g } = makeTarget({}, { get: (t) => (t === 'x' || t === 'y' ? { hide: false, orient: t === 'x' ? 'bottom' : 'left' } : undefined) })
      const axis = (g.svg as SVG).group()

      // index=1 (not 0), isLast=false -> checkDrawLineY('left' orient) returns true.
      ;(g as any).drawValueLine('top', axis, false, { type: 'solid' }, 1, 15, false)

      const children = (axis as any).children
      expect(children.length).toBe(2)
      // l1 = LinePolygon(15,20,0, 15,20,50) -> vectors both (15,20) under the identity oracle.
      expect(children[0].attr('x1')).toBe(15)
      expect(children[0].attr('y1')).toBe(20)
      expect(children[0].attr('x2')).toBe(15)
      expect(children[0].attr('y2')).toBe(20)
      // l2 = LinePolygon(15,20,50, 15,220,50) -> vectors (15,20) then (15,220).
      expect(children[1].attr('x1')).toBe(15)
      expect(children[1].attr('y1')).toBe(20)
      expect(children[1].attr('x2')).toBe(15)
      expect(children[1].attr('y2')).toBe(220)
    })

    it('does not draw anything when checkDrawLineY/X returns false (boundary-exclusion, inherited from CoreGrid)', () => {
      // orient 'left' + index===0 -> checkDrawLineY returns false for 'top'/'bottom' positions.
      const { g } = makeTarget({}, { get: (t) => (t === 'x' || t === 'y' ? { hide: false, orient: t === 'x' ? 'bottom' : 'left' } : undefined) })
      const axis = (g.svg as SVG).group()

      ;(g as any).drawValueLine('top', axis, false, { type: 'solid' }, 0, 15, false)

      expect((axis as any).children.length).toBe(0)
    })

    it("gates l2 (not l1) on axis.get('y').hide, regardless of the position being drawn (asymmetric quirk)", () => {
      const { g } = makeTarget({}, { get: (t) => (t === 'y' ? { hide: true, orient: 'left' } : { hide: false, orient: 'bottom' }) })
      const axis = (g.svg as SVG).group()

      ;(g as any).drawValueLine('top', axis, false, { type: 'solid' }, 1, 15, false)

      expect((axis as any).children.length).toBe(1)
    })

    it('applies stroke-dasharray when line.type contains "dashed"', () => {
      const { g } = makeTarget({}, { get: (t) => (t === 'x' || t === 'y' ? { hide: false, orient: t === 'x' ? 'bottom' : 'left' } : undefined) })
      const axis = (g.svg as SVG).group()

      ;(g as any).drawValueLine('left', axis, false, { type: 'dashed' }, 1, 30, false)

      const children = (axis as any).children
      expect(children[0].attr('stroke-dasharray')).toBe('3,3')
    })

    it("ignores its 'isActive' parameter entirely (always uses the plain gridBorderColor/Width theme keys)", () => {
      const { g, chart } = makeTarget({}, { get: (t) => (t === 'x' || t === 'y' ? { hide: false, orient: t === 'x' ? 'bottom' : 'left' } : undefined) })
      ;(chart.theme as any).mockClear()

      ;(g as any).drawValueLine('left', (g.svg as SVG).group(), true, { type: 'solid' }, 1, 30, false)

      expect(chart.theme).toHaveBeenCalledWith('gridBorderColor')
      expect(chart.theme).not.toHaveBeenCalledWith('gridActiveBorderColor')
    })
  })

  describe('drawValueLineCenter (identity-transform hand-traced z-mesh coordinates)', () => {
    it('draws one line pair per interior z-slice (i=1..len-1), positioned via dx/dy orient logic', () => {
      const { g } = makeTarget({}, { get: (t) => (t === 'x' || t === 'y' ? { hide: false, orient: t === 'x' ? 'bottom' : 'left' } : undefined) })
      const axis = (g.svg as SVG).group()
      g.grid = makeGrid({ type: 'range' }) // type != 'block' -> len = ticks.length - 1

      // ticks.length=3, type != 'block' -> len=2 -> loop i=1 only -> t = 1*(depth/len) = 1*(50/2)=25.
      ;(g as any).drawValueLineCenter(axis, ['a', 'b', 'c'], { type: 'solid' })

      const children = (axis as any).children
      expect(children.length).toBe(2)
      // dx = (y.orient=='left') ? 0 : w -> 0. dy = (x.orient=='top') ? 0 : h -> h=200 (orient 'bottom').
      // p1 = LinePolygon(x,y+dy,t, x+w,y+dy,t) = LinePolygon(10,220,25, 110,220,25) -> (10,220)->(110,220).
      expect(children[0].attr('x1')).toBe(10)
      expect(children[0].attr('y1')).toBe(220)
      expect(children[0].attr('x2')).toBe(110)
      expect(children[0].attr('y2')).toBe(220)
      // p2 = LinePolygon(x+dx,y,t, x+dx,y+h,t) = LinePolygon(10,20,25, 10,220,25) -> (10,20)->(10,220).
      expect(children[1].attr('x1')).toBe(10)
      expect(children[1].attr('y1')).toBe(20)
      expect(children[1].attr('x2')).toBe(10)
      expect(children[1].attr('y2')).toBe(220)
    })

    it("gates the second line (p2) on axis.get('y').hide", () => {
      const { g } = makeTarget({}, { get: (t) => (t === 'y' ? { hide: true, orient: 'left' } : { hide: false, orient: 'bottom' }) })
      const axis = (g.svg as SVG).group()
      g.grid = makeGrid({ type: 'range' })

      ;(g as any).drawValueLineCenter(axis, ['a', 'b', 'c'], { type: 'solid' })

      expect((axis as any).children.length).toBe(1)
    })

    it("uses ticks.length (not -1) as len when grid.type === 'block'", () => {
      const { g } = makeTarget({}, { get: (t) => (t === 'x' || t === 'y' ? { hide: false, orient: t === 'x' ? 'bottom' : 'left' } : undefined) })
      const axis = (g.svg as SVG).group()
      g.grid = makeGrid({ type: 'block' }) // len = ticks.length = 3 -> loop i=1,2 -> 2 pairs = 4 lines

      ;(g as any).drawValueLineCenter(axis, ['a', 'b', 'c'], { type: 'solid' })

      expect((axis as any).children.length).toBe(4)
    })
  })

  describe('drawValueText', () => {
    it('returns early when grid.hideText is true', () => {
      const { g, chart } = makeTarget()
      g.grid = makeGrid({ hideText: true })
      ;(chart.text as any).mockClear()

      ;(g as any).drawValueText('top', (g.svg as SVG).group(), 0, 15, 'A')

      expect(chart.text).not.toHaveBeenCalled()
    })

    it("'bottom': x=xy, y=dy+(h+tickSize+2*tickPadding), text-anchor middle, dy=gridXFontSize/3", () => {
      const { g, chart } = makeTarget()
      const axis = (g.svg as SVG).group()

      // dy(area.y)=20, h=200, tickSize=5, tickPadding=2 -> y = 20 + (200+5+4) = 229.
      ;(g as any).drawValueText('bottom', axis, 99, 15, 'DOMAIN')

      const call = (chart.text as any).mock.calls[0]
      expect(call[0].x).toBe(15)
      expect(call[0].y).toBe(229)
      // isVertical=false for 'bottom': dx = gridXFontSize/3, dy = 0 (NOT the other way around).
      expect(call[0].dx).toBeCloseTo(4) // gridXFontSize=12 / 3
      expect(call[0].dy).toBe(0)
      expect(call[0]['text-anchor']).toBe('middle')
      expect(call[1]).toBe('DOMAIN')
    })

    it("'left': x=dx-(tickSize+tickPadding), y=xy, text-anchor end, dx=0/dy=gridYFontSize/3", () => {
      const { g, chart } = makeTarget()
      const axis = (g.svg as SVG).group()

      // dx(area.x)=10, tickSize=5, tickPadding=2 -> x = 10 - 7 = 3.
      ;(g as any).drawValueText('left', axis, 0, 88, 'L')

      const call = (chart.text as any).mock.calls[0]
      expect(call[0].x).toBe(3)
      expect(call[0].y).toBe(88)
      expect(call[0].dx).toBe(0)
      expect(call[0].dy).toBeCloseTo(6) // gridYFontSize=18 / 3
      expect(call[0]['text-anchor']).toBe('end')
    })

    it("'right': x=dx+(w+tickSize+tickPadding), text-anchor start", () => {
      const { g, chart } = makeTarget()
      const axis = (g.svg as SVG).group()

      // dx=10, w=100, tickSize=5, tickPadding=2 -> x = 10 + 107 = 117.
      ;(g as any).drawValueText('right', axis, 0, 88, 'R')

      const call = (chart.text as any).mock.calls[0]
      expect(call[0].x).toBe(117)
      expect(call[0]['text-anchor']).toBe('start')
    })

    it("ignores its 'index' parameter entirely (only xy/domain/position matter)", () => {
      const { g, chart } = makeTarget()
      ;(g as any).drawValueText('bottom', (g.svg as SVG).group(), 0, 15, 'A')
      const callA = (chart.text as any).mock.calls[0][0]
      ;(chart.text as any).mockClear()
      ;(g as any).drawValueText('bottom', (g.svg as SVG).group(), 999999, 15, 'A')
      const callB = (chart.text as any).mock.calls[0][0]
      expect(callA).toEqual(callB)
    })
  })

  describe('drawValueTextCenter', () => {
    it('returns early when grid.hideText is true', () => {
      const { g, chart } = makeTarget()
      g.grid = makeGrid({ hideText: true })

      ;(g as any).drawValueTextCenter((g.svg as SVG).group(), ['a', 'b'], [1, 2], null, 0)

      expect(chart.text).not.toHaveBeenCalled()
    })

    it('draws one text per tick, all at the SAME (x,y) under the identity oracle (t only varies z, which is dropped)', () => {
      const { g, chart } = makeTarget({}, { get: (t) => (t === 'x' || t === 'y' ? { hide: false, orient: t === 'x' ? 'bottom' : 'left' } : undefined) })
      const axis = (g.svg as SVG).group()
      g.grid = makeGrid({ type: 'range' }) // len = ticks.length - 1 = 2

      // isLeft=true(orient 'left'), isTop=false(orient 'bottom'); margin=tickSize+tickPadding=7.
      // x = area.x + (isLeft ? w+margin : -margin) = 10 + 107 = 117.
      // y = area.y + (isTop ? -margin : h+margin) = 20 + 207 = 227.
      ;(g as any).drawValueTextCenter(axis, ['a', 'b', 'c'], [1, 2, 3], null, 5)

      expect((chart.text as any).mock.calls.length).toBe(3)
      for (const call of (chart.text as any).mock.calls) {
        expect(call[0].x).toBe(117)
        expect(call[0].y).toBe(227)
        expect(call[0]['text-anchor']).toBe('start') // isLeft -> 'start'
      }
      expect((chart.text as any).mock.calls.map((c: any[]) => c[1])).toEqual(['a', 'b', 'c'])
      expect((axis as any).children.length).toBe(3)
    })

    it("ignores its 'values'/'checkActive' parameters entirely (only ticks/moveZ drive the loop)", () => {
      const { g, chart } = makeTarget({}, { get: (t) => (t === 'x' || t === 'y' ? { hide: false, orient: t === 'x' ? 'bottom' : 'left' } : undefined) })
      ;(g as any).drawValueTextCenter((g.svg as SVG).group(), ['a', 'b'], [999, 999], null, 5)
      const callA = (chart.text as any).mock.calls.map((c: any[]) => [c[0].x, c[0].y])
      ;(chart.text as any).mockClear()
      ;(g as any).drawValueTextCenter((g.svg as SVG).group(), ['a', 'b'], [], () => true, 5)
      const callB = (chart.text as any).mock.calls.map((c: any[]) => [c[0].x, c[0].y])
      expect(callA).toEqual(callB)
    })
  })

  describe('end-to-end render() with the real draw3d.ts mixin (registerGridDraw3D wiring confirmation)', () => {
    it('renders a full-3D BlockGrid (axis.isFull3D()=true, grid.orient="center") without throwing, via the real Draw3DGrid mixin', () => {
      registerGridDraw3D(applyDraw3DGridMixin)

      const chart = makeChart()
      const g = new BlockGrid()
      g.chart = chart
      g.axis = makeAxisStub({ area: { x: 10, y: 20, x2: 110, y2: 220, width: 100, height: 200 }, depth: 90, isFull3D: true })
      g.grid = { orient: 'center', type: 'block', domain: ['a', 'b', 'c'], reverse: false, max: 10, hideText: false, key: null } as any
      g.svg = chart.svg

      const result = g.render()

      // The mixin genuinely got applied - CoreGrid's own definite-assignment fields, unset before
      // any mixin runs, are now real functions (same wiring-confirmation shape `panel.spec.ts`'s
      // own draw2d end-to-end test already established for the 2D mixin).
      expect(typeof g.createGridX).toBe('function')
      expect(typeof g.createGridY).toBe('function')
      expect(typeof g.drawImage).toBe('function')
      expect(typeof g.drawValueText).toBe('function')
      // 3D-only members `CoreGrid` itself doesn't declare fields for, but `BlockGrid` does
      // (`drawCenter!`/`drawBaseLine!` - see `block.ts`).
      expect(typeof g.drawCenter).toBe('function')
      expect(typeof g.drawBaseLine).toBe('function')

      // BlockGrid.center(g) calls this.drawCenter(...) then this.drawBaseLine('center', g) - each
      // appends exactly one group into the root, so the root should have exactly 2 children.
      const rootChildren = (result.root as any).children as unknown[]
      expect(rootChildren.length).toBe(2)

      // drawCenter's group: grid.line defaults to false (getLineOption() falsy) so
      // drawValueLineCenter is skipped entirely - only drawValueTextCenter's 3 ticks worth of text
      // nodes end up there (domain = ['a','b','c']).
      const centerGroup = rootChildren[0] as TransElement & { children: unknown[] }
      expect(centerGroup.children.length).toBe(3)

      // drawBaseLine's group: drawAxisLine('center', ...) appends exactly one face polygon (Y not
      // hidden by the default axis stub), which - per the preserved bug this file documents -
      // never got `.join()`'d, so its `points` attribute is still unset even through a real,
      // full render() pass (not just the standalone unit test above).
      const baseLineGroup = rootChildren[1] as TransElement & { children: PolyElement[] }
      expect(baseLineGroup.children.length).toBe(1)
      expect(baseLineGroup.children[0].attr('points')).toBeUndefined()
    })
  })
})
