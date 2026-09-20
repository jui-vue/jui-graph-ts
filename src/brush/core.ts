// Port of juijs-graph's `src/brush/core.js` ("chart.brush.core", extend: "chart.draw").
//
// ============================================================================================
// REAL EXTEND TARGET IS `base/draw.ts`'s `Draw`, NOT `base/core.ts`'s `Core` - confirmed from
// source (`brush/core.js` line 9: `extend: "chart.draw"`), the SAME target `grid/core.ts`'s
// `CoreGrid` and `widget/core.ts`'s `CoreWidget` already established for their own sibling
// families (see either file's header comment for the full `Core`-vs-`Draw` two-family
// explanation). This corrects the task brief's own working assumption ("very likely extends Core
// from base/core.ts") - it does not; `Core` is the per-instance-event-bus/option-merge base for
// top-level UI objects (`Builder`/`Plane`) only, never reached by any `chart.brush.*`/
// `chart.widget.*`/`chart.grid.*` class in the real engine.
//
// `class CoreBrush extends Draw` below, constructor kept 1:1: the original's own `CoreBrush`
// constructor function takes ZERO parameters - `chart`/`axis`/`brush`/`svg`/`canvas` are wired
// onto the instance externally, by `base/builder.ts`'s `drawBrush()` (confirmed by reading that
// method, already ported: `const draw = new Obj(this, axis, draws[i]); draw.chart = this;
// draw.axis = axis; draw.brush = draws[i]; draw.svg = this.svg; draw.canvas =
// this._canvas.buffer;` - all AFTER construction; the constructor arguments themselves are never
// read by `CoreBrush`) - the exact same externally-wired-after-construction shape `CoreGrid`/
// `CoreWidget` already established for their own families. `builder.ts`'s `registerBrush(type,
// ctor)` / `DrawConstructor` (`new (chart, axis, options) => DrawLike`) already anticipates this
// exact wiring - a concrete `chart.brush.*` leaf class (e.g. a future `LineBrush`) satisfies
// `DrawConstructor` by extending `CoreBrush`, same as any 0-arg-constructor class satisfies a
// 3-parameter constructor type (TS's own "implementation may ignore trailing parameters" rule,
// already relied on by `GridConstructor`/`CoreGrid` per that file's own header comment).
//
// ============================================================================================
// CROSS-CHECK AGAINST jui-chart-vue's ACCUMULATED `chart.brush.core` INFERENCES (this task's own
// central verification job) - confirmations AND corrections, read against the real 559-line
// source in full before writing any code here:
//
//   CONFIRMED, method-for-method: `eachData(callback, reverse)`, `getValue(data, fieldString,
//   defaultValue)` (a thin `this.axis.getValue(...)` alias), `addEvent(elem, dataIndex,
//   targetIndex)` (the `{brush, dataIndex, dataKey, data}` payload shape jui-chart-vue's own
//   `ChartElementEventPayload` was independently reverse-engineered to match, PORT_STATUS.md
//   ~L273/~L309-332 there - confirmed byte-exact against the real source, including the
//   `_.typeCheck("object", dataIndex) && !targetIndex` special-case branch that swaps in a whole
//   row object as `data` with no `dataIndex`/`dataKey` at all), `color(key1, key2)`, `offset(type,
//   index)`, `curvePoints(K)` (jui-chart-vue's `useSeries.ts` own doc comment already says
//   "Ported from `chart.brush.core`'s `curvePoints()`" and its Phase F re-verification note
//   -`PORT_STATUS.md` ~L6240-6241 there - already confirmed the Thomas-algorithm variable names/
//   comments match this exact file; REUSED that hand-solved test oracle directly below:
//   `curvePoints([0,10,20,30])` -> `p1=[10/3,40/3,70/3]`, `p2=[20/3,50/3,80/3]`).
//
//   CORRECTED (real source narrower/different than what jui-chart-vue's brush-file writeups had
//   to infer without the actual base class):
//     1. **No `getCache`/`setCache` here at all.** The task brief's own working assumption
//        ("cache methods like `getCache`/`setCache`") turns out to belong to `base/builder.ts`'s
//        `Builder` (`chart.getCache`/`chart.setCache`, ALREADY ported there, lines ~1100-1107) -
//        `activebubble.js`'s Phase E writeup (`PORT_STATUS.md` ~L5252 there: "cached on the chart
//        (`chart.getCache`/`setCache`)") already correctly attributed these to `chart`, not to
//        `chart.brush.core` itself - re-confirmed here by reading `brush/core.js` in full: zero
//        cache methods anywhere in it. `CoreBrush` itself has NO cache-related surface.
//     2. **No `getIndexArray()` here either** - that belongs to `widget/core.ts`'s `CoreWidget`
//        (a DIFFERENT Phase E base for the sibling `chart.widget.*` family, not `chart.brush.*` -
//        confirmed by reading `widget/core.js` separately, already landed by a concurrent task;
//        see this project's own `src/index.ts` `CoreWidget` export comment). The task brief's
//        phrasing ("`getIndexArray`... per `rotate3d.js`'s Phase E entry") is itself about
//        `widget/core.js`, not this file - `rotate3d.js` is a `chart.widget.polygon.rotate3d`
//        leaf, nowhere near the `chart.brush.*` chain. No correction needed to any jui-chart-vue
//        brush writeup here; just a scope-boundary clarification.
//     3. **`bubble.js`'s Phase B writeup (`PORT_STATUS.md` ~L1160-1170 there) overclaims**
//        `target`/`colors`/`display`/`active` are ALL "inherited `chart.brush.core` defaults" -
//        **only `target`/`colors` actually are.** `CoreBrush.setup()`'s real, complete return
//        value (confirmed below) is exactly `{target, colors, axis, index, clip, useEvent}` - no
//        `display`, no `active`. Those two must be per-leaf-brush `own` `setup()` config (e.g.
//        `BubbleBrush`'s own, not `CoreBrush`'s) in the original - a genuine, if minor, prior
//        inference gap this task's own real-source access corrects. Not fixed anywhere (no
//        jui-chart-vue file needs editing per this task's scope), just documented for the record.
//
//   NEW FINDING (not previously inferrable without the real source - no jui-chart-vue writeup
//   attempted this, since it required reading `getXY()`/`getStackXY()`'s tridiagonal-adjacent
//   coordinate math directly): `builder.ts`'s own `defineOptions(ctor, options)` helper (already
//   landed, line ~158) is a SIMPLIFIED one-level version (`ctor.setup()` only) of the original
//   engine's real `jui.defineOptions` (`base/base.js` ~L1168: `getOptions(Module, {})`, which
//   walks the WHOLE `extend` chain leaf-first - confirmed by reading that function directly). In
//   the real original, a concrete brush like `chart.brush.line` gets its per-instance options
//   merged from ITS OWN `setup()`, then `CoreBrush.setup()` (`target`/`colors`/`axis`/`index`/
//   `clip`/`useEvent`), then `Draw.setup()` (`type`/`animate`) - the full 3-level chain, exactly
//   like `Core.mergeOptions()` already does for `Builder`/`Plane` (see `base/core.ts`'s header
//   comment). `builder.ts`'s current `defineOptions()` only ever applies the LEAF ctor's own
//   `setup()` - so once a real `chart.brush.*` leaf class lands and gets `registerBrush()`'d, its
//   instances will NOT automatically receive `CoreBrush.setup()`'s `clip: true`/`useEvent: true`/
//   etc. defaults through `builder.ts`'s current wiring, unlike the real original engine. This is
//   a pre-existing gap in `builder.ts` (not introduced by this task, and outside this task's own
//   file-touch scope - a future reconciliation, flagged here for whoever ports the first real
//   `chart.brush.*` leaf and notices its defaults aren't merging as expected).
// ============================================================================================
//
// `getXY()`/`getStackXY()` - the real per-brush coordinate-resolution engine every concrete
// axis-based brush (`bar`/`line`/`area`/`scatter`/etc., none ported yet) is built on top of.
// Ported verbatim, including two real, previously-undocumented structural details found by
// tracing the algorithm precisely (not obvious from a single read):
//   - `isRangeY = (axis.y.type == "range")` picks which axis is the "index/category" axis and
//     which is the "value" axis for THIS render: when the y-axis is a continuous "range" scale,
//     x is resolved from the plain ROW INDEX (`x(i)`, a block/ordinal scale) once per row,
//     while y is recomputed from each target's VALUE inside the per-target loop; the opposite
//     when y is NOT a range axis (the far more common case: `y(i)` once per row, `x(value)` per
//     target). This is genuine, intentional design (how "range"-typed axes are meant to be used
//     in this engine), not a bug - documented here rather than silently "explained away".
//   - `_.loop(i)` (`util/base.js`'s "최적화된 루프" - "optimized loop") is REAL, load-bearing
//     product logic reused directly by `getXY()`, not OOP/registry scaffolding, so it's inlined
//     here (per Phase 0 rule 4's "verify before dropping" instruction, same treatment
//     `base/axis.ts` already gave `extend`/`deepClone`/`typeCheck`) rather than replaced with a
//     plain `for` loop. It splits `[0, total)` into 5 interleaved buckets and visits them
//     round-robin (`0, unit, 2*unit, 3*unit, 4*unit, 1, unit+1, ...`) instead of sequentially -
//     confirmed via Node cross-check against a literal transcription of `base/base.js`'s real
//     `loop()`. This changes the ORDER `getXY()`'s per-row callback runs in, but not its RESULT:
//     every write targets `xy[j].x/y/value[i]` by absolute index `i`, so the final array is
//     identical regardless of visitation order (confirmed in `core.spec.ts` against a plain
//     sequential-order expectation). Preserved for fidelity anyway, since a future canvas/3d
//     brush subclass could plausibly observe the interleaved CALL order itself (e.g. via a
//     callback with a side effect), not just the final `xy` result.
//
// `getMinMaxValue()` (private helper, module-scope, matches the original's own closure-scoped
// placement) has a harmless-but-confusing quirk, Node/hand-verified: its first pass checks
// `!seriesList[target[i]]` (always `true` - `seriesList` is freshly-created and empty at this
// point, never populated until the function's THIRD pass) to decide whether to initialize
// `targetList[target[i]] = []` - i.e. the guard condition is checking the WRONG variable
// (`seriesList`, not `targetList`) and is therefore always-true/inert, not a real duplicate-key
// guard. For a `target` array with a repeated key, this just re-initializes the SAME
// `targetList[key] = []` more than once before any data is pushed into it - a no-op in effect
// (verified: `getMinMaxValue([...], ["a","a"])` behaves identically to `getMinMaxValue([...],
// ["a"])`), not an observable bug. Preserved verbatim rather than "fixed" to check `targetList`
// instead, per Phase 0 rule 6.
// ============================================================================================
//
// `eachData(callback, reverse)`'s REAL, easy-to-miss quirk (Node/hand-verified against the
// literal source, not assumed): the two branches call `callback` with ARGUMENTS IN A DIFFERENT
// ORDER. Non-reverse (the default, and the only form `getStackXY()` itself ever uses):
// `callback.call(this, list[index], index)` - i.e. `(data, index)`. Reverse (`reverse === true`):
// `callback.call(this, len, list[len])` - i.e. `(index, data)`, SWAPPED. A caller that passes the
// same callback shape to both forms (e.g. `function(data, i) {...}`) silently receives the row's
// data where it expects the index, and vice versa, whenever it opts into `reverse: true`.
// Preserved exactly, not "fixed" to a consistent order; tested in `core.spec.ts`.
// ============================================================================================

