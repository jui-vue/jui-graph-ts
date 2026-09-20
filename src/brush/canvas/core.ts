// Port of juijs-graph's `src/brush/canvas/core.js` (`chart.brush.canvas.core`, `extend:
// "chart.brush.core"`).
//
// ============================================================================================
// EXTEND CHAIN - CONFIRMED FROM SOURCE, not assumed: `brush/canvas/core.js` line 5, `extend:
// "chart.brush.core"` -> `src/brush/core.ts`'s `CoreBrush` (itself `extends Draw`, per that
// file's own header comment). So the real chain is `CanvasCoreBrush extends CoreBrush extends
// Draw`, matching this task's own assignment framing exactly ("all confirmed extends
// chart.brush.core"). `CanvasCoreBrush`'s own constructor function takes ZERO parameters, same
// externally-wired-after-construction shape `CoreBrush`/`CoreGrid`/`CoreWidget` already
// established (`base/builder.ts`'s `drawBrush()` wires `chart`/`axis`/`brush`/`svg`/`canvas` onto
// the instance post-`new`).
//
// ============================================================================================
// CROSS-CHECK AGAINST jui-chart-vue's `ChartCanvasBase.vue`/`useCanvasChart.ts` (Phase E's
// hand-built canvas infrastructure, built WITHOUT access to this real source) - this task's own
// central verification job, read against the real 45-line source in full before writing any code
// here:
//
//   CORRECTED, decisively: `ChartCanvasBase.vue`/`useCanvasChart.ts` invented their entire
//   surface independently and got NONE of it from this file (or from `chart.brush.core`/
//   `util.canvas.base`, all three checked). jui-chart-vue's own PORT_STATUS.md (~L4944-4955
//   there) already reached the right conclusion from indirect evidence ("`util.canvas.base`
//   provides NONE of: devicePixelRatio/retina handling..., requestAnimationFrame/animation-loop
//   scheduling... confirmed absent by grepping the ENTIRE jui-chart + juijs-graph tree") - this
//   task now confirms it DIRECTLY by reading `chart.brush.canvas.core` itself (the one file that
//   name plausibly WOULD have lived in, given its "core" suffix and canvas-adjacent name): it is
//   45 lines total, contains ZERO canvas-context handling, ZERO DPI/devicePixelRatio logic, and
//   ZERO RAF-loop/animation scheduling of ANY kind. `useCanvasChart.ts`'s DPI-scaled backing-store
//   sizing and `useAnimationFrameLoop`'s `requestAnimationFrame` delta-clamping are both
//   ENTIRELY jui-chart-vue's own from-scratch invention, solving a real problem (a canvas
//   component needs SOME sizing/redraw-scheduling story) that the real upstream engine leaves
//   to individual concrete brush files (e.g. `activebubble.js`'s own `drawBefore()`/`draw()`
//   pairing, per that file's own Phase E writeup) and to `ChartCanvasBase.vue`'s Vue-specific
//   lifecycle wiring - there is no missing "real" canvas-infra file this port should have
//   surfaced instead; jui-chart-vue's invented solution stands uncontradicted, just unconnected
//   to any real upstream source.
//
//   WHAT THIS FILE ACTUALLY ADDS OVER `CoreBrush` (confirmed from its full 45 lines, NOT canvas
//   context/DPI handling at all): exactly two methods, `addPolygon(polygon, callback)` and
//   `drawAfter()` - a private per-instance `this.polygons` queue + a BACK-TO-FRONT Z-SORT applied
//   once per render, purely for the hand-rolled 3D canvas brushes (`dot3d.js`, confirmed by
//   jui-chart-vue's own writeup at ~L5600 there: "the FIRST canvas brush in this phase that
//   actually EXERCISES `chart.brush.canvas.core`'s `addPolygon()`/`drawAfter()`" - every other
//   canvas brush jui-chart-vue ported, `activebubble.js`/`bubblecloud.js`/`activecircle.js`/
//   `equalizercolumn.js`, leaves both dead, confirmed by grep in each of their own writeups).
//   `addPolygon()` calls `this.calculate3d(polygon)` (the SAME `Draw.calculate3d()` method
//   `dot3d.js` uses directly and `column3d.js`/`line3d.js` use via the SIBLING
//   `chart.brush.polygon.core` base - see that file's own port below) then queues `{polygon,
//   order: this.axis.depth - polygon.max().z, handler: callback}`. `drawAfter()` sorts that queue
//   ascending by `.order` and drains it (`list.shift()`) calling each `handler.call(this,
//   polygon)` - i.e. lets EACH concrete brush's own `addPolygon()` callback do the actual canvas
//   drawing, in back-to-front z order, all deferred until `render()`'s own `drawAfter` hook fires
//   (see `base/draw.ts`'s `render()`, already ported: `drawAfter` runs AFTER `draw()`/
//   `drawAnimate()`, unconditionally if defined).
//
//   A REAL, PREVIOUSLY-UNDOCUMENTED BEHAVIOR THIS CROSS-CHECK SURFACES (not caught by
//   jui-chart-vue, which never had this file to read): `CanvasCoreBrush.drawAfter()` COMPLETELY
//   REPLACES/SHADOWS `CoreBrush.drawAfter()` - it does NOT call it, extend it, or reproduce any
//   part of its clip-path/CSS-class/origin-translate wiring (`obj.attr({"clip-path": ...})`;
//   `obj.attr({class: "brush-" + this.brush.type})`; `obj.translate(chart.area("x"),
//   chart.area("y"))` - see `brush/core.ts`'s own `drawAfter`). Confirmed by the exact
//   assignment-order semantics the original's own constructor-chain produces: `CoreBrush`'s
//   constructor sets `this.drawAfter = function(obj) {...clip/translate...}` FIRST (superclass
//   constructor runs first under the real `extend`/`inherit()` machinery); `CanvasCoreBrush`'s OWN
//   constructor then runs SECOND and reassigns `this.drawAfter = function() {...polygon
//   sort/drain...}`, clobbering the first assignment outright (same `this.foo = ...` semantics
//   every other `component: function(){ var Ctor = function(){ this.x = ...; } }` file in this
//   whole engine uses - there is no `super.drawAfter()`-style composition anywhere in the
//   original). Ported here as a real ES class field with the exact same shadow-not-compose
//   semantics: `CanvasCoreBrush` redeclares its OWN `drawAfter` arrow-function class field (does
//   NOT call `super.drawAfter`), which a real ES `class extends` subclass field initializer runs
//   strictly AFTER `super()` completes - reproducing the identical "later assignment wins, no
//   trace of the earlier one" behavior byte-faithfully. **Practical consequence, preserved not
//   fixed**: any concrete `chart.brush.canvas.core`-derived leaf brush (e.g. a future `dot3d`
//   port) gets NO automatic clip-path/CSS-class/origin-translate from the base wiring at all -
//   each polygon `handler` callback is fully responsible for translating/clipping its own drawn
//   shapes to the chart's plot-area origin itself if it needs that (canvas brushes typically draw
//   directly against already-axis-resolved pixel coordinates instead, sidestepping the need - but
//   the base class provides zero help either way, unlike the plain SVG `CoreBrush` path).
// ============================================================================================
//
// `addPolygon()`'s array-reinitialization guard, Node/hand-verified against the literal source
// (`if(!_.typeCheck("array", this.polygons)) { this.polygons = []; }`): re-checked on EVERY call,
// not just the first - functionally equivalent to a lazy `this.polygons ??= []` init (an existing
// non-empty array is left untouched, a genuinely-non-array value of any kind - including
// `undefined`, the field's un-set state - gets reset to `[]`), ported as the same
// `Array.isArray(this.polygons) ? ... : (this.polygons = [])` guard rather than simplified to
// `??=`, since a POST-first-render `this.polygons` value that is truthy-but-not-an-array (e.g. a
// leaf class deliberately/accidentally overwriting it with something else) is a real, if unlikely,
// distinguishable case in the original this port keeps faithful to.
//
// `drawAfter()`'s drain loop, Node/hand-verified: `for(i=0,len=list.length; i<len; i++) { var p =
// list.shift(); ... }` - `len` is captured ONCE before the loop starts, then `list.shift()` is
// called `len` times, each time removing (and reading) the CURRENT first element of the
// (shrinking) array. Since nothing else mutates `list` mid-loop, this drains the array completely,
// front-to-back of the ALREADY-SORTED order - equivalent in final effect to iterating the sorted
// array directly without mutating it, but ported literally (mutating `this.polygons` down to `[]`
// as a side effect of `drawAfter()` running, same as the original) rather than "simplified" to a
// non-mutating `for...of`, since a re-render's own next `addPolygon()` calls need to see a
// genuinely-emptied array to start their own count from `0`, and the original's own `.sort()`
// mutates `list` (`=== this.polygons`) in place before the drain even starts.
// ============================================================================================

