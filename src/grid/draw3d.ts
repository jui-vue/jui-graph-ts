// Port of juijs-graph's `src/grid/draw3d.js` ("chart.grid.draw3d", extend: "chart.draw").
//
// ============================================================================================
// NOT A `CoreGrid` SUBCLASS - a sibling, exactly like `grid/draw2d.ts` (see that file's own header
// comment for the full mechanism/rationale, not repeated in full here).
//
// `grid/draw3d.js` shares `CoreGrid`'s OWN `extend: "chart.draw"` field (confirmed by grep,
// matching `grid/core.ts`'s dependency map) - it does NOT extend `chart.grid.core`. It's the real
// 3D-drawing-method MIXIN `grid/core.ts`'s `drawGrid()` applies onto whichever concrete `CoreGrid`
// instance is being rendered WHEN `this.axis.isFull3D()` is true (`var draw = (isFull3D) ? Draw3D :
// Draw2D; draw.call(this);`), via `registerGridDraw3D()` (the sibling hook to `draw2d.ts`'s
// `registerGridDraw2D()`, both already built and working in `grid/core.ts` since that file landed).
//
// **Same plain-function-closure mixin shape as `draw2d.ts`** (`applyDraw3DGridMixin(target)`,
// building each method as a plain function closing over a local `const self = target as unknown as
// Draw3DTarget`, assigned via `Object.assign(target, {...})` at the bottom) - NOT a class-then-copy
// (would silently copy nothing useful, per `draw2d.ts`'s own documented reasoning). Every internal
// cross-call between these methods goes through `self.methodName(...)`, same late-bound-through-
// the-target-instance discipline `draw2d.ts` already established and tested.
//
// **A real, minor difference from `draw2d.ts` worth flagging explicitly**: every group this file
// creates goes through `this.svg.group()` (i.e. `self.svg`, `Draw`'s OWN top-level `svg: any`
// field) - NOT `this.chart.svg.group()` (`draw2d.ts`'s consistent choice throughout). Both fields
// exist as genuinely separate assignments in the real engine, but `base/axis.ts`'s
// `drawGridType()` (already shipped) sets `obj.svg = this.chart.svg` right after constructing every
// concrete grid instance (`obj.svg = this.chart.svg;`) - so in every real, reachable code path the
// two are literally the SAME object reference at render time. Preserved as `self.svg` verbatim
// (not silently rewritten to `self.chart.svg`) for line-by-line auditability against the original,
// even though it is behaviorally identical today. `CoreGrid`'s own `svg: any` (inherited from
// `Draw`) is narrowed to the real `SVG` class here, the same reconciliation pattern `Draw2DChart`
// already established for `chart.text()`.
//
// Registered via `registerGridDraw3D(applyDraw3DGridMixin)` at the bottom of this file, a
// module-load-time side effect - same self-registering-on-import convention `draw2d.ts` already
// established (there is exactly one real 3D-draw implementation; this project has no "assemble
// everything" bootstrap entry point yet).
//
// ============================================================================================
// PHASE D DEPENDENCY - now satisfied
//
// Needs `polygon/grid.ts`'s `GridPolygon`, `polygon/line.ts`'s `LinePolygon`, and
// `polygon/point.ts`'s `PointPolygon` (all Phase D, now landed - see PORT_STATUS.md's Phase D
// completion writeup) plus `base/draw.ts`'s already-ported `Draw.calculate3d()` (Phase B), inherited
// unchanged by `CoreGrid extends Draw`. `polygon/grid.ts`'s own header comment already read this
// exact file (`drawAxisLine()` below) in full to confirm `GridPolygon`'s public contract ahead of
// time - this port confirms that analysis was accurate: `GridPolygon`'s constructor
// (`type, w, h, d, x, y`), `calculate3d(p)`, and `p.vectors[i].x/.y` are used here EXACTLY as that
// writeup predicted, no surprises.
//
// ============================================================================================
// A REAL, PREVIOUSLY-UNDOCUMENTED BUG: `drawAxisLine()`'s `face` polygon never gets its `points`
// attribute set at all
//
// `drawAxisLine()` builds `face` via `this.svg.polygon({...})` (a `PolyElement`, `util/svg/
// element.poly.ts`, Phase A) and calls `face.point(x, y)` once per rotated vertex - but
// `PolyElement.point()` only pushes into a PRIVATE `orders` array (see `element.poly.ts`'s own
// header/body); the `points` SVG attribute is only ever flushed by `PolyElement.join()`, which
// `drawAxisLine()` NEVER CALLS anywhere in the whole file (confirmed via a full grep of
// `/home/search5/cl/jui-graph/src/grid/draw3d.js` - `join()` does not appear once). Net effect:
// every 3D grid "face" polygon (`drawAxisLine()`'s `top`/`bottom`/`left`/`right`/`center` background
// panels - the visible XY/XZ/YZ quad faces of a 3D grid box) is constructed, rotated, and appended
// to the DOM with FOUR real `.point()` calls recorded internally, but its `points=` attribute is
// simply never written - it renders as an attribute-less `<polygon>` (no visible fill/stroke
// geometry at all, despite `stroke`/`fill`/`fill-opacity` all being set on it). This is a genuine,
// severe, previously-undocumented rendering bug reachable by any real full-3D chart that renders its
// grid faces (i.e. every full-3D grid, since `drawBaseLine()` - called by every concrete grid
// subclass's `top`/`bottom`/`left`/`right`/`center` orient methods, see `block.ts`/`range.ts`/
// `fullblock.ts`/`date.ts` - always routes through `drawAxisLine()`). Preserved exactly (not
// "fixed" by adding a `.join()` call), per Phase 0 rule 6. Tested directly in `draw3d.spec.ts`
// (confirms `face.attr("points")` stays `undefined` after `drawAxisLine()` runs, alongside a
// contrasting explicit `.join()` call proving the SAME accumulated points WOULD have produced a
// real `points` string if the original had called it).
//
// ============================================================================================
// OTHER PRESERVED QUIRKS (Node/hand-verified against the literal original, not "fixed")
//
//   - **`this.axis.get("y").hide` gates the SECOND line/face in every one of `drawAxisLine()`/
//     `drawValueLine()`/`drawValueLineCenter()` - even when the position being drawn is an X-axis
//     position (`top`/`bottom`), never `this.axis.get("x").hide`.** Confirmed identical across all
//     three call sites in the original (`if(this.axis.get("y").hide !== true) { ... }`), no
//     position-conditional branch anywhere. So hiding the X axis (`axis.get("x").hide = true`) has
//     ZERO effect on whether these second lines/faces render; only hiding Y ever suppresses them,
//     regardless of which axis's grid is actually being drawn. Preserved verbatim, tested.
//   - **`drawValueLine(position, axis, isActive, line, index, xy, isLast)`'s `isActive` parameter is
//     declared but never referenced anywhere in the function body** (unlike `draw2d.ts`'s own
//     `drawValueLine`, which genuinely uses `isActive` to pick an active/inactive theme color for
//     the line stroke - the 3D version always uses the same plain `"gridBorderColor"`/
//     `"gridBorderWidth"` theme keys regardless of `isActive`). A real behavioral divergence from
//     the 2D mixin, not a transcription slip - confirmed via a full read of the original body.
//   - **`drawValueText(position, axis, index, xy, domain)`'s `index` parameter is declared but never
//     referenced** - same "declared, unused" shape as `draw2d.ts`'s own `drawValueText` quirk
//     (there it's `index`/`xy` both unused; here only `index` is, since `xy` genuinely IS used to
//     position the text). Also note the 3D `drawValueText` has only 5 parameters in the original
//     (no `move`/`isActive`, unlike the 2D version's 7) - `CoreGrid`'s `drawValueText!` field type
//     (shaped for the 2D mixin's 7-arg call convention, since `drawTop`/`drawBottom`/`drawLeft`/
//     `drawRight` always pass 7 arguments) is still satisfied here: TypeScript allows a function
//     declaring FEWER parameters to satisfy a type requiring more (the extra arguments are simply
//     ignored at the call site, exactly matching plain JS behavior). Preserved 1:1, not padded with
//     unused extra parameters that don't exist in the real original 3D function.
//   - **`drawValueTextCenter(axis, ticks, values, checkActive, moveZ)`'s `values`/`checkActive`
//     parameters are both declared but never referenced inside the function body itself** - `values`
//     is entirely unused (only `ticks`/`d`/`moveZ` drive the loop and `t` computation), and
//     `checkActive` is accepted but never called. Both are still faithfully forwarded from
//     `drawCenter()`'s own call site (`this.drawValueTextCenter(axis, ticks, values, checkActive,
//     moveZ)`), matching the original's own positional-argument-passing exactly even though the
//     callee itself ignores two of the five.
//   - **`drawPattern`/`drawImage` are both literal no-ops** (`function() {}`), matching the original
//     exactly - a full-3D grid never draws a background pattern OR a per-tick image, regardless of
//     `grid.image`/a `line.type` containing `"gradient"`/`"rect"` being configured (those only ever
//     apply in the 2D mixin). Confirmed intentional (not a stub the original meant to fill in later)
//     by the total absence of any TODO/comment suggesting otherwise.
//   - `createGridX`/`createGridY` build their `axis` group via a bare `this.svg.group()` with NO
//     `.translate(...)` call (unlike `draw2d.ts`'s `createGridX`/`createGridY`, which translate the
//     group to the tick's `x`/`y` position immediately) - 3D positioning instead happens per-vertex,
//     inside `drawValueLine`'s own `LinePolygon`/`calculate3d()` pipeline (each line's endpoints are
//     built in absolute axis-area coordinates, not relative to a translated group). Preserved
//     verbatim - not an omission relative to the 2D mixin, a genuinely different positioning
//     strategy.
//
// ============================================================================================
// CROSS-CHECK NOTE (per this task's own instruction to glance at jui-chart-vue's brush-level 3D
// cross-checks for consistency, even though they're not this grid-level file's own oracle)
//
// This file's ENTIRE 3D transform pipeline is exactly the same `self.calculate3d(...)` call
// (`base/draw.ts`, Phase B) every other 3D consumer in this engine uses - already cross-checked
// exhaustively against jui-chart-vue's `usePolygon3d.ts`/`dot3d.js`/`column3d.js`/`line3d.js`/
// `rotate3d.js` Phase E writeups in `base/draw.ts`'s own header comment and `polygon/core.ts`'s
// header comment (the `Math.max(w,h,d)` depth-vs-`axis.depth/2`-center distinction, the float32
// precision note, etc.) - nothing new to re-derive at this grid level; this file is simply another
// real caller of that same, already-verified pipeline, via `GridPolygon`/`LinePolygon`/
// `PointPolygon` (Phase D) instead of `dot3d.js`'s `vertex()`/`cubeVertices()` stand-ins. No
// discrepancy found, consistent with every prior cross-check.
import { registerGridDraw3D } from './core'
import type { CoreGrid, GridChart } from './core'
import type { TransElement } from '../util/svg/element.transform'
import type { SVG } from '../util/svg'
import { GridPolygon } from '../polygon/grid'
import { LinePolygon } from '../polygon/line'
import { PointPolygon } from '../polygon/point'