import { Draw } from "../base/draw";
import type { Axis } from "../base/axis";
import { offset as domOffset } from "../util/dom";
import type { SVG } from "../util/svg";
import type { TransElement } from "../util/svg/element.transform";
import type { Element as SvgElement } from "../util/svg/element";

// ---- inlined `util/base.js` typeCheck (same per-file convention as `util/dom.ts`, `base/axis.ts`,
// `base/builder.ts`, `base/core.ts`, `base/draw.ts`, `grid/core.ts`, `widget/core.ts` - no shared
// helper module exists in this port). Only the checks this file actually calls are included
// (`function`/`object`/`undefined`/`string`/`integer`/`array`). ------------------------------------
type TypeCheckable = unknown;

function typeCheck(type: string | string[], value: TypeCheckable): boolean {
  function check(t: string, v: TypeCheckable): boolean {
    if (typeof t !== "string") return false;
    if (t === "string") return typeof v === "string";
    if (t === "integer") return typeof v === "number" && v % 1 === 0;
    if (t === "function") return typeof v === "function";
    if (t === "undefined") return typeof v === "undefined";
    if (t === "array") return v instanceof Array;
    if (t === "object") {
      return typeof v === "object" && v !== null && !(v instanceof Array) && !(v instanceof Date) && !(v instanceof RegExp);
    }
    return false;
  }
  if (typeof type === "object" && Array.isArray(type)) {
    for (let i = 0; i < type.length; i++) {
      if (check(type[i], value)) return true;
    }
    return false;
  }
  return check(type as string, value);
}

