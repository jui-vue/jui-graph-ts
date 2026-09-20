// Port of juijs-graph's `src/grid/draw2d.js` ("chart.grid.draw2d", extend: "chart.draw").
//
// ============================================================================================
// NOT A `CoreGrid` SUBCLASS - a sibling, per `grid/core.ts`'s own dependency map / header comment
//
// `grid/draw2d.js` shares `CoreGrid`'s OWN `extend: "chart.draw"` field (confirmed by grep) - it
// does NOT extend `chart.grid.core`. It's the real 2D-drawing-method MIXIN `grid/core.ts`'s
// `drawGrid()` applies onto whichever concrete `CoreGrid` instance is being rendered (via
// `draw.call(this)` in the original, where `draw` resolves to this file's own `Draw2DGrid`
// constructor FUNCTION - see `grid/core.ts`'s header comment for the full mechanism and its
// `registerGridDraw2D()`/`registerGridDraw3D()` hooks, built specifically to receive this file and
// its not-yet-ported `grid/draw3d.ts` sibling).
//
// **The mixin is a batch of plain functions assigned as OWN properties directly onto the CoreGrid
// instance - not a separate object with its own state.** In the original, `draw.call(this)` runs
// `Draw2DGrid`'s constructor body with `this` bound DIRECTLY to the grid instance being rendered
// (no intermediate "Draw2DGrid object" ever exists) - `this.createGridX = function(){...}` etc.
// assign straight onto that grid instance. Reproduced here as `applyDraw2DGridMixin(target)`,
// which builds each method as a plain function closing over a local `self = target` (NOT a class
// with prototype methods - `Object.assign(target, new SomeClass())` would copy nothing useful,
// since prototype methods aren't the copied instance's OWN enumerable properties; a real class
// here would silently break the whole mixin). Closing over `self` (fixed at mixin-application
// time) instead of relying on dynamic `this`-at-call-time binding (like the original's plain
// `function` expressions do) is a deliberate, behavior-preserving TypeScript-friendly
// simplification: in every real code path, `createGridX`/etc. are only ever invoked as
// `target.createGridX(...)` by that SAME target's own `drawTop`/`drawBottom`/`drawLeft`/
// `drawRight`/etc. (see `grid/core.ts`), so `this` could never actually diverge from `self` at
// runtime in the original either - there is no observable behavior difference, only a type-safety
// improvement (arrow closures don't need `this: CoreGrid` parameter annotations threaded through
// every method).
//
// Registered via `registerGridDraw2D(applyDraw2DGridMixin)` at the bottom of this file - a
// module-load-time side effect. The original had no per-file self-registration at all (a single
// top-level `main.js` did `jui.use([...ALL modules..., Draw2dGrid, ...])` once, at library
// bootstrap); this project has no equivalent "assemble everything" entry point yet (Phase C is
// still in progress - most `grid/*.ts` files don't exist). Since there is exactly ONE real 2D-draw
// implementation (unlike `chart.axis`/`chart.brush.*`/`chart.widget.*`, which are genuinely
// pluggable and therefore registered by whatever application code assembles a chart - see
// `base/builder.ts`'s `registerAxis`/`registerBrush`/`registerWidget`), self-registering on import
// is the most direct faithful translation here, and is what this task was explicitly asked to do
// ("call registerGridDraw2D(...) to wire it in for real"). `applyDraw2DGridMixin` is also exported
// directly, so tests (and any future bootstrap code) can call it explicitly instead of relying on
// the import side effect.
import { registerGridDraw2D } from "./core";
import type { CoreGrid, GridChart } from "./core";
import type { TransElement } from "../util/svg/element.transform";

// ---- inlined `util/base.js` typeCheck/extend (same per-file convention as `grid/core.ts`) ------
function typeCheck(type: string, value: unknown): boolean {
  if (type === "function") return typeof value === "function";
  if (type === "object") {
    return typeof value === "object" && value !== null && !(value instanceof Array) && !(value instanceof Date) && !(value instanceof RegExp);
  }
  return false;
}

function extend(origin: Record<string, unknown>, add: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!typeCheck("object", add)) return origin;
  for (const key in add) {
    origin[key] = add![key];
  }
  return origin;
}

/** Shape `getLineOption()` actually returns when truthy (`grid/core.ts`'s own return type is
 * `unknown` since `CoreGrid` itself is agnostic to it) - `.type` is ALWAYS a string in practice
 * (never actually split into an array - see `grid/core.ts`'s own documented `getLineOption()`
 * dead-code finding), so every `.indexOf(...)` substring search below is legitimate. */