/** Same local shape `draw2d.ts` already established for `getLineOption()`'s truthy return value. */
interface GridLineOption {
  type: string
  fill?: unknown
  [key: string]: unknown
}

/** `chart.text()` isn't part of what `axis.js`/`grid/core.js` themselves call - same reconciliation
 * `draw2d.ts`'s own `Draw2DChart` already established (real, already-present `Builder.text()`
 * surface, confirmed there - reused here rather than re-deriving). */
type Draw3DChart = GridChart & {
  text(attr: Record<string, unknown>, content?: unknown): TransElement
}

/** The mixin-internal methods `grid/core.ts`'s `CoreGrid` does NOT declare fields for (only
 * `createGridX`/`createGridY`/`drawImage`/`drawValueText` are, matching `CoreGrid`'s own method
 * needs) - these exist to support those, and to be directly callable by future `grid/*.ts` leaf
 * subclasses (e.g. `block.ts`/`range.ts`/`fullblock.ts`/`date.ts`, already landed and already
 * declaring their own `drawCenter!`/`drawBaseLine!` definite-assignment fields for exactly this
 * purpose) when `axis.isFull3D()` is true. */
interface Draw3DTargetExtra {
  drawCenter(g: TransElement, ticks: unknown[], values: number[], checkActive: ((tick: unknown) => boolean) | null, moveZ: number): void
  drawBaseLine(position: string, g: TransElement): void
  drawAxisLine(position: string, axis: TransElement): void
  drawValueLine(position: string, axis: TransElement, isActive: boolean, line: GridLineOption, index: number, xy: number, isLast: boolean): void
  drawValueLineCenter(axis: TransElement, ticks: unknown[], line: GridLineOption): void
  drawValueTextCenter(axis: TransElement, ticks: unknown[], values: number[], checkActive: ((tick: unknown) => boolean) | null, moveZ: number): void
}