// ---- inlined `util/base.js`'s `loop(total, context)` ("최적화된 루프" / "optimized loop") - real
// product logic `getXY()` reuses directly, not registry/OOP scaffolding (see header comment for
// why this is inlined rather than replaced with a plain sequential loop). `context` is never
// passed by `getXY()`'s own call site (`_.loop(i)`, one argument), so that parameter is omitted
// here rather than ported unused. ------------------------------------------------------------------
function loop(total: number): (callback: (index: number, group: number) => void) => void {
  const start = 0;
  const end = total;
  const unit = Math.ceil(total / 5);

  return function (callback: (index: number, group: number) => void) {
    let first = start;
    let second = unit * 1;
    let third = unit * 2;
    let fourth = unit * 3;
    let fifth = unit * 4;
    const firstMax = second;
    const secondMax = third;
    const thirdMax = fourth;
    const fourthMax = fifth;
    const fifthMax = end;

    while (first < firstMax && first < end) {
      callback(first, 1);
      first++;

      if (second < secondMax && second < end) {
        callback(second, 2);
        second++;
      }
      if (third < thirdMax && third < end) {
        callback(third, 3);
        third++;
      }
      if (fourth < fourthMax && fourth < end) {
        callback(fourth, 4);
        fourth++;
      }
      if (fifth < fifthMax && fifth < end) {
        callback(fifth, 5);
        fifth++;
      }
    }
  };
}

/** Private module-scope helper, matches the original's own closure placement inside `component()`.
 * See header comment for the preserved "checks the wrong (always-empty) object" quirk. */
function getMinMaxValue(data: BrushData[], target: string[]): Record<string, { min: number; max: number }> {
  const seriesList: Record<string, { min: number; max: number }> = {};
  const targetList: Record<string, number[]> = {};

  for (let i = 0; i < target.length; i++) {
    if (!seriesList[target[i]]) {
      targetList[target[i]] = [];
    }
  }

  // 시리즈 데이터 구성
  for (let i = 0, len = data.length; i < len; i++) {
    const row = data[i];

    for (const k in targetList) {
      targetList[k].push(row[k] as number);
    }
  }

  for (const key in targetList) {
    seriesList[key] = {
      min: Math.min.apply(Math, targetList[key]),
      max: Math.max.apply(Math, targetList[key]),
    };
  }

  return seriesList;
}