interface GridLineOption {
  type: string;
  fill?: unknown;
  [key: string]: unknown;
}

/** `chart.text()` (`src/base/builder.ts`'s real `Builder.text(attr, textOrCallback?)`) isn't part
 * of what `axis.js`/`grid/core.js` themselves call, so neither `AxisChart` nor `grid/core.ts`'s
 * own `GridChart` declare it - this file is the first real consumer, so it gets its own narrow
 * local extension, same reconciliation pattern `grid/core.ts`'s header comment already established
 * for `GridChart` itself (confirmed real, not invented: `Builder.text()` already exists). */
type Draw2DChart = GridChart & {
  text(attr: Record<string, unknown>, content?: unknown): TransElement;
};

/** The extra mixin-internal methods `grid/core.ts`'s `CoreGrid` does NOT declare fields for
 * (unlike `createGridX`/`createGridY`/`drawImage`/`drawValueText`, which it does) - these exist
 * purely to support the ones `CoreGrid` needs, and to be available to future `grid/*.ts` leaf
 * subclasses (e.g. `block.ts`/`range.ts`, not yet ported) that call `this.drawPattern(...)`
 * directly, exactly like the original. */
interface Draw2DTargetExtra {
  fillRectObject(g: TransElement, line: GridLineOption, position: string, x: number, y: number, width: number, height: number): void;
  drawAxisLine(position: string, g: TransElement, attr: Record<string, unknown>): void;
  drawPattern(position: string | undefined, ticks: unknown[] | undefined, values: number[] | undefined, isMove?: boolean): void;
  drawBaseLine(position: string, g: TransElement): void;
  drawValueLine(position: string, axis: TransElement, isActive: boolean, line: GridLineOption, index: number, isLast: boolean): void;
}

type Draw2DTarget = CoreGrid & Draw2DTargetExtra & { chart: Draw2DChart };

/**
 * Applies `Draw2DGrid`'s method set onto a real `CoreGrid` instance - see this file's header
 * comment for why this is a plain-function-closure mixin, not a class-instance-then-copy.
 * Satisfies `grid/core.ts`'s exported `GridDrawMixinApplier` type exactly.
 */
