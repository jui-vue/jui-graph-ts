import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BlockGrid } from './block'
import type { Axis, AxisChart, AreaBox } from '../base/axis'
import type { GridChart } from './core'
import { SVG } from '../util/svg'
import type { TransElement } from '../util/svg/element.transform'

// Same test-double conventions `grid/core.spec.ts` already established.

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
  depth?: number
  degree?: { x: number; y: number; z: number }
  isFull3D?: boolean
  data?: unknown[]
}

function makeAxisStub(opts: AxisStubOptions = {}): Axis {
  const area: AreaBox = opts.area ?? { x: 0, y: 0, x2: 400, y2: 300, width: 400, height: 300 }
  const stub = {
    area: ((key?: string) => (key ? (area as any)[key] : area)) as Axis['area'],
    depth: opts.depth ?? 0,
    degree: opts.degree ?? { x: 0, y: 0, z: 0 },
    isFull3D: () => opts.isFull3D ?? false,
    data: opts.data ?? [],
    get: (type: string) => (type === 'x' || type === 'y' ? { hide: false, orient: type === 'x' ? 'bottom' : 'left' } : undefined),
  }
  return stub as unknown as Axis
}

function makeGrid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { orient: 'bottom', type: 'block', domain: null, reverse: false, max: 10, hideText: false, key: null, ...overrides }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

function makeBlockGrid(): BlockGrid {
  const g = new BlockGrid()
  const { chart } = makeChart()
  g.chart = chart
  g.grid = makeGrid() as any
  g.axis = makeAxisStub()
  return g
}