/** A single data row (`axis.data[i]`'s real shape: a user-supplied plain object, keyed by
 * whatever field names `brush.target`/`getValue()` read). */
export type BrushData = Record<string, unknown>;

/** The minimal callable shape `getXY()`/`getStackXY()`/`offset()` need from `axis.x`/`axis.y`/
 * `axis[type]` - a Phase A `util/scale.ts`-family scale function (or a Phase C grid's rendered
 * `GridRenderedScale`, which is stamped with the same `.type`/callable shape by
 * `base/axis.ts`'s `drawGridType()`). Matches `Axis`'s own `x`/`y`/`z`/`c` fields, which are
 * genuinely `unknown`-typed there (see `axis.ts`'s own header comment on why: two-phase-shaped,
 * config-object-then-rendered-scale) - cast to this shape at each call site here, same as any
 * other consumer of a rendered axis scale has to. */
export type BrushAxisScale = ((value: unknown) => number) & {
  type?: string;
  rangeBand?: () => number;
};

/** This file's own minimal slice of the real chart (`Builder`) surface `CoreBrush`'s methods need
 * - narrower override of `Draw`'s own `chart!: DrawChartLike` field, same convention
 * `grid/core.ts`'s `GridChart` established for its own `CoreGrid`. Structurally satisfies `Draw`'s
 * own (unexported) `DrawChartLike` (`on(type, callback, resetType?)`/`axis(index?)`/`format?`) -
 * required for the `declare chart: BrushChart` override below to type-check against `Draw.on()`/
 * `Draw.format()`, both inherited unmodified by `CoreBrush`. */
export interface BrushChart {
  /** `Draw.on()`'s `this.chart.on(type, handler, "render")` (inherited, unmodified). */
  on(type: string, callback: (...args: any[]) => any, resetType?: string): any;
  /** `Draw.on()`'s per-axis dispatch guard `self.chart.axis(self.axis.index)`. */
  axis(index?: number): any;
  /** `Draw.format()`'s fallback when a brush doesn't define its own `format`. */
  format?: (...args: any[]) => any;
  /** `drawAfter()`'s `this.chart.area("x")`/`.area("y")` brush-origin translate. */
  area(key: string): number;
  /** `drawTooltip()`'s `self.chart.svg.group(...)`/`.circle(...)`. */
  svg: SVG;
  /** `addEvent()`'s `setMouseEvent()` - `$.offset(chart.root)`. */
  root: HTMLElement;
  /** `color()`'s `this.chart.color(...)` (1 or 2-arg forwarding form). */
  color(key1?: any, key2?: any): string;
  /** `drawTooltip()`'s `self.chart.theme("tooltipPoint...")` (1-arg form; `Builder.theme()`'s real
   * signature is looser/3-arg-capable, only the 1-arg form is exercised here). */
  theme(key?: any, value?: any, value2?: any): any;
  /** `drawTooltip()`'s `self.chart.text({...})` (delegates to `chart.svg.text()` under the hood -
   * see header comment on why this still nests correctly inside the open `svg.group()` callback). */
  text(attr: Record<string, any>, textOrCallback?: string | ((this: any) => void)): any;
  /** `addEvent()`'s `setMouseEvent()` - `chart.padding("left")`/`.padding("top")`. */
  padding(key?: string): number;
  /** `addEvent()`'s per-mouse-event `chart.emit(type, [obj, e])` dispatch. */
  emit(type: string, args?: any[]): any;
}

/** 1:1 shape of `CoreBrush.setup()`'s real, complete defaults (see header comment's "CORRECTED"
 * item 3 - `display`/`active` are NOT part of this; only these six keys are). Narrower override of
 * `Draw`'s own `brush: any` field, same convention `grid/core.ts`/`widget/core.ts` established for
 * their own `grid`/`widget` field overrides. Left with an index signature (unlike
 * `WidgetConfig`'s closed shape) since every concrete `chart.brush.*` leaf's OWN config keys
 * (`display`/`active`/`size`/etc.) also live on this same object in the original - `CoreBrush`
 * itself just doesn't define any of them. */
export interface BrushOptions {
  /** @cfg {Array} [target=null] Specifies the key value of data displayed on a brush. */
  target?: string[] | null;
  /** @cfg {Array/Function} [colors=null] Able to specify color codes according to the target
   * order (basically, refers to the color codes of a theme). */
  colors?: any[] | ((this: any, data: BrushData, index: number) => any) | null;
  /** @cfg {Integer} [axis=0] Specifies the index of a grid group which acts as the reference axis
   * of a brush. */
  axis?: number;
  /** @cfg {Integer} [index=null] [Read Only] Sequence index on which brush is drawn. */
  index?: number | null;
  /** @cfg {boolean} [clip=true] If the brush is drawn outside of the chart, cut the area. */
  clip?: boolean;
  /** @cfg {boolean} [useEvent=true] If you do not use a brush events, it gives better performance. */
  useEvent?: boolean;
  /** @cfg {String} [type=null] Specifies the type of a brush (inherited default from
   * `Draw.setup()`, per the original's `extend:` chain - `CoreBrush.setup()` itself never
   * redeclares `type`/`animate`, matching `CoreGrid.setup()`/`CoreWidget.setup()`'s same
   * "no automatic static-setup-chain merge" convention, see header comment's own new-finding
   * note on `builder.ts`'s currently-simplified `defineOptions()`). */
  type?: string;
  [key: string]: unknown;
}