export function applyDraw2DGridMixin(target: CoreGrid): void {
  const self = target as unknown as Draw2DTarget;

  const createGridX = (position: string, index: number, x: number, isActive: boolean, isLast: boolean): TransElement => {
    const line = self.getLineOption() as GridLineOption | false;
    const axis = self.chart.svg.group().translate(x, 0);
    const size = self.chart.theme("gridTickBorderSize") as number;

    axis.append(
      self.line({
        y2: position === "bottom" ? size : -size,
        stroke: self.color(isActive, "gridActiveBorderColor", "gridXAxisBorderColor"),
        "stroke-width": self.chart.theme("gridTickBorderWidth"),
      }),
    );

    if (line) {
      self.drawValueLine(position, axis, isActive, line, index, isLast);
    }

    return axis;
  };

  const createGridY = (position: string, index: number, y: number, isActive: boolean, isLast: boolean): TransElement => {
    const line = self.getLineOption() as GridLineOption | false;
    const axis = self.chart.svg.group().translate(0, y);
    const size = self.chart.theme("gridTickBorderSize") as number;

    axis.append(
      self.line({
        x2: position === "left" ? -size : size,
        stroke: self.color(isActive, "gridActiveBorderColor", "gridYAxisBorderColor"),
        "stroke-width": self.chart.theme("gridTickBorderWidth"),
      }),
    );

    if (line) {
      self.drawValueLine(position, axis, isActive, line, index, isLast);
    }

    return axis;
  };

  const fillRectObject = (g: TransElement, line: GridLineOption, position: string, x: number, y: number, width: number, height: number): void => {
    if (line.type.indexOf("gradient") > -1) {
      g.append(
        self.chart.svg.rect({
          x,
          y,
          height,
          width,
          fill: self.chart.color(
            line.fill
              ? line.fill
              : "linear(" + position + ") " + self.chart.theme("gridPatternColor") + ",0.5 " + self.chart.theme("backgroundColor"),
          ),
          "fill-opacity": self.chart.theme("gridPatternOpacity"),
        }),
      );
    } else if (line.type.indexOf("rect") > -1) {
      g.append(
        self.chart.svg.rect({
          x,
          y,
          height,
          width,
          fill: self.chart.color(line.fill ? line.fill : self.chart.theme("gridPatternColor")),
          "fill-opacity": self.chart.theme("gridPatternOpacity"),
        }),
      );
    }
  };

  /**
   * @method drawAxisLine
   * theme 이 적용된 axis line 리턴 (returns a themed axis line). Uses `this.chart.svg.line(...)`
   * directly - NOT `this.line(...)` (`grid/core.ts`'s own default-merging helper, used by
   * `drawValueLine` below) - a genuinely different default attribute set (no
   * `stroke-dasharray`/theme-driven width defaults; always `stroke-opacity: 1`). Preserved
   * verbatim, not unified.
   */
  const drawAxisLine = (position: string, g: TransElement, attr: Record<string, unknown>): void => {
    const isTopOrBottom = position === "top" || position === "bottom";

    g.append(
      self.chart.svg.line(
        extend(
          {
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0,
            stroke: self.color(isTopOrBottom ? "gridXAxisBorderColor" : "gridYAxisBorderColor"),
            "stroke-width": self.chart.theme(isTopOrBottom ? "gridXAxisBorderWidth" : "gridYAxisBorderWidth"),
            "stroke-opacity": 1,
          },
          attr,
        ),
      ),
    );
  };

  const drawPattern = (position: string | undefined, ticks: unknown[] | undefined, values: number[] | undefined, isMove?: boolean): void => {
    if (self.grid.hide) return;
    if (!position) return;
    if (!ticks) return;
    if (!values) return;

    const line = self.getLineOption() as GridLineOption | false;
    const isY = position === "left" || position === "right";
    const g = self.chart.svg.group();

    g.translate(self.axis.area("x") + self.chart.area("x"), self.axis.area("y") + self.chart.area("y"));

    if (line && (line.type.indexOf("gradient") > -1 || line.type.indexOf("rect") > -1)) {
      for (let i = 0; i < values.length - 1; i += 2) {
        const dist = Math.abs(values[i + 1] - values[i]);
        const pos = values[i] - (isMove ? dist / 2 : 0);
        const x = isY ? 0 : pos;
        const y = isY ? pos : 0;
        const width = isY ? self.axis.area("width") : dist;
        const height = isY ? dist : self.axis.area("height");

        self.fillRectObject(g, line, position, x, y, width, height);
      }
    }
  };

  const drawBaseLine = (position: string, g: TransElement): void => {
    const obj = self.getGridSize();
    let pos: Record<string, unknown> = {};

    if (position === "bottom" || position === "top") {
      pos = { x1: obj.start, x2: obj.end };
    } else if (position === "left" || position === "right") {
      pos = { y1: obj.start, y2: obj.end };
    }

    self.drawAxisLine(position, g, pos);
  };

  const drawValueLine = (position: string, axis: TransElement, isActive: boolean, line: GridLineOption, index: number, isLast: boolean): void => {
    let area: Record<string, unknown> = {};
    let isDrawLine = false;

    if (position === "top") {
      isDrawLine = self.checkDrawLineY(index, isLast);
      area = { x1: 0, x2: 0, y1: 0, y2: self.axis.area("height") };
    } else if (position === "bottom") {
      isDrawLine = self.checkDrawLineY(index, isLast);
      area = { x1: 0, x2: 0, y1: 0, y2: -self.axis.area("height") };
    } else if (position === "left") {
      isDrawLine = self.checkDrawLineX(index, isLast);
      area = { x1: 0, x2: self.axis.area("width"), y1: 0, y2: 0 };
    } else if (position === "right") {
      isDrawLine = self.checkDrawLineX(index, isLast);
      area = { x1: 0, x2: -self.axis.area("width"), y1: 0, y2: 0 };
    }

    if (isDrawLine) {
      const lineObject = self.line(
        extend(
          {
            stroke: self.chart.theme(isActive, "gridActiveBorderColor", "gridBorderColor"),
            "stroke-width": self.chart.theme(isActive, "gridActiveBorderWidth", "gridBorderWidth"),
          },
          area,
        ),
      );

      if (line.type.indexOf("dashed") > -1) {
        const dash = self.chart.theme("gridBorderDashArray");
        lineObject.attr({
          "stroke-dasharray": dash === "none" || !dash ? "3,3" : dash,
        });
      }

      axis.append(lineObject);
    }
  };

  // `_index`/`_xy` (`noUnusedParameters`-satisfying names): the original's own `drawValueText`
  // declares `index`/`xy` too but never references either anywhere in its body - genuinely unused
  // parameters upstream, kept here (positionally, unused) purely so this function's arity/argument
  // order still matches `grid/core.ts`'s `drawTop`/`drawBottom`/`drawLeft`/`drawRight` call sites
  // (`this.drawValueText(position, axis, i, values[i], domain, moveX, isActive)`) and its own
  // declared `drawValueText!` field type exactly.
  const drawValueText = (position: string, axis: TransElement, _index: number, _xy: number, domain: unknown, move: number, isActive: boolean): void => {
    if (self.grid.hideText) return;

    const chart = self.chart;

    if (position === "top") {
      axis.append(
        self.getTextRotate(
          chart.text(
            {
              x: move,
              y: -((chart.theme("gridTickBorderSize") as number) + (chart.theme("gridTickPadding") as number) * 2),
              dy: (chart.theme("gridXFontSize") as number) / 3,
              fill: chart.theme(isActive, "gridActiveFontColor", "gridXFontColor"),
              "text-anchor": "middle",
              "font-size": chart.theme("gridXFontSize"),
              "font-weight": chart.theme("gridXFontWeight"),
            },
            domain,
          ),
        ),
      );
    } else if (position === "bottom") {
      axis.append(
        self.getTextRotate(
          chart.text(
            {
              x: move,
              y: (chart.theme("gridTickBorderSize") as number) + (chart.theme("gridTickPadding") as number) * 2,
              dy: (chart.theme("gridXFontSize") as number) / 3,
              fill: chart.theme(isActive, "gridActiveFontColor", "gridXFontColor"),
              "text-anchor": "middle",
              "font-size": chart.theme("gridXFontSize"),
              "font-weight": chart.theme("gridXFontWeight"),
            },
            domain,
          ),
        ),
      );
    } else if (position === "left") {
      axis.append(
        self.getTextRotate(
          chart.text(
            {
              x: -(chart.theme("gridTickBorderSize") as number) - (chart.theme("gridTickPadding") as number),
              y: move,
              dy: (chart.theme("gridYFontSize") as number) / 3,
              fill: chart.theme(isActive, "gridActiveFontColor", "gridYFontColor"),
              "text-anchor": "end",
              "font-size": chart.theme("gridYFontSize"),
              "font-weight": chart.theme("gridYFontWeight"),
            },
            domain,
          ),
        ),
      );
    } else if (position === "right") {
      axis.append(
        self.getTextRotate(
          chart.text(
            {
              x: (chart.theme("gridTickBorderSize") as number) + (chart.theme("gridTickPadding") as number),
              y: move,
              dy: (chart.theme("gridYFontSize") as number) / 3,
              fill: chart.theme(isActive, "gridActiveFontColor", "gridYFontColor"),
              "text-anchor": "start",
              "font-size": chart.theme("gridYFontSize"),
              "font-weight": chart.theme("gridYFontWeight"),
            },
            domain,
          ),
        ),
      );
    }

  };

  const drawImage = (orient: string, g: TransElement, tick: unknown, index: number, x: number, y: number): void => {
    if (!typeCheck("function", self.grid.image)) return;

    const opts: unknown = (self.grid.image as (...args: unknown[]) => unknown).apply(self.chart, [tick, index]);

    if (typeCheck("object", opts)) {
      const o = opts as { uri?: unknown; width: number; height: number; dist: number };
      const image = self.chart.svg.image({
        "xlink:href": o.uri,
        width: o.width,
        height: o.height,
      });

      if (orient === "top" || orient === "bottom") {
        image.attr({
          x: self.grid.type === "block" ? self.scale.rangeBand() / 2 - o.width / 2 : -(o.width / 2),
        });
      } else if (orient === "left" || orient === "right") {
        image.attr({
          y: self.grid.type === "block" ? self.scale.rangeBand() / 2 - o.height / 2 : -(o.height / 2),
        });
      }

      if (orient === "bottom") {
        image.attr({ y: o.dist });
      } else if (orient === "top") {
        image.attr({ y: -(o.dist + o.height) });
      } else if (orient === "left") {
        image.attr({ x: -(o.dist + o.width) });
      } else if (orient === "right") {
        image.attr({ x: o.dist });
      }

      image.translate(x, y);
      g.append(image);
    }
  };

  Object.assign(target, {
    createGridX,
    createGridY,
    fillRectObject,
    drawAxisLine,
    drawPattern,
    drawBaseLine,
    drawValueLine,
    drawValueText,
    drawImage,
  });
}

registerGridDraw2D(applyDraw2DGridMixin);