import { CoreBrush } from "../core";

/** Minimal shape `addPolygon()`/`drawAfter()` need from a queued 3D polygon primitive - the real
 * type is `polygon.core`'s `PolygonCore` (Phase D, already ported to `src/polygon/core.ts`) or any
 * of its subclasses (`PointPolygon`/`LinePolygon`/`CubePolygon`/`FacePolygon`, per
 * `PORT_STATUS.md`'s cross-check with `dot3d.js`/`column3d.js`/`line3d.js`'s own writeups) -
 * anything satisfying `Draw.calculate3d()`'s own `Rotatable` shape (`perspective`/`rotate()`) AND
 * exposing `max(): {x,y,z}` for the z-sort below. Kept as a small structural interface here
 * (rather than importing `PolygonCore` directly) since `Draw.calculate3d()` itself already only
 * requires the `Rotatable` subset - this file adds exactly the one extra member (`max()`) it
 * itself needs on top of that, matching the real source's own total lack of a concrete polygon
 * type import (plain JS, no type dependency on `polygon/core.js` at all - `calculate3d`/`max()`
 * are simply called on whatever object is handed in). */
export interface CanvasPolygon {
  perspective: unknown;
  rotate(depth: number, degree: unknown, cx: number, cy: number, cz: number): void;
  max(): { x: number; y: number; z: number };
}