/** `addEvent()`'s per-element event payload shape (`obj` in the original), reused across every
 * concrete brush's own `click`/`dblclick`/`rclick`/`mouseover`/`mouseout`/`mousemove`/
 * `mousedown`/`mouseup` handlers. Matches jui-chart-vue's own `ChartElementEventPayload`
 * reverse-engineering of this exact shape (see header comment's cross-check). */
export interface BrushEventPayload {
  brush: BrushOptions;
  data?: BrushData | null;
  dataIndex?: number;
  dataKey?: string | null;
}

/** Augmented mouse event shape `addEvent()`'s `setMouseEvent()` stamps onto every dispatched
 * event (`bgX`/`bgY`/`chartX`/`chartY`), matching the original's own untyped
 * `e.bgX = offsetX; ...` mutation of the native event object in place. */
export interface BrushMouseEvent extends Event {
  pageX: number;
  pageY: number;
  bgX?: number;
  bgY?: number;
  chartX?: number;
  chartY?: number;
}

/** `getXY()`/`getStackXY()`'s per-target result shape (`xy[j]` in the original). */
export interface BrushSeriesXY {
  x: number[];
  y: number[];
  value: unknown[];
  min: boolean[];
  max: boolean[];
  length: number;
}

/** `drawTooltip()`'s return shape. */
export interface BrushTooltip {
  tooltip: TransElement;
  control: (orient: string | undefined, x: number, y: number, value: unknown) => void;
  style: (fill: unknown, stroke: unknown, opacity: unknown) => void;
}

/**
 * Port of `chart.brush.core`'s `CoreBrush` constructor function as a real ES class, per Phase 0
 * rule 2. Constructor kept 1:1 (zero parameters - see header comment for the externally-wired
 * `chart`/`axis`/`brush`/`svg`/`canvas` shape `base/builder.ts`'s `drawBrush()` provides).
 * Genuinely abstract, same as `CoreGrid`/`CoreWidget`: never assigns `this.draw` (required by
 * `Draw.render()`) - every concrete `chart.brush.*` leaf class (Phase E future work: `bar.js`/
 * `line.js`/etc., none ported yet) supplies that itself.
 */
export class CoreBrush extends Draw {
  declare chart: BrushChart;
  declare axis: Axis;
  declare brush: BrushOptions;

  /**
   * @method drawAfter
   * Arrow-function CLASS FIELD, not method syntax - matches `Draw`'s own `drawAfter?: (obj: any)
   * => void` OPTIONAL PROPERTY declaration (TS2425 override-kind-matching necessity, same as
   * `grid/core.ts`'s `CoreGrid.drawAfter`/`widget/core.ts`'s `CoreWidget.drawAfter`; also mirrors
   * the original's own per-instance closure-assignment shape, `this.drawAfter = function(obj)
   * {...}`, never a prototype method there). Clips the drawn element to the axis's clip-path
   * (unless `brush.clip === false`), stamps a `brush-<type>` CSS class, and translates it to the
   * chart's plot-area origin.
   */
  drawAfter = (obj: TransElement): void => {
    if (this.brush.clip !== false) {
      obj.attr({ "clip-path": "url(#" + (this.axis.get("clipId") as string) + ")" });
    }

    obj.attr({ class: "brush-" + this.brush.type });
    obj.translate(this.chart.area("x"), this.chart.area("y")); // 브러쉬일 경우, 기본 좌표 설정
  };

  /**
   * @method drawTooltip
   * Builds a hidden `<g>` containing a centered text label + circle marker, plus `control()`
   * (shows/positions/orients it for a given `x`/`y`/`value`) and `style()` (re-themes
   * fill/stroke/opacity) closures - the shared "value tooltip" primitive every axis-point-based
   * brush (line/area/scatter markers) reuses. Ported verbatim, including the non-null assertions
   * on `tooltip.get(0)`/`.get(1)` (the original never guards these either - always safe in
   * practice since `draw()` always creates exactly `[text, circle]` as this group's only two
   * children, in that exact order, before `control()`/`style()` can ever be called).
   */
  drawTooltip(fill: unknown, stroke: unknown, opacity: unknown): BrushTooltip {
    const self = this;
    let tooltip: TransElement;

    function draw(): TransElement {
      return self.chart.svg.group({ visibility: "hidden" }, function () {
        self.chart.text({
          fill: self.chart.theme("tooltipPointFontColor"),
          "font-size": self.chart.theme("tooltipPointFontSize"),
          "font-weight": self.chart.theme("tooltipPointFontWeight"),
          "text-anchor": "middle",
          opacity: opacity,
        });

        self.chart.svg.circle({
          r: self.chart.theme("tooltipPointRadius"),
          fill: fill,
          stroke: stroke,
          opacity: opacity,
          "stroke-width": self.chart.theme("tooltipPointBorderWidth"),
        });
      });
    }

    function show(orient: string | undefined, x: number, y: number, value: unknown): void {
      const text = tooltip.get(0)!;
      // `.textContent`'s setter stringifies a non-string assignment exactly the same way the
      // original's raw `text.element.textContent = value;` does at the real DOM level - `String()`
      // here is a TS-necessary, behavior-IDENTICAL widening (same category as `element.ts`'s own
      // already-documented cases), not a semantic change.
      text.element.textContent = String(value);

      if (orient == "left") {
        text.attr({ x: -7, y: 4, "text-anchor": "end" });
      } else if (orient == "right") {
        text.attr({ x: 7, y: 4, "text-anchor": "start" });
      } else if (orient == "bottom") {
        text.attr({ y: 16 });
      } else {
        text.attr({ y: -7 });
      }

      tooltip.attr({ visibility: value != 0 ? "visible" : "hidden" });
      tooltip.translate(x, y);
    }

    // 툴팁 생성
    tooltip = draw();

    return {
      tooltip: tooltip,
      control: show,
      style: function (fill: unknown, stroke: unknown, opacity: unknown): void {
        tooltip.get(0)!.attr({
          opacity: opacity,
        });

        tooltip.get(1)!.attr({
          fill: fill,
          stroke: stroke,
          opacity: opacity,
        });
      },
    };
  }