describe('BlockGrid', () => {
  describe('initDomain', () => {
    it('string domain: resolves the field per data row in forward order', () => {
      const g = makeBlockGrid()
      g.axis = makeAxisStub({ data: [{ f: 'a' }, { f: 'b' }, { f: 'c' }] })
      g.grid = makeGrid({ domain: 'f', reverse: false }) as any

      expect(g.initDomain()).toEqual(['a', 'b', 'c'])
    })

    it(
      'PRESERVED BUG: `grid.reverse` is a NO-OP for a string domain - the backward-iterating loop ' +
        'and the final unconditional domain.reverse() cancel each other out exactly',
      () => {
        const g = makeBlockGrid()
        g.axis = makeAxisStub({ data: [{ f: 'a' }, { f: 'b' }, { f: 'c' }] })
        g.grid = makeGrid({ domain: 'f', reverse: true }) as any

        // Same final result as reverse:false above - NOT ['c','b','a'].
        expect(g.initDomain()).toEqual(['a', 'b', 'c'])
      },
    )

    it('function domain: reverse DOES have a real, single-reversal effect (unlike the string-domain branch)', () => {
      const g = makeBlockGrid()
      const domainFn = vi.fn(function (this: unknown) {
        return [1, 2, 3]
      })

      g.grid = makeGrid({ domain: domainFn, reverse: false }) as any
      expect(g.initDomain()).toEqual([1, 2, 3])

      g.grid = makeGrid({ domain: domainFn, reverse: true }) as any
      expect(g.initDomain()).toEqual([3, 2, 1])
      expect(domainFn.mock.instances[0]).toBe(g.chart)
    })

    it('array domain: used directly, reversed in place when grid.reverse is set', () => {
      const g = makeBlockGrid()
      g.grid = makeGrid({ domain: [1, 2, 3], reverse: true }) as any

      expect(g.initDomain()).toEqual([3, 2, 1])
    })

    it('unrecognized domain (null/other) resolves to an empty array', () => {
      const g = makeBlockGrid()
      g.grid = makeGrid({ domain: null }) as any
      expect(g.initDomain()).toEqual([])
    })
  })

  describe('wrapper', () => {
    it('key falsy: returns the raw scale unchanged (new_scale is never even built)', () => {
      const g = makeBlockGrid()
      // `wrapper()` unconditionally reads `self.domain.length` up front (real original behavior
      // too, matching `drawGrid()`'s real call order: `wrapper()` always runs after
      // `drawBefore()` has set `this.domain`) - set here purely so this key-falsy case doesn't
      // trip over an unrelated precondition.
      g.domain = []
      const scale = ((t: unknown) => t) as any
      expect(g.wrapper(scale, undefined)).toBe(scale)
    })

    it('key set + numeric index: looks up axis.data[i][key] through the old scale', () => {
      const g = makeBlockGrid()
      g.axis = makeAxisStub({ data: [{ v: 'x' }, { v: 'y' }] })
      g.domain = ['a', 'b']
      g.grid = makeGrid({ reverse: false }) as any

      const oldScale = vi.fn((v: unknown) => `scaled(${v})`) as any
      const wrapped = g.wrapper(oldScale, 'v')

      expect(wrapped(1)).toBe('scaled(y)')
      expect(oldScale).toHaveBeenCalledWith('y')
    })

    it('key set + numeric index: copies old_scale\'s own properties onto the wrapped function (Object.assign-equivalent)', () => {
      const g = makeBlockGrid()
      g.axis = makeAxisStub({ data: [{ v: 'x' }] })
      g.domain = ['a']

      const oldScale = ((t: unknown) => t) as any
      oldScale.rangeBand = () => 42
      const wrapped = g.wrapper(oldScale, 'v') as any

      expect(wrapped.rangeBand()).toBe(42)
    })

    it(
      'DEAD-CODE PRESERVED: the reverse-index branch only runs for a non-numeric `i`, which no real ' +
        'caller in this engine ever passes - exercised here via direct invocation',
      () => {
        const g = makeBlockGrid()
        g.axis = makeAxisStub({ data: [] })
        g.domain = ['a', 'b', 'c', 'd']
        g.grid = makeGrid({ reverse: true }) as any

        const oldScale = vi.fn((v: unknown) => v) as any
        const wrapped = g.wrapper(oldScale, 'somekey') as any

        // non-numeric `i` (e.g. undefined) falls through to the reverse-handling else branch:
        // `reverse ? len - i - 1 : i` with `i` coerced by `-` to NaN - `len - NaN - 1` is NaN.
        wrapped(undefined)
        expect(oldScale).toHaveBeenCalledWith(NaN)
      },
    )
  })

  describe('drawBefore', () => {
    it('sets up an ordinal rangePoints scale from initDomain()/getGridSize()', () => {
      const g = makeBlockGrid()
      g.axis = makeAxisStub({ area: { x: 0, y: 0, x2: 400, y2: 300, width: 400, height: 300 } })
      g.grid = makeGrid({ domain: ['a', 'b', 'c', 'd'], orient: 'bottom' }) as any

      g.drawBefore()

      expect(g.start).toBe(0)
      expect(g.end).toBe(400)
      expect(g.size).toBe(400)
      expect(g.domain).toEqual(['a', 'b', 'c', 'd'])
      expect(g.points).toEqual([50, 150, 250, 350])
      expect(g.band).toBe(100)
      expect(g.half_band).toBe(50)
      expect(g.bar).toBe(6)
      expect(g.reverse).toBe(false)
    })

    it('propagates grid.reverse onto this.reverse (stored, not read elsewhere in this port - see header comment)', () => {
      const g = makeBlockGrid()
      g.grid = makeGrid({ domain: ['a', 'b'], reverse: true }) as any

      g.drawBefore()
      expect(g.reverse).toBe(true)
    })
  })

  describe('draw', () => {
    it('calls drawGrid() with zero arguments (the original\'s "block" argument was always dead code)', () => {
      const g = makeBlockGrid()
      const spy = vi.spyOn(g, 'drawGrid').mockReturnValue({ root: {} as TransElement, scale: null })

      const result = g.draw()

      expect(spy).toHaveBeenCalledWith()
      expect(result.scale).toBeNull()
    })
  })

  describe('orient methods (top/bottom/left/right/center)', () => {
    function setupDrawable() {
      const g = makeBlockGrid()
      g.domain = ['a', 'b', 'c']
      g.points = [10, 20, 30]
      g.end = 40
      g.half_band = 5

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

    it('top(): draws pattern (isMove=true), drawTop with half_band as moveX, base line, then a trailing boundary tick', () => {
      const { g, container } = setupDrawable()

      g.top(container)

      expect(g.drawPattern).toHaveBeenCalledWith('top', g.domain, g.points, true)
      expect(g.drawTop).toHaveBeenCalledWith(container, g.domain, g.points, null, 5)
      expect(g.drawBaseLine).toHaveBeenCalledWith('top', container)
      // Trailing boundary tick: index = domain.length, x = this.end, isActive = null (preserved), isLast = true.
      expect(g.createGridX).toHaveBeenCalledWith('top', 3, 40, null, true)
    })

    it('bottom()/left()/right() mirror top() with their own draw*/createGrid* methods', () => {
      const { g, container } = setupDrawable()

      g.bottom(container)
      expect(g.drawBottom).toHaveBeenCalledWith(container, g.domain, g.points, null, 5)
      expect(g.createGridX).toHaveBeenCalledWith('bottom', 3, 40, null, true)

      g.left(container)
      expect(g.drawLeft).toHaveBeenCalledWith(container, g.domain, g.points, null, 5)
      expect(g.createGridY).toHaveBeenCalledWith('left', 3, 40, null, true)

      g.right(container)
      expect(g.drawRight).toHaveBeenCalledWith(container, g.domain, g.points, null, 5)
      expect(g.createGridY).toHaveBeenCalledWith('right', 3, 40, null, true)
    })

    it('center(): draws via drawCenter(half_band as moveZ) + drawBaseLine, no trailing boundary tick', () => {
      const { g, container } = setupDrawable()

      g.center(container)

      expect(g.drawCenter).toHaveBeenCalledWith(container, g.domain, g.points, null, 5)
      expect(g.drawBaseLine).toHaveBeenCalledWith('center', container)
      expect(g.createGridX).not.toHaveBeenCalled()
      expect(g.createGridY).not.toHaveBeenCalled()
    })
  })

  describe('static setup()', () => {
    it('returns the original\'s exact default option shape', () => {
      expect(BlockGrid.setup()).toEqual({
        domain: null,
        reverse: false,
        max: 10,
        hideText: false,
        key: null,
      })
    })
  })
})