type Draw3DTarget = CoreGrid & Draw3DTargetExtra & { chart: Draw3DChart; svg: SVG }

/**
 * Applies `Draw3DGrid`'s method set onto a real `CoreGrid` instance - see this file's header
 * comment for the shape rationale (shared with `draw2d.ts`) and every preserved bug/quirk.
 * Satisfies `grid/core.ts`'s exported `GridDrawMixinApplier` type exactly.
 */
export function applyDraw3DGridMixin(target: CoreGrid): void {
  const self = target as unknown as Draw3DTarget

  const createGridX = (position: string, index: number, x: number, isActive: boolean, isLast: boolean): TransElement => {
    const line = self.getLineOption() as GridLineOption | false
    const axis = self.svg.group()

    if (line) {
      self.drawValueLine(position, axis, isActive, line, index, x, isLast)
    }

    return axis
  }

  const createGridY = (position: string, index: number, y: number, isActive: boolean, isLast: boolean): TransElement => {
    const line = self.getLineOption() as GridLineOption | false
    const axis = self.svg.group()

    if (line) {
      self.drawValueLine(position, axis, isActive, line, index, y, isLast)
    }

    return axis
  }

  /**
   * @method drawCenter
   * draw center (z-axis) - the `"center"` orient method every full-3D-capable `CoreGrid` subclass's
   * own `center(g)` calls into (e.g. `block.ts`/`range.ts`/`fullblock.ts`/`date.ts`'s
   * `this.drawCenter(g, ...)`).
   */
  const drawCenter = (
    g: TransElement,
    ticks: unknown[],
    values: number[],
    checkActive: ((tick: unknown) => boolean) | null,
    moveZ: number,
  ): void => {
    const axis = self.svg.group()
    const line = self.getLineOption() as GridLineOption | false

    if (line) {
      self.drawValueLineCenter(axis, ticks, line)
    }

    self.drawValueTextCenter(axis, ticks, values, checkActive, moveZ)

    g.append(axis)
  }

  const drawBaseLine = (position: string, g: TransElement): void => {
    const axis = self.svg.group()
    self.drawAxisLine(position, axis)
    g.append(axis)
  }

  /**
   * @method drawAxisLine
   * theme 이 적용된 axis line 리턴 (returns a themed axis line/face). Builds the grid's background
   * "face" quad (via `GridPolygon`, Phase D) and appends it as an SVG `<polygon>` - see this file's
   * header comment for the preserved `face.join()`-never-called bug (the `points` attribute is
   * never actually written).
   */
  const drawAxisLine = (position: string, axis: TransElement): void => {
    const isTopOrBottom = position === 'top' || position === 'bottom'
    let borderColor = isTopOrBottom ? 'gridXAxisBorderColor' : 'gridYAxisBorderColor'
    let borderWidth = isTopOrBottom ? 'gridXAxisBorderWidth' : 'gridYAxisBorderWidth'

    if (position === 'center') {
      borderColor = 'gridZAxisBorderColor'
      borderWidth = 'gridZAxisBorderWidth'
    }

    const face = self.svg.polygon({
      stroke: self.chart.theme(borderColor),
      'stroke-width': self.chart.theme(borderWidth),
      'stroke-opacity': 1,
      fill: self.chart.theme('gridFaceBackgroundColor'),
      'fill-opacity': self.chart.theme('gridFaceBackgroundOpacity'),
    })

    let p: GridPolygon
    let w = self.axis.area('width')
    let h = self.axis.area('height')
    const x = self.axis.area('x')
    const y = self.axis.area('y')
    const d = self.axis.depth

    if (position === 'center') {
      p = new GridPolygon('center', w, h, d, x, y)
    } else if (isTopOrBottom) {
      h = position === 'bottom' ? h : 0
      p = new GridPolygon('horizontal', w, h, d, x, y)
    } else {
      w = position === 'right' ? w : 0
      p = new GridPolygon('vertical', w, h, d, x, y)
    }

    // 사각면 위치 계산 및 추가 (compute quad-face position and add it)
    self.calculate3d(p)
    for (let i = 0; i < p.vectors!.length; i++) {
      face.point(p.vectors![i].x, p.vectors![i].y)
    }
    // NOTE: the original never calls `face.join()` here - see this file's header comment for the
    // preserved bug this reproduces (the `points` attribute is never actually written).

    // Y축이 숨김 상태일 때 (when the Y axis is hidden) - see header comment's "Y-only gate" quirk.
    if (position === 'center') {
      if ((self.axis.get('y') as Record<string, unknown>).hide !== true) {
        axis.append(face)
      }
    } else {
      axis.append(face)
    }
  }

  const drawValueLine = (
    position: string,
    axis: TransElement,
    _isActive: boolean,
    line: GridLineOption,
    index: number,
    xy: number,
    isLast: boolean,
  ): void => {
    // `_isActive`: declared but never referenced in the original either - see header comment.
    let isDrawLine = false
    const w = self.axis.area('width')
    const h = self.axis.area('height')
    const x = self.axis.area('x')
    const y = self.axis.area('y')
    const d = self.axis.depth
    let l1: LinePolygon | null = null
    let l2: LinePolygon | null = null

    if (position === 'top') {
      isDrawLine = self.checkDrawLineY(index, isLast)
      l1 = new LinePolygon(xy, y, 0, xy, y, d)
      l2 = new LinePolygon(xy, y, d, xy, y + h, d)
    } else if (position === 'bottom') {
      isDrawLine = self.checkDrawLineY(index, isLast)
      l1 = new LinePolygon(xy, y + h, 0, xy, y + h, d)
      l2 = new LinePolygon(xy, y + h, d, xy, y, d)
    } else if (position === 'left') {
      isDrawLine = self.checkDrawLineX(index, isLast)
      l1 = new LinePolygon(x, xy, 0, x, xy, d)
      l2 = new LinePolygon(x, xy, d, x + w, xy, d)
    } else if (position === 'right') {
      isDrawLine = self.checkDrawLineX(index, isLast)
      l1 = new LinePolygon(x + w, xy, 0, x + w, xy, d)
      l2 = new LinePolygon(x + w, xy, d, x, xy, d)
    }

    if (isDrawLine) {
      // 폴리곤 계산 (compute the polygon)
      self.calculate3d(l1!, l2!)

      const lo1 = self.line({
        stroke: self.chart.theme('gridBorderColor'),
        'stroke-width': self.chart.theme('gridBorderWidth'),
        x1: l1!.vectors![0].x,
        y1: l1!.vectors![0].y,
        x2: l1!.vectors![1].x,
        y2: l1!.vectors![1].y,
      })

      const lo2 = self.line({
        stroke: self.chart.theme('gridBorderColor'),
        'stroke-width': self.chart.theme('gridBorderWidth'),
        x1: l2!.vectors![0].x,
        y1: l2!.vectors![0].y,
        x2: l2!.vectors![1].x,
        y2: l2!.vectors![1].y,
      })

      if (line.type.indexOf('dashed') > -1) {
        const dash = self.chart.theme('gridBorderDashArray')
        const style = dash === 'none' || !dash ? '3,3' : dash
        lo1.attr({ 'stroke-dasharray': style })
        lo2.attr({ 'stroke-dasharray': style })
      }

      axis.append(lo1)

      // Y축이 숨김 상태가 아닐 때만 추가 (only add lo2 when Y is not hidden) - see header comment.
      if ((self.axis.get('y') as Record<string, unknown>).hide !== true) {
        axis.append(lo2)
      }
    }
  }

  const drawValueLineCenter = (axis: TransElement, ticks: unknown[], line: GridLineOption): void => {
    const len = self.grid.type !== 'block' ? ticks.length - 1 : ticks.length
    const w = self.axis.area('width')
    const h = self.axis.area('height')
    const x = self.axis.area('x')
    const y = self.axis.area('y')
    const d = self.axis.depth
    const dx = (self.axis.get('y') as Record<string, unknown>).orient === 'left' ? 0 : w
    const dy = (self.axis.get('x') as Record<string, unknown>).orient === 'top' ? 0 : h

    // z축 라인 드로잉 (draw the z-axis lines)
    for (let i = 1; i < len; i++) {
      const t = i * (d / len)
      const p1 = new LinePolygon(x, y + dy, t, x + w, y + dy, t)
      const p2 = new LinePolygon(x + dx, y, t, x + dx, y + h, t)

      self.calculate3d(p1, p2)

      const lo1 = self.line({
        stroke: self.chart.theme('gridBorderColor'),
        'stroke-width': self.chart.theme('gridBorderWidth'),
        x1: p1.vectors![0].x,
        y1: p1.vectors![0].y,
        x2: p1.vectors![1].x,
        y2: p1.vectors![1].y,
      })

      const lo2 = self.line({
        stroke: self.chart.theme('gridBorderColor'),
        'stroke-width': self.chart.theme('gridBorderWidth'),
        x1: p2.vectors![0].x,
        y1: p2.vectors![0].y,
        x2: p2.vectors![1].x,
        y2: p2.vectors![1].y,
      })

      if (line.type.indexOf('dashed') > -1) {
        const dash = self.chart.theme('gridBorderDashArray')
        const style = dash === 'none' || !dash ? '3,3' : dash
        lo1.attr({ 'stroke-dasharray': style })
        lo2.attr({ 'stroke-dasharray': style })
      }

      axis.append(lo1)

      // Y축이 숨김 상태가 아닐 때만 추가 (only add lo2 when Y is not hidden).
      if ((self.axis.get('y') as Record<string, unknown>).hide !== true) {
        axis.append(lo2)
      }
    }
  }

  // `_index`: declared but never referenced in the original either - see header comment. The
  // original 3D `drawValueText` takes only 5 parameters (no `move`/`isActive`, unlike the 2D
  // mixin's 7) - `CoreGrid.drawValueText!`'s wider field type is still satisfied (fewer declared
  // params legally satisfy a type expecting more, per ordinary function assignability).
  const drawValueText = (position: string, axis: TransElement, _index: number, xy: number, domain: unknown): void => {
    if (self.grid.hideText) return

    const isVertical = position === 'left' || position === 'right'
    const tickSize = self.chart.theme('gridTickBorderSize') as number
    const tickPadding = self.chart.theme('gridTickPadding') as number
    const w = self.axis.area('width')
    const h = self.axis.area('height')
    const dx = self.axis.area('x')
    const dy = self.axis.area('y')
    let x = 0
    let y = 0

    if (position === 'top') {
      x = xy
      y = dy + -(tickSize + tickPadding * 2)
    } else if (position === 'bottom') {
      x = xy
      y = dy + (h + tickSize + tickPadding * 2)
    } else if (position === 'left') {
      x = dx + -(tickSize + tickPadding)
      y = xy
    } else if (position === 'right') {
      x = dx + (w + tickSize + tickPadding)
      y = xy
    }

    const p = new PointPolygon(x, y, 0)
    self.calculate3d(p)

    axis.append(
      self.getTextRotate(
        self.chart.text(
          {
            x: p.vectors![0].x,
            y: p.vectors![0].y,
            dx: !isVertical ? (self.chart.theme('gridXFontSize') as number) / 3 : 0,
            dy: isVertical ? (self.chart.theme('gridYFontSize') as number) / 3 : 0,
            fill: self.chart.theme(isVertical ? 'gridYFontColor' : 'gridXFontColor'),
            'text-anchor': isVertical ? (position === 'left' ? 'end' : 'start') : 'middle',
            'font-size': self.chart.theme(isVertical ? 'gridYFontSize' : 'gridXFontSize'),
            'font-weight': self.chart.theme(isVertical ? 'gridYFontWeight' : 'gridXFontWeight'),
          },
          domain,
        ),
      ),
    )
  }

  // `_values`/`_checkActive`: declared but never referenced inside this function's own body in the
  // original either (both still faithfully forwarded from `drawCenter()`'s call site) - see header
  // comment.
  const drawValueTextCenter = (
    axis: TransElement,
    ticks: unknown[],
    _values: number[],
    _checkActive: ((tick: unknown) => boolean) | null,
    moveZ: number,
  ): void => {
    if (self.grid.hideText) return

    const margin = (self.chart.theme('gridTickBorderSize') as number) + (self.chart.theme('gridTickPadding') as number)
    const isLeft = (self.axis.get('y') as Record<string, unknown>).orient === 'left'
    const isTop = (self.axis.get('x') as Record<string, unknown>).orient === 'top'
    const len = self.grid.type !== 'block' ? ticks.length - 1 : ticks.length
    const w = self.axis.area('width')
    const h = self.axis.area('height')
    const d = self.axis.depth
    const x = self.axis.area('x') + (isLeft ? w + margin : -margin)
    const y = self.axis.area('y') + (isTop ? -margin : h + margin)

    // z축 라인 드로잉 (draw the z-axis text labels)
    for (let i = 0; i < ticks.length; i++) {
      const domain = self.format(ticks[i], i)
      const t = i * (d / len) + moveZ
      const p = new PointPolygon(x, y, t)

      self.calculate3d(p)

      axis.append(
        self.getTextRotate(
          self.chart.text(
            {
              x: p.vectors![0].x,
              y: p.vectors![0].y,
              fill: self.chart.theme('gridZFontColor'),
              'text-anchor': isLeft ? 'start' : 'end',
              'font-size': self.chart.theme('gridZFontSize'),
              'font-weight': self.chart.theme('gridZFontWeight'),
            },
            domain,
          ),
        ),
      )
    }
  }

  const drawPattern = (): void => {}
  const drawImage = (): void => {}

  Object.assign(target, {
    createGridX,
    createGridY,
    drawCenter,
    drawBaseLine,
    drawAxisLine,
    drawValueLine,
    drawValueLineCenter,
    drawValueText,
    drawValueTextCenter,
    drawPattern,
    drawImage,
  })
}

registerGridDraw3D(applyDraw3DGridMixin)
