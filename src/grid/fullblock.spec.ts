import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FullBlockGrid } from './fullblock'
import { BlockGrid } from './block'
import type { Axis, AxisChart, AreaBox } from '../base/axis'
import type { GridChart } from './core'
import { SVG } from '../util/svg'
import type { TransElement } from '../util/svg/element.transform'

// Same test-double conventions `grid/core.spec.ts`/`grid/block.spec.ts` already established.

function makeChart(overrides: Partial<GridChart> = {}): { chart: GridChart; svg: SVG } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const svg = new SVG(container, { width: 400, height: 300 })
  const area: AreaBox = { x: 0, y: 0, x2: 400, y2: 300, width: 400, height: 300 }

  const chart: GridChart = {
    area: ((key?: string) => (key ? (area as any)[key] : area)) as AxisChart['area'],
    svg,
    index: 0,
    appendDefs: vi.fn(),
    theme: vi.fn(() => 'themed') as unknown as GridChart['theme'],
    isRender: () => false,
    render: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    gridTypes: {},
    axis: vi.fn(() => undefined),
    color: vi.fn((c: unknown) => `color(${JSON.stringify(c)})`),
    format: (v: unknown) => v,
    ...overrides,
  }

  return { chart, svg }
}

interface AxisStubOptions {
  area?: AreaBox
  data?: unknown[]
}

function makeAxisStub(opts: AxisStubOptions = {}): Axis {
  const area: AreaBox = opts.area ?? { x: 0, y: 0, x2: 400, y2: 300, width: 400, height: 300 }
  const stub = {
    area: ((key?: string) => (key ? (area as any)[key] : area)) as Axis['area'],
    depth: 0,
    degree: { x: 0, y: 0, z: 0 },
    isFull3D: () => false,
    data: opts.data ?? [],
    get: (type: string) => (type === 'x' || type === 'y' ? { hide: false, orient: type === 'x' ? 'bottom' : 'left' } : undefined),
  }
  return stub as unknown as Axis
}

function makeGrid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { orient: 'bottom', type: 'fullblock', domain: null, reverse: false, max: 10, hideText: false, ...overrides }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

function makeFullBlockGrid(): FullBlockGrid {
  const g = new FullBlockGrid()
  const { chart } = makeChart()
  g.chart = chart
  g.grid = makeGrid() as any
  g.axis = makeAxisStub()
  return g
}