  /**
   * @method curvePoints
   *
   * 좌표 배열 'K'에 대한 커브 좌표 'P1', 'P2'를 구하는 함수
   *
   * TODO: min, max 에 대한 처리도 같이 필요함.
   *
   * Solves a tridiagonal linear system (the Thomas algorithm) for the two cubic-Bezier control
   * points `p1`/`p2` between each pair of consecutive coordinates in `K`, producing a smooth
   * curve through them. See header comment for the reused jui-chart-vue `useSeries.ts` test
   * oracle. The original's first `for` loop uses its loop variable (`i`) without its own `var`
   * declaration - harmless there only because a LATER loop in the same function DOES declare
   * `var i`, and `var` hoists to function scope; a single `let i` declared once up front here
   * reproduces that exact same function-scoped-reuse shape without relying on hoisting.
   */
  curvePoints(K: number[]): { p1: number[]; p2: number[] } {
    const p1: number[] = [];
    const p2: number[] = [];
    const n = K.length - 1;

    /*rhs vector*/
    const a: number[] = [];
    const b: number[] = [];
    const c: number[] = [];
    const r: number[] = [];
    let i: number;

    /*left most segment*/
    a[0] = 0;
    b[0] = 2;
    c[0] = 1;
    r[0] = K[0] + 2 * K[1];

    /*internal segments*/
    for (i = 1; i < n - 1; i++) {
      a[i] = 1;
      b[i] = 4;
      c[i] = 1;
      r[i] = 4 * K[i] + 2 * K[i + 1];
    }

    /*right segment*/
    a[n - 1] = 2;
    b[n - 1] = 7;
    c[n - 1] = 0;
    r[n - 1] = 8 * K[n - 1] + K[n];

    /*solves Ax=b with the Thomas algorithm (from Wikipedia)*/
    for (i = 1; i < n; i++) {
      const m = a[i] / b[i - 1];
      b[i] = b[i] - m * c[i - 1];
      r[i] = r[i] - m * r[i - 1];
    }

    p1[n - 1] = r[n - 1] / b[n - 1];
    for (i = n - 2; i >= 0; --i) p1[i] = (r[i] - c[i] * p1[i + 1]) / b[i];

    /*we have p1, now compute p2*/
    for (i = 0; i < n - 1; i++) p2[i] = 2 * K[i + 1] - p1[i + 1];

    p2[n - 1] = 0.5 * (K[n] + p1[n - 1]);

    return {
      p1: p1,
      p2: p2,
    };
  }

  /**
   * @method eachData
   *
   * loop axis data
   *
   * See header comment for the preserved `(data, index)` vs. reversed `(index, data)` argument-
   * order quirk between the two branches - callback params typed loosely (`unknown`) rather than
   * a misleadingly-fixed `(data, index)` shape, to avoid silently implying a consistency the
   * original doesn't have.
   *
   * @param {Function} callback
   */
  eachData(callback: (this: CoreBrush, a: unknown, b: unknown) => void, reverse?: boolean): void {
    if (!typeCheck("function", callback)) return;
    const list = this.listData();

    if (reverse === true) {
      for (let len = list.length - 1; len >= 0; len--) {
        callback.call(this, len, list[len]);
      }
    } else {
      for (let index = 0, len = list.length; index < len; index++) {
        callback.call(this, list[index], index);
      }
    }
  }

  /**
   * @method listData
   *
   * get axis.data
   *
   * @returns {Array} axis.data
   */
  listData(): BrushData[] {
    if (!this.axis) {
      return [];
    } else {
      if (!this.axis.data) {
        return [];
      }
    }

    return this.axis.data as BrushData[];
  }

  /**
   * @method getData
   *
   * get record by index in axis.data
   *
   * @param {Integer} index
   * @returns {Object} record in axis.data
   */
  getData(index: number): BrushData {
    return this.listData()[index];
  }

