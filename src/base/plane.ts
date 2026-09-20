// Port of juijs-graph's `src/base/plane.js` ("chart.plane", extend: "core").
//
// `Plane` is a preset "3D scatter/plane chart" UI type built ENTIRELY on top of `chart.builder`
// (this project's `Builder`) - it never touches SVG/axis/brush classes directly, only assembles a
// declarative `{axis, brush, widget}` config object and hands it to `Builder`. `render()`'s
// `builder(this.root, {...})` call in the original is NOT a call to `builder.js`'s own export -
// `jui.include("chart.builder")` resolves to `Core.init({type: "chart.builder", class: Builder})`,
// i.e. Core's bound factory (allocate, wire `root`/`options`, merge against `Builder.setup()`,
// call `init()`) - reproduced here as `new Builder().mount(this.root, {...})`.
//
// RECONCILIATION NOTE (base/core.ts has landed): `Plane` now really `extends Core`
// (`src/base/core.ts`) instead of carrying its own duplicate "Core stand-in" fields/`mount()`.
// `root`/`options`/`event`/`index`/`timestamp`, `emit()`/`on()`/`off()`/`setOption()`/`destroy()`,
// and `mount()` are all inherited unmodified - `plane.js` never redefines any of them (confirmed
// by grep: the original only ever defines its own `this.init`), so there is no override here
// either, purely `extends Core<PlaneOptions>` and deleting the old stand-in block. The `Builder`
// instance `render()` constructs (`new Builder().mount(...)`) is a SEPARATE `Core` subclass
// instance, unrelated to `Plane`'s own inherited fields - unaffected by this reconciliation either
// way, still exactly the pre-existing `Builder.mount()` call.
//
// No observable behavior change versus the pre-Core stand-in: unlike `Builder`, `Plane` never
// reads `options.event`, so `Core.mount()`'s newly-real `options.event` binding (see `builder.ts`'s
// reconciliation note for the detail) is exercised here too but has nothing to bind against in any
// existing test/usage - purely additive, verified inert for `Plane` specifically.
import { Builder, type BuilderOptions } from "./builder";
import { Core, type CoreOptions } from "./core";

type TypeCheckable = string | number | boolean | symbol | object | null | undefined | Function;