describe('FullBlockGrid', () => {
  describe('initDomain (byte-identical to BlockGrid.initDomain - re-verified directly, not just by reference)', () => {
    it('string domain: resolves the field per data row in forward order', () => {
      const g = makeFullBlockGrid()
      g.axis = makeAxisStub({ data: [{ f: 'a' }, { f: 'b' }, { f: 'c' }] })
      g.grid = makeGrid({ domain: 'f', reverse: false }) as any

      expect(g.initDomain()).toEqual(['a', 'b', 'c'])
    })

    it('PRESERVED BUG (same as block.ts): grid.reverse is a no-op for a string domain (double-reversal cancels out)', () => {
      const g = makeFullBlockGrid()
      g.axis = makeAxisStub({ data: [{ f: 'a' }, { f: 'b' }, { f: 'c' }] })
      g.grid = makeGrid({ domain: 'f', reverse: true }) as any

      expect(g.initDomain()).toEqual(['a', 'b', 'c'])
    })

    it('function domain: reverse DOES have a real effect', () => {
      const g = makeFullBlockGrid()
      g.grid = makeGrid({ domain: () => [1, 2, 3], reverse: true }) as any
      expect(g.initDomain()).toEqual([3, 2, 1])
    })

    it('array domain: used directly, reversed in place when grid.reverse is set', () => {
      const g = makeFullBlockGrid()
      g.grid = makeGrid({ domain: [1, 2, 3], reverse: true }) as any
      expect(g.initDomain()).toEqual([3, 2, 1])
    })
  })

  describe('wrapper - off-by-one vs. BlockGrid.wrapper, verified side by side', () => {
    it('PRESERVED BUG: reverse arithmetic is `len - i` (no `-1`) - one past the last valid index for i=0, unlike BlockGrid', () => {
      const fb = makeFullBlockGrid()
      fb.domain = ['a', 'b', 'c', 'd']
      fb.grid = makeGrid({ reverse: true }) as any

      const bg = new BlockGrid()
      bg.domain = ['a', 'b', 'c', 'd']
      bg.grid = makeGrid({ reverse: true }) as any

      const oldScaleFB = vi.fn((v: unknown) => v) as any
      const oldScaleBG = vi.fn((v: unknown) => v) as any

      const wrappedFB = fb.wrapper(oldScaleFB, 'k') as any
      const wrappedBG = bg.wrapper(oldScaleBG, 'k') as any

      // Same reachability caveat as block.spec.ts: only a non-numeric `i` reaches this branch
      // (the `typeof i == 'number' && key` check always wins first for a real numeric index).
      // Pass the numeric STRING `"0"` (not a real `number`, so it takes the else branch) rather
      // than `undefined`, so the `-` operator's own numeric coercion (`"0"` -> `0`, unlike `+`,
      // which would concatenate) produces real, concretely-different numbers instead of two
      // NaN-vs-NaN results that would obscure the actual off-by-one.
      wrappedFB('0' as unknown as number)
      wrappedBG('0' as unknown as number)

      // FullBlockGrid: `len - i` = `4 - 0` = `4` - one past the last valid 0-based domain index.
      expect(oldScaleFB).toHaveBeenCalledWith(4)
      // BlockGrid: `len - i - 1` = `4 - 0 - 1` = `3` - the correct last domain index.
      expect(oldScaleBG).toHaveBeenCalledWith(3)
    })

    it('key set + numeric index: looks up axis.data[i][key] through the old scale (unaffected by the reverse bug)', () => {
      const g = makeFullBlockGrid()
      g.axis = makeAxisStub({ data: [{ v: 'x' }, { v: 'y' }] })
      g.domain = ['a', 'b']

      const oldScale = vi.fn((v: unknown) => `scaled(${v})`) as any
      const wrapped = g.wrapper(oldScale, 'v')

      expect(wrapped(1)).toBe('scaled(y)')
      expect(oldScale).toHaveBeenCalledWith('y')
    })

    it('key falsy: returns the raw scale unchanged', () => {
      const g = makeFullBlockGrid()
      g.domain = []
      const scale = ((t: unknown) => t) as any
      expect(g.wrapper(scale, undefined)).toBe(scale)
    })
  })

  describe('drawBefore', () => {
    it('sets up an ordinal rangeBands scale (full band width, no gaps) - unlike BlockGrid\'s rangePoints', () => {
      const g = makeFullBlockGrid()
      g.axis = makeAxisStub({ area: { x: 0, y: 0, x2: 400, y2: 300, width: 400, height: 300 } })
      g.grid = makeGrid({ domain: ['a', 'b', 'c', 'd'], orient: 'bottom' }) as any

      g.drawBefore()

      expect(g.start).toBe(0)
      expect(g.end).toBe(400)
      expect(g.domain).toEqual(['a', 'b', 'c', 'd'])
      // rangeBands: first point at 0 (not offset by half a band, unlike rangePoints).
      expect(g.points[0]).toBe(0)
      expect(g.points[3]).toBe(400)
      expect(g.band).toBeCloseTo(133.333, 2)
      // half_band is a HARD 0 for FullBlockGrid, regardless of the real band size (unlike
      // BlockGrid, which uses band/2).
      expect(g.half_band).toBe(0)
      expect(g.bar).toBe(6)
    })
  })

  describe('draw', () => {
    it('calls drawGrid() with zero arguments ("fullblock" was always dead code in the original)', () => {
      const g = makeFullBlockGrid()
      const spy = vi.spyOn(g, 'drawGrid').mockReturnValue({ root: {} as TransElement, scale: null })

      g.draw()
      expect(spy).toHaveBeenCalledWith()
    })
  })

  describe('orient methods - confirmed different from BlockGrid: literal 0 moveX/Y/Z, no trailing boundary tick', () => {
    function setupDrawable() {
      const g = makeFullBlockGrid()
      g.domain = ['a', 'b', 'c']
      g.points = [0, 133, 266]
      g.half_band = 0

      g.drawPattern = vi.fn()
      g.drawBaseLine = vi.fn()
      g.drawCenter = vi.fn()
      g.drawTop = vi.fn() as any
      g.drawBottom = vi.fn() as any
      g.drawLeft = vi.fn() as any
      g.drawRight = vi.fn() as any
      g.createGridX = vi.fn(() => g.chart.svg.group()) as any
      g.createGridY = vi.fn(() => g.chart.svg.group()) as any

      const container = g.chart.svg.group()
      return { g, container }
    }

    it('top(): drawPattern called with only 3 args (isMove omitted, unlike BlockGrid\'s explicit `true`)', () => {
      const { g, container } = setupDrawable()

      g.top(container)

      expect(g.drawPattern).toHaveBeenCalledWith('top', g.domain, g.points)
      expect(g.drawTop).toHaveBeenCalledWith(container, g.domain, g.points, null, 0)
      expect(g.drawBaseLine).toHaveBeenCalledWith('top', container)
      // No trailing boundary tick, unlike BlockGrid.top().
      expect(g.createGridX).not.toHaveBeenCalled()
    })

    it('bottom()/left()/right() mirror top(): literal 0 move, no trailing tick', () => {
      const { g, container } = setupDrawable()

      g.bottom(container)
      expect(g.drawBottom).toHaveBeenCalledWith(container, g.domain, g.points, null, 0)

      g.left(container)
      expect(g.drawLeft).toHaveBeenCalledWith(container, g.domain, g.points, null, 0)

      g.right(container)
      expect(g.drawRight).toHaveBeenCalledWith(container, g.domain, g.points, null, 0)

      expect(g.createGridX).not.toHaveBeenCalled()
      expect(g.createGridY).not.toHaveBeenCalled()
    })

    it('center(): drawCenter with a literal 0 moveZ', () => {
      const { g, container } = setupDrawable()

      g.center(container)

      expect(g.drawCenter).toHaveBeenCalledWith(container, g.domain, g.points, null, 0)
      expect(g.drawBaseLine).toHaveBeenCalledWith('center', container)
    })
  })

  describe('static setup()', () => {
    it('returns the original\'s exact default option shape (no `key` field, unlike BlockGrid.setup())', () => {
      expect(FullBlockGrid.setup()).toEqual({
        domain: null,
        reverse: false,
        max: 10,
        hideText: false,
      })
    })
  })
})