  /**
   * @method getValue
   *
   * chart.axis.getValue alias
   *
   * @param {Object} data row data
   * @param {String} fieldString 필드 이름
   * @param {String/Number/Boolean/Object} [defaultValue=''] 기본값
   * @return {Mixed}
   */
  getValue(data: BrushData, fieldString: string, defaultValue?: unknown): unknown {
    return this.axis.getValue(data, fieldString, defaultValue);
  }

  /**
   * @method getXY
   *
   * 차트 데이터에 대한 좌표 'x', 'y'를 구하는 함수
   *
   * See header comment for the `isRangeY`/`_.loop()` design notes.
   *
   * @param {Boolean} [isCheckMinMax=true]
   * @return {Array}
   */
  getXY(isCheckMinMax?: boolean): BrushSeriesXY[] {
    const xy: BrushSeriesXY[] = [];
    let series: Record<string, { min: number; max: number }> = {};
    const length = this.listData().length;
    const i = length;
    const target = this.brush.target ?? [];
    const targetLength = target.length;

    if (isCheckMinMax !== false) {
      series = getMinMaxValue(this.axis.data as BrushData[], target);
    }

    for (let j = 0; j < targetLength; j++) {
      xy[j] = {
        x: new Array(length),
        y: new Array(length),
        value: new Array(length),
        min: [],
        max: [],
        length: length,
      };
    }

    const axisData = this.axis.data as BrushData[];
    const isRangeY = (this.axis.y as BrushAxisScale).type == "range";
    const x = this.axis.x as BrushAxisScale;
    const y = this.axis.y as BrushAxisScale;
    const func = loop(i);

    func(function (i: number, _group: number) {
      const data = axisData[i];
      let startX = 0;
      let startY = 0;

      if (isRangeY) startX = x(i);
      else startY = y(i);

      for (let j = 0; j < targetLength; j++) {
        const key = target[j];
        const value = data[key];

        if (isRangeY) startY = y(value);
        else startX = x(value);

        xy[j].x[i] = startX;
        xy[j].y[i] = startY;
        xy[j].value[i] = value;

        if (isCheckMinMax !== false) {
          xy[j].min[i] = value == series[key].min;
          xy[j].max[i] = value == series[key].max;
        }
      }
    });

    return xy;
  }

  /**
   * @method getStackXY
   *
   * 차트 데이터에 대한 좌표 'x', 'y'를 구하는 함수
   * 단, 'y' 좌표는 다음 데이터 보다 높게 구해진다.
   *
   * @param {Boolean} [isCheckMinMax=true]
   * @return {Array}
   */
  getStackXY(isCheckMinMax?: boolean): BrushSeriesXY[] {
    const xy = this.getXY(isCheckMinMax);
    const isRangeY = (this.axis.y as BrushAxisScale).type == "range";

    this.eachData(function (this: CoreBrush, data: unknown, i: unknown) {
      const row = data as BrushData;
      const rowIndex = i as number;
      const target = this.brush.target ?? [];
      let valueSum = 0;

      for (let j = 0; j < target.length; j++) {
        const key = target[j];
        const value = row[key] as number;

        if (j > 0) {
          valueSum += row[target[j - 1]] as number;
        }

        if (isRangeY) {
          xy[j].y[rowIndex] = (this.axis.y as BrushAxisScale)(value + valueSum);
        } else {
          xy[j].x[rowIndex] = (this.axis.x as BrushAxisScale)(value + valueSum);
        }
      }
    });

    return xy;
  }

  /**
   * @method addEvent
   * 브러쉬 엘리먼트에 대한 공통 이벤트 정의
   *
   * See header comment's cross-check confirmation against jui-chart-vue's own
   * `ChartElementEventPayload` reverse-engineering of this exact payload shape.
   *
   * @param {Element} elem
   * @param {Integer|Object} dataIndex a row index, OR (when `targetIndex` is falsy) a whole row
   *   object passed directly as `data`.
   * @param {Integer} [targetIndex]
   */
  addEvent(elem: SvgElement, dataIndex?: number | BrushData, targetIndex?: number | null): void {
    if (this.brush.useEvent !== true) return;

    const chart = this.chart;
    const obj: BrushEventPayload = { brush: this.brush };

    if (typeCheck("object", dataIndex) && !targetIndex) {
      obj.data = dataIndex as BrushData;
    } else {
      obj.dataIndex = dataIndex as number;
      obj.dataKey = targetIndex != null ? (this.brush.target ?? [])[targetIndex] : null;
      obj.data = dataIndex != null ? this.getData(dataIndex as number) : null;
    }

    function setMouseEvent(e: BrushMouseEvent): void {
      const pos = domOffset(chart.root) ?? { top: 0, left: 0 };
      const offsetX = e.pageX - pos.left;
      const offsetY = e.pageY - pos.top;

      e.bgX = offsetX;
      e.bgY = offsetY;
      e.chartX = offsetX - chart.padding("left");
      e.chartY = offsetY - chart.padding("top");
    }

    elem.on("click", function (e: Event) {
      setMouseEvent(e as BrushMouseEvent);
      chart.emit("click", [obj, e]);
    });

    elem.on("dblclick", function (e: Event) {
      setMouseEvent(e as BrushMouseEvent);
      chart.emit("dblclick", [obj, e]);
    });

    elem.on("contextmenu", function (e: Event) {
      setMouseEvent(e as BrushMouseEvent);
      chart.emit("rclick", [obj, e]);
      e.preventDefault();
    });

    elem.on("mouseover", function (e: Event) {
      setMouseEvent(e as BrushMouseEvent);
      chart.emit("mouseover", [obj, e]);
    });

    elem.on("mouseout", function (e: Event) {
      setMouseEvent(e as BrushMouseEvent);
      chart.emit("mouseout", [obj, e]);
    });

    elem.on("mousemove", function (e: Event) {
      setMouseEvent(e as BrushMouseEvent);
      chart.emit("mousemove", [obj, e]);
    });

    elem.on("mousedown", function (e: Event) {
      setMouseEvent(e as BrushMouseEvent);
      chart.emit("mousedown", [obj, e]);
    });

    elem.on("mouseup", function (e: Event) {
      setMouseEvent(e as BrushMouseEvent);
      chart.emit("mouseup", [obj, e]);
    });
  }