function typeCheck(type: string | string[], value: TypeCheckable): boolean {
  function check(t: string, v: TypeCheckable): boolean {
    if (typeof t !== "string") return false;
    if (t === "array") return v instanceof Array;
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

function isRecursive(value: any): boolean {
  return typeof value === "object" && value !== null && !(value instanceof Array) && !(value instanceof Date) && !(value instanceof RegExp);
}

function extend(origin: any, add: any, skip?: boolean): any {
  if (typeof origin !== "object" && typeof origin !== "function") origin = {};
  if ((typeof add !== "object" && typeof add !== "function") || add === null) return origin;

  for (const key in add) {
    if (skip === true) {
      if (isRecursive(origin[key])) {
        extend(origin[key], add[key], skip);
      } else if (typeof origin[key] === "undefined") {
        origin[key] = add[key];
      }
    } else {
      if (isRecursive(origin[key])) {
        extend(origin[key], add[key], skip);
      } else {
        origin[key] = add[key];
      }
    }
  }

  return origin;
}

export interface PlaneOptions extends CoreOptions {
  dimension: "2d" | "3d";
  width: number;
  height: number;
  depth: number;
  padding: number;
  x: [number, number];
  y: [number, number];
  z: [number, number];
  step: number;
  line: boolean;
  symbol: string;
  r: number;
  perspective: number;
  dx: number;
  dy: number;
  dz: number;
  colors: string[] | null;
  [key: string]: any;
}

// `Plane` really `extends Core` now (see header comment) - `root`/`options`/`event`/`index`/
// `timestamp`, `emit()`/`on()`/`off()`/`setOption()`/`destroy()`, and `mount()` all come from
// `Core` unmodified; `plane.js` never overrides any of them.
export class Plane extends Core<PlaneOptions> {
  private chart: Builder | null = null;
  private axis: any[] = [];
  private brush: any[] = [];
  private widget: any[] = [];

  private axisIndex = 0;
  private baseAxis: Record<string, any> = {};
  private etcAxis: Record<string, any> = {};

  init(): void {
    const opts = this.options;
    const defAxis = {
      type: "range",
      step: opts.step,
      line: opts.line,
    };

    this.baseAxis.x = extend({ domain: opts.x }, defAxis);
    this.baseAxis.y = extend({ domain: opts.y }, defAxis);
    this.baseAxis.x.orient = "bottom";
    this.baseAxis.y.orient = "left";
    this.baseAxis.z = extend({ domain: opts.z }, defAxis);
    this.baseAxis.depth = opts.depth - opts.padding * 2;
    this.baseAxis.degree = { x: opts.dx, y: opts.dy, z: opts.dz };
    this.baseAxis.perspective = opts.perspective;

    this.etcAxis.extend = 0;
    this.etcAxis.x = { hide: true };
    this.etcAxis.y = { hide: true };
    this.etcAxis.z = { hide: true };

    if (opts.dimension === "2d") {
      this.baseAxis.perspective = 1;
      this.baseAxis.degree.x = 0;
      this.baseAxis.degree.y = 0;
      this.baseAxis.degree.z = 0;
      this.baseAxis.z.hideText = true;
    }
  }

  push(data: any): void {
    if (!typeCheck("array", data)) return;

    if (!this.axis[this.axisIndex]) {
      this.axis.push(extend({}, this.axisIndex === 0 ? this.baseAxis : this.etcAxis));
    }

    if (!this.axis[this.axisIndex].data) {
      this.axis[this.axisIndex].data = [];
    }

    this.axis[this.axisIndex].data.push(data);
  }

  commit(symbol?: string, r?: number): void {
    const opts = this.options;

    this.brush.push({
      type: "canvas.dot3d",
      color: this.axisIndex,
      axis: this.axisIndex,
      symbol: symbol || opts.symbol,
      size: (r || opts.r) * 2,
    });

    this.axisIndex++;
  }

  append(datas: any[], symbol?: string, r?: number): void {
    const opts = this.options;

    this.axis.push(extend({}, this.axisIndex === 0 ? this.baseAxis : this.etcAxis));
    this.axis[this.axisIndex].data = datas;

    this.brush.push({
      type: "canvas.dot3d",
      color: this.axisIndex,
      axis: this.axisIndex,
      symbol: symbol || opts.symbol,
      size: (r || opts.r) * 2,
    });

    this.axisIndex++;
  }

  render(): void {
    const opts = this.options;

    if (opts.dimension === "3d") {
      this.widget.push({
        type: "polygon.rotate3d",
      });
    }

    if (this.chart != null) {
      this.chart.root.innerHTML = "";
      this.chart = null;
    }

    if (this.axis.length === 0) {
      this.axis.push(this.baseAxis);
    }

    const chart = new Builder().mount(this.root, {
      padding: opts.padding,
      width: opts.width,
      height: opts.height,
      axis: this.axis,
      brush: this.brush,
      widget: this.widget,
      canvas: true,
      render: false,
      style: {
        gridFaceBackgroundOpacity: 0.1,
      },
    } as Partial<BuilderOptions>);
    this.chart = chart;

    if (typeCheck("array", opts.colors)) {
      const colors: string[] = [];

      for (let i = 0; i < (opts.colors as string[]).length; i++) {
        colors.push(chart.color((opts.colors as string[])[i]));
      }

      chart.setTheme({ colors });
    }

    this.axis = [];
    this.brush = [];
    this.widget = [];
    this.axisIndex = 0;

    chart.render();
  }

  static setup(): PlaneOptions {
    return {
      dimension: "2d",
      width: 500,
      height: 500,
      depth: 500,
      padding: 50,
      x: [-100, 100],
      y: [-100, 100],
      z: [-100, 100],
      step: 4,
      line: true,
      symbol: "dot",
      r: 2,
      perspective: 0.9,
      dx: 10,
      dy: 5,
      dz: 0,
      colors: null,
    };
  }
}