/** `addPolygon()`'s queued-entry shape (`this.polygons[i]` in the original). */
export interface CanvasPolygonEntry<P extends CanvasPolygon = CanvasPolygon> {
  polygon: P;
  /** `this.axis.depth - polygon.max().z` - a SMALLER `order` means FARTHER from the viewer at
   * `z = axis.depth` (drawn first, i.e. behind everything drawn later), matching `drawAfter()`'s
   * ascending sort below. */
  order: number;
  /** The original's own per-`addPolygon()`-call `callback` argument, invoked as `handler.call(this,
   * p.polygon)` from `drawAfter()` - `this` inside `handler` is therefore the `CanvasCoreBrush`
   * instance itself (typed accordingly below), not `p`. */
  handler: (this: CanvasCoreBrush, polygon: P) => void;
}

/**
 * Port of `chart.brush.canvas.core`'s `CanvasCoreBrush` constructor function as a real ES class,
 * per Phase 0 rule 2. Constructor kept 1:1 (zero parameters, same externally-wired-after-
 * construction shape `CoreBrush` itself already established - see header comment).
 */
export class CanvasCoreBrush extends CoreBrush {
  /** Lazily initialized by `addPolygon()` (see its own guard doc comment above) - `undefined`
   * until the first `addPolygon()` call, matching the original's own never-declared-until-first-use
   * `this.polygons` field. */
  polygons?: CanvasPolygonEntry[];

  /**
   * @method addPolygon
   * Queues a 3D polygon primitive for deferred, z-sorted drawing via `drawAfter()` below. Runs
   * `this.calculate3d(polygon)` (inherited from `Draw`, via `CoreBrush` - see that method's own
   * doc comment for the `Math.max(plotWidth, plotHeight, axis.depth)`/`axis.depth/2` formula) to
   * rotate/perspective-project the polygon's own vertices in place BEFORE stamping its post-
   * rotation `order`.
   */
  addPolygon<P extends CanvasPolygon>(polygon: P, callback: (this: CanvasCoreBrush, polygon: P) => void): void {
    if (!Array.isArray(this.polygons)) {
      this.polygons = [];
    }

    // 폴리곤 각도 및 깊이 연산 (polygon angle/depth calculation)
    this.calculate3d(polygon as any);

    // 연산된 폴리곤 객체 추가 (add the computed polygon object)
    this.polygons.push({
      polygon,
      order: (this.axis.depth as number) - polygon.max().z,
      handler: callback,
    } as unknown as CanvasPolygonEntry);
  }

  /**
   * @method drawAfter
   * Arrow-function CLASS FIELD, not method syntax - matches `Draw`'s own `drawAfter?: (obj: any)
   * => void` OPTIONAL PROPERTY declaration (same TS2425 override-kind-matching necessity
   * `CoreBrush.drawAfter`/`grid/core.ts`'s `CoreGrid.drawAfter`/`widget/core.ts`'s
   * `CoreWidget.drawAfter` already document). See header comment's "REAL, PREVIOUSLY-
   * UNDOCUMENTED BEHAVIOR" note: this field DOES NOT call `CoreBrush`'s own `drawAfter`
   * (clip-path/CSS-class/origin-translate) - it completely shadows it, exactly reproducing the
   * original's own constructor-assignment-order semantics. Takes NO parameter, unlike
   * `CoreBrush.drawAfter(obj)` (`Draw.render()`'s own `this.drawAfter!(obj)` call still passes
   * `draw()`'s return value as an argument, but this override simply never reads it - matching
   * the original's own `this.drawAfter = function() {...}`, zero declared parameters).
   */
  drawAfter = (): void => {
    // 폴리곤 기반의 브러쉬일 경우 (if this is a polygon-based brush)
    if (Array.isArray(this.polygons)) {
      const list = this.polygons;

      list.sort((a, b) => a.order - b.order);

      for (let i = 0, len = list.length; i < len; i++) {
        const p = list.shift();
        if (p) {
          p.handler.call(this, p.polygon);
        }
      }
    }
  };
}