  /**
   * @method color
   *
   * chart.color() 를 쉽게 사용할 수 있게 만든 유틸리티 함수
   *
   * @param {Number} key1  브러쉬에서 사용될 컬러 Index
   * @param {Number} key2  브러쉬에서 사용될 컬러 Index
   * @returns {*}
   */
  color(key1?: number, key2?: number): string {
    const colors = this.brush.colors;
    let color: string | null = null;
    let colorIndex: number | undefined = 0;
    let rowIndex = 0;

    if (!typeCheck("undefined", key2)) {
      colorIndex = key2;
      rowIndex = key1 as number;
    } else {
      colorIndex = key1;
    }

    if (typeCheck("function", colors)) {
      const newColor = (colors as (this: unknown, data: BrushData, index: number) => unknown).call(
        this.chart,
        this.getData(rowIndex),
        rowIndex,
      );

      if (typeCheck(["string", "integer"], newColor)) {
        color = this.chart.color(newColor);
      } else if (typeCheck("array", newColor)) {
        color = this.chart.color(colorIndex, newColor);
      } else {
        color = this.chart.color(0);
      }
    } else {
      color = this.chart.color(colorIndex, colors);
    }

    return color as string;
  }

  /**
   * @method offset
   *
   * 그리드 타입에 따른 시작 좌표 가져오기 (블럭)
   *
   * @param {String} type 그리드 종류
   * @param {Number} index 인덱스
   * @returns {*}
   */
  offset(type: "x" | "y" | "z" | "c", index: number): number {
    const scale = this.axis[type] as BrushAxisScale;
    let res = scale(index);

    if (scale.type != "block") {
      res += (scale.rangeBand as () => number)() / 2;
    }

    return res;
  }

  /**
   * @method setup
   * 1:1 port of `CoreBrush.setup()`'s static defaults factory. Return type widened to
   * `Record<string, unknown>` for the same static-side covariant-override reason
   * `CoreGrid.setup()`/`CoreWidget.setup()` already required against `Draw.setup()`'s own widened
   * return type - zero runtime/behavior change.
   */
  static setup(): Record<string, unknown> {
    return {
      /** @property {chart.builder} chart */
      /** @property {chart.axis} axis */
      /** @property {Object} brush */

      /** @cfg {Array} [target=null] Specifies the key value of data displayed on a brush. */
      target: null,
      /** @cfg {Array/Function} [colors=null] Able to specify color codes according to the target
       * order (basically, refers to the color codes of a theme). */
      colors: null,
      /** @cfg {Integer} [axis=0] Specifies the index of a grid group which acts as the reference
       * axis of a brush. */
      axis: 0,
      /** @cfg {Integer} [index=null] [Read Only] Sequence index on which brush is drawn. */
      index: null,
      /** @cfg {boolean} [clip=true] If the brush is drawn outside of the chart, cut the area. */
      clip: true,
      /** @cfg {boolean} [useEvent=true] If you do not use a brush events, it gives better
       * performance. */
      useEvent: true,
    };
  }
}

/**
 * @event click
 * Event that occurs when clicking on the brush.
 * @param {BrushEventPayload} obj Related brush data.
 */
/**
 * @event dblclick
 * Event that occurs when double clicking on the brush.
 * @param {BrushEventPayload} obj Related brush data.
 */
/**
 * @event rclick
 * Event that occurs when right clicking on the brush.
 * @param {BrushEventPayload} obj Related brush data.
 */
/**
 * @event mouseover
 * Event that occurs when placing the mouse over the brush.
 * @param {BrushEventPayload} obj Related brush data.
 */
/**
 * @event mouseout
 * Event that occurs when moving the mouse out of the brush.
 * @param {BrushEventPayload} obj Related brush data.
 */
/**
 * @event mousemove
 * Event that occurs when moving the mouse over the brush.
 * @param {BrushEventPayload} obj Related brush data.
 */
/**
 * @event mousedown
 * Event that occurs when left clicking on the brush.
 * @param {BrushEventPayload} obj Related brush data.
 */
/**
 * @event mouseup
 * Event that occurs after left clicking on the brush.
 * @param {BrushEventPayload} obj Related brush data.
 */
