import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoreBrush } from "./core";
import type { BrushChart, BrushOptions, BrushAxisScale, BrushData } from "./core";
import type { Axis } from "../base/axis";
import { offset as domOffset } from "../util/dom";
import { SVG } from "../util/svg";
import type { TransElement } from "../util/svg/element.transform";

// ---------------------------------------------------------------------------------------------
// Test doubles - same convention `grid/core.spec.ts`/`widget/core.spec.ts` established: plain
// objects satisfying `CoreBrush`'s real structural needs (`BrushChart`/`Axis`). `axis` is cast
// (`as unknown as Axis`) since `Axis` is a real class with private fields - genuinely un-fakeable
// via a plain object literal (same reasoning `grid/core.spec.ts`'s own `makeAxisStub` documents).
// ---------------------------------------------------------------------------------------------

function makeScale(fn: (v: unknown) => number, type?: string, rangeBand?: number): BrushAxisScale {
  const scale = fn as BrushAxisScale;
  scale.type = type;
  scale.rangeBand = () => rangeBand ?? 0;
  return scale;
}

function makeChart(overrides: Partial<BrushChart> = {}): { chart: BrushChart; svg: SVG; root: HTMLElement } {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const svg = new SVG(root, { width: 400, height: 300 });

  const themeValues: Record<string, string | number> = {
    tooltipPointFontColor: "#333",
    tooltipPointFontSize: 11,
    tooltipPointFontWeight: "bold",
    tooltipPointRadius: 3,
    tooltipPointBorderWidth: 1,
  };

  const chart: BrushChart = {
    on: vi.fn(),
    axis: vi.fn(() => undefined),
    format: (v: unknown) => v,
    area: vi.fn((key: string) => (key === "x" ? 15 : key === "y" ? 25 : 0)),
    svg,
    root,
    color: vi.fn((k1?: unknown, k2?: unknown) => `color(${JSON.stringify(k1)},${JSON.stringify(k2)})`),
    theme: vi.fn((key?: unknown) => themeValues[key as string]),
    text: vi.fn((attr: Record<string, any>, textOrCallback?: string | ((this: any) => void)) => svg.text(attr, textOrCallback as any)),
    padding: vi.fn((key?: string) => (key === "left" ? 5 : key === "top" ? 8 : 0)),
    emit: vi.fn(),
    ...overrides,
  };

  return { chart, svg, root };
}

interface AxisStubOptions {
  data?: BrushData[];
  x?: BrushAxisScale;
  y?: BrushAxisScale;
  z?: BrushAxisScale;
  get?: (type: string) => unknown;
  getValue?: (data: BrushData, fieldString: string, defaultValue?: unknown) => unknown;
}

function makeAxisStub(opts: AxisStubOptions = {}): Axis {
  const stub = {
    data: opts.data ?? [],
    x: opts.x,
    y: opts.y,
    z: opts.z,
    get: opts.get ?? ((type: string) => (type === "clipId" ? "axis-clip-id-0.0" : undefined)),
    getValue: opts.getValue ?? ((data: BrushData, fieldString: string, defaultValue?: unknown) => data[fieldString] ?? defaultValue),
  };

  return stub as unknown as Axis;
}

function makeBrush(overrides: BrushOptions = {}): BrushOptions {
  return { target: null, colors: null, axis: 0, index: null, clip: true, useEvent: true, type: "test", ...overrides };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("CoreBrush", () => {
  describe("static setup()", () => {
    it("returns the exact 6-key defaults (no display/active - see header comment's cross-check correction)", () => {
      expect(CoreBrush.setup()).toEqual({
        target: null,
        colors: null,
        axis: 0,
        index: null,
        clip: true,
        useEvent: true,
      });
    });
  });

  describe("listData/getData/getValue", () => {
    it("listData() returns [] when axis is not wired yet", () => {
      const b = new CoreBrush();
      expect(b.listData()).toEqual([]);
    });

    it("listData() returns [] when axis.data is falsy", () => {
      const b = new CoreBrush();
      b.axis = makeAxisStub({ data: undefined as any });
      expect(b.listData()).toEqual([]);
    });

    it("listData() returns axis.data directly", () => {
      const rows = [{ a: 1 }, { a: 2 }];
      const b = new CoreBrush();
      b.axis = makeAxisStub({ data: rows });
      expect(b.listData()).toBe(rows);
    });

    it("getData(index) reads listData()[index]", () => {
      const rows = [{ a: 1 }, { a: 2 }];
      const b = new CoreBrush();
      b.axis = makeAxisStub({ data: rows });
      expect(b.getData(1)).toBe(rows[1]);
    });

    it("getValue delegates to axis.getValue(data, fieldString, defaultValue)", () => {
      const b = new CoreBrush();
      const getValue = vi.fn(() => "resolved");
      b.axis = makeAxisStub({ getValue });
      const row = { a: 1 };
      expect(b.getValue(row, "a", "def")).toBe("resolved");
      expect(getValue).toHaveBeenCalledWith(row, "a", "def");
    });
  });

  describe("eachData", () => {
    it("no-op when callback is not a function", () => {
      const b = new CoreBrush();
      b.axis = makeAxisStub({ data: [{ a: 1 }] });
      // @ts-expect-error - deliberately wrong type, matches the original's own runtime guard
      expect(() => b.eachData("not a function")).not.toThrow();
    });

    it("default (non-reverse) order calls callback(data, index) - ascending", () => {
      const rows = [{ a: 1 }, { a: 2 }, { a: 3 }];
      const b = new CoreBrush();
      b.axis = makeAxisStub({ data: rows });

      const seen: Array<[unknown, unknown]> = [];
      b.eachData(function (data, index) {
        seen.push([data, index]);
      });

      expect(seen).toEqual([
        [rows[0], 0],
        [rows[1], 1],
        [rows[2], 2],
      ]);
    });

    it("PRESERVED QUIRK: reverse:true calls callback(index, data) - SWAPPED argument order, descending", () => {
      const rows = [{ a: 1 }, { a: 2 }, { a: 3 }];
      const b = new CoreBrush();
      b.axis = makeAxisStub({ data: rows });

      const seen: Array<[unknown, unknown]> = [];
      b.eachData(function (arg1, arg2) {
        seen.push([arg1, arg2]);
      }, true);

      // descending index order (2,1,0), but arg1 is the INDEX and arg2 is the ROW - reversed
      // shape from the non-reverse branch above, not just reversed order.
      expect(seen).toEqual([
        [2, rows[2]],
        [1, rows[1]],
        [0, rows[0]],
      ]);
    });

    it("callback runs with `this` bound to the CoreBrush instance", () => {
      const b = new CoreBrush();
      b.axis = makeAxisStub({ data: [{ a: 1 }] });
      b.brush = makeBrush({ target: ["a"] });

      let capturedTarget: unknown;
      b.eachData(function (this: CoreBrush) {
        capturedTarget = this.brush.target;
      });

      expect(capturedTarget).toEqual(["a"]);
    });
  });

  describe("curvePoints", () => {
    it("matches jui-chart-vue's reused hand-solved Thomas-algorithm oracle for K=[0,10,20,30]", () => {
      // Solved by hand via the Thomas algorithm (same oracle jui-chart-vue's `useSeries.spec.ts`
      // uses for its own port of this exact function - see header comment's cross-check):
      // p1 = [10/3, 40/3, 70/3], p2 = [20/3, 50/3, 80/3].
      const b = new CoreBrush();
      const { p1, p2 } = b.curvePoints([0, 10, 20, 30]);

      expect(p1[0]).toBeCloseTo(10 / 3, 6);
      expect(p1[1]).toBeCloseTo(40 / 3, 6);
      expect(p1[2]).toBeCloseTo(70 / 3, 6);

      expect(p2[0]).toBeCloseTo(20 / 3, 6);
      expect(p2[1]).toBeCloseTo(50 / 3, 6);
      expect(p2[2]).toBeCloseTo(80 / 3, 6);
    });
  });

  describe("getXY", () => {
    it("hand-traced: non-range y-axis (y=index once per row, x=value per target), with min/max flags", () => {
      const rows: BrushData[] = [
        { a: 1, b: 5 },
        { a: 2, b: 6 },
        { a: 3, b: 4 },
      ];
      const b = new CoreBrush();
      b.axis = makeAxisStub({
        data: rows,
        x: makeScale((v) => (v as number) * 10, "value"),
        y: makeScale((v) => (v as number) * 100, "index"),
      });
      b.brush = makeBrush({ target: ["a", "b"] });

      const xy = b.getXY();

      // target "a": values [1,2,3] -> x = [10,20,30], y constant per row (0,100,200)
      expect(xy[0].x).toEqual([10, 20, 30]);
      expect(xy[0].y).toEqual([0, 100, 200]);
      expect(xy[0].value).toEqual([1, 2, 3]);
      // min=1 (row0), max=3 (row2)
      expect(xy[0].min).toEqual([true, false, false]);
      expect(xy[0].max).toEqual([false, false, true]);

      // target "b": values [5,6,4] -> x = [50,60,40], SAME y as target "a" per row
      expect(xy[1].x).toEqual([50, 60, 40]);
      expect(xy[1].y).toEqual([0, 100, 200]);
      expect(xy[1].value).toEqual([5, 6, 4]);
      // min=4 (row2), max=6 (row1)
      expect(xy[1].min).toEqual([false, false, true]);
      expect(xy[1].max).toEqual([false, true, false]);
    });

    it("hand-traced: isRangeY=true swaps roles (x=index once per row, y=value per target)", () => {
      const rows: BrushData[] = [
        { a: 1, b: 5 },
        { a: 2, b: 6 },
      ];
      const b = new CoreBrush();
      b.axis = makeAxisStub({
        data: rows,
        x: makeScale((v) => (v as number) * 100, "index"),
        y: makeScale((v) => (v as number) * 10, "range"),
      });
      b.brush = makeBrush({ target: ["a", "b"] });

      const xy = b.getXY();

      // target "a": y = [10,20], x constant per row (0,100)
      expect(xy[0].y).toEqual([10, 20]);
      expect(xy[0].x).toEqual([0, 100]);
      // target "b": y = [50,60], SAME x as target "a" per row
      expect(xy[1].y).toEqual([50, 60]);
      expect(xy[1].x).toEqual([0, 100]);
    });

    it("isCheckMinMax=false skips getMinMaxValue - min/max stay empty arrays", () => {
      const rows: BrushData[] = [{ a: 1 }, { a: 5 }];
      const b = new CoreBrush();
      b.axis = makeAxisStub({
        data: rows,
        x: makeScale((v) => v as number, "value"),
        y: makeScale((v) => v as number, "index"),
      });
      b.brush = makeBrush({ target: ["a"] });

      const xy = b.getXY(false);
      expect(xy[0].min).toEqual([]);
      expect(xy[0].max).toEqual([]);
    });

    it("PRESERVED: `_.loop()`'s interleaved (not sequential) row-visit order for total=7, Node-cross-checked", () => {
      // Hand-simulated against the literal `base/base.js` `loop()` algorithm (unit=ceil(7/5)=2):
      // visitation order is 0,2,4,6,1,3,5 (round-robin across 5 buckets), NOT 0,1,2,3,4,5,6.
      const rows: BrushData[] = Array.from({ length: 7 }, (_, i) => ({ a: i }));
      const visitOrder: number[] = [];

      const b = new CoreBrush();
      b.axis = makeAxisStub({
        data: rows,
        x: makeScale((v) => v as number, "value"),
        y: makeScale((v) => {
          visitOrder.push(v as number);
          return v as number;
        }, "index"),
      });
      b.brush = makeBrush({ target: ["a"] });

      b.getXY();

      expect(visitOrder).toEqual([0, 2, 4, 6, 1, 3, 5]);
    });
  });

  describe("getStackXY", () => {
    it("hand-traced: cumulative stacking on the recomputed axis (x here), value/min/max left as raw (from getXY)", () => {
      const rows: BrushData[] = [
        { a: 2, b: 3 },
        { a: 5, b: 1 },
      ];
      const b = new CoreBrush();
      b.axis = makeAxisStub({
        data: rows,
        x: makeScale((v) => (v as number) * 10, "value"),
        y: makeScale((v) => (v as number) * 100, "index"),
      });
      b.brush = makeBrush({ target: ["a", "b"] });

      const xy = b.getStackXY();

      // j=0 ("a"): valueSum=0 -> x = xScale(a) = [20, 50]
      expect(xy[0].x).toEqual([20, 50]);
      // j=1 ("b"): valueSum = a -> x = xScale(a+b) = xScale(5)=50, xScale(6)=60
      expect(xy[1].x).toEqual([50, 60]);
      // `value` is untouched by stacking - stays the RAW field value, not the cumulative sum.
      expect(xy[0].value).toEqual([2, 5]);
      expect(xy[1].value).toEqual([3, 1]);
    });
  });

  describe("addEvent", () => {
    function makeElem() {
      const handlers: Record<string, (e: any) => void> = {};
      const elem = {
        on: vi.fn((type: string, handler: (e: any) => void) => {
          handlers[type] = handler;
          return elem;
        }),
      };
      return { elem: elem as any, handlers };
    }

    it("does nothing (no listeners bound) when brush.useEvent !== true", () => {
      const { chart } = makeChart();
      const { elem } = makeElem();
      const b = new CoreBrush();
      b.chart = chart;
      b.brush = makeBrush({ useEvent: false });

      b.addEvent(elem, 0, 0);
      expect(elem.on).not.toHaveBeenCalled();
    });

    it("object-form: typeCheck('object', dataIndex) && !targetIndex sets obj.data directly, no dataIndex/dataKey", () => {
      const { chart } = makeChart();
      const { elem, handlers } = makeElem();
      const b = new CoreBrush();
      b.chart = chart;
      b.brush = makeBrush({ target: ["a", "b"] });

      const row = { a: 1, b: 2 };
      b.addEvent(elem, row as any);

      const fakeEvent: any = { pageX: 100, pageY: 60, preventDefault: vi.fn() };
      handlers["click"](fakeEvent);

      expect(chart.emit).toHaveBeenCalledTimes(1);
      const [type, args] = (chart.emit as any).mock.calls[0];
      expect(type).toBe("click");
      const obj = args[0];
      expect(obj.data).toBe(row);
      expect(obj.dataIndex).toBeUndefined();
      expect(obj.dataKey).toBeUndefined();
    });

    it("index-form: resolves dataIndex/dataKey/data via brush.target and getData()", () => {
      const { chart, root } = makeChart();
      const { elem, handlers } = makeElem();
      const rows: BrushData[] = [{ a: 1 }, { a: 9 }];
      const b = new CoreBrush();
      b.chart = chart;
      b.axis = makeAxisStub({ data: rows });
      b.brush = makeBrush({ target: ["a", "b"] });

      b.addEvent(elem, 1, 0);

      const fakeEvent: any = { pageX: 120, pageY: 80, preventDefault: vi.fn() };
      handlers["click"](fakeEvent);

      const pos = domOffset(root)!;
      const [, args] = (chart.emit as any).mock.calls[0];
      const obj = args[0];
      expect(obj.dataIndex).toBe(1);
      expect(obj.dataKey).toBe("a");
      expect(obj.data).toBe(rows[1]);
      // setMouseEvent() stamping, cross-checked against chart.padding stub (left:5, top:8).
      expect(fakeEvent.bgX).toBe(120 - pos.left);
      expect(fakeEvent.bgY).toBe(80 - pos.top);
      expect(fakeEvent.chartX).toBe(120 - pos.left - 5);
      expect(fakeEvent.chartY).toBe(80 - pos.top - 8);
    });

    it("contextmenu handler emits 'rclick' and calls preventDefault", () => {
      const { chart } = makeChart();
      const { elem, handlers } = makeElem();
      const b = new CoreBrush();
      b.chart = chart;
      b.axis = makeAxisStub({ data: [{ a: 1 }] });
      b.brush = makeBrush({ target: ["a"] });

      b.addEvent(elem, 0, null);

      const fakeEvent: any = { pageX: 0, pageY: 0, preventDefault: vi.fn() };
      handlers["contextmenu"](fakeEvent);

      expect(chart.emit).toHaveBeenCalledWith("rclick", [expect.anything(), fakeEvent]);
      expect(fakeEvent.preventDefault).toHaveBeenCalledTimes(1);
    });

    it("registers all 8 event types (click/dblclick/contextmenu/mouseover/mouseout/mousemove/mousedown/mouseup)", () => {
      const { chart } = makeChart();
      const { elem } = makeElem();
      const b = new CoreBrush();
      b.chart = chart;
      b.axis = makeAxisStub({ data: [{ a: 1 }] });
      b.brush = makeBrush({ target: ["a"] });

      b.addEvent(elem, 0, null);

      const registeredTypes = (elem.on as any).mock.calls.map((c: any[]) => c[0]);
      expect(registeredTypes).toEqual([
        "click",
        "dblclick",
        "contextmenu",
        "mouseover",
        "mouseout",
        "mousemove",
        "mousedown",
        "mouseup",
      ]);
    });
  });

  describe("color", () => {
    it("1-arg form: key1 is colorIndex, rowIndex defaults to 0", () => {
      const { chart } = makeChart();
      const b = new CoreBrush();
      b.chart = chart;
      b.brush = makeBrush({ colors: ["#f00", "#0f0"] });

      b.color(1);
      expect(chart.color).toHaveBeenCalledWith(1, ["#f00", "#0f0"]);
    });

    it("2-arg form: key1 is rowIndex, key2 is colorIndex", () => {
      const { chart } = makeChart();
      const b = new CoreBrush();
      b.chart = chart;
      b.axis = makeAxisStub({ data: [{ a: 1 }, { a: 2 }] });
      const colorsFn = vi.fn(() => "string-color");
      b.brush = makeBrush({ colors: colorsFn as any });

      b.color(1, 3);
      // rowIndex=1 (key1), colorIndex=3 (key2) - getData(rowIndex) is called with rowIndex=1.
      expect(colorsFn).toHaveBeenCalledWith({ a: 2 }, 1);
    });

    it("function colors returning a string resolves via chart.color(newColor)", () => {
      const { chart } = makeChart();
      const b = new CoreBrush();
      b.chart = chart;
      b.axis = makeAxisStub({ data: [{ a: 1 }] });
      b.brush = makeBrush({ colors: (() => "#abc") as any });

      b.color(0);
      expect(chart.color).toHaveBeenCalledWith("#abc");
    });

    it("function colors returning an array resolves via chart.color(colorIndex, newColor)", () => {
      const { chart } = makeChart();
      const b = new CoreBrush();
      b.chart = chart;
      b.axis = makeAxisStub({ data: [{ a: 1 }] });
      b.brush = makeBrush({ colors: (() => ["#a", "#b"]) as any });

      b.color(2);
      expect(chart.color).toHaveBeenCalledWith(2, ["#a", "#b"]);
    });

    it("function colors returning neither string/integer/array falls back to chart.color(0)", () => {
      const { chart } = makeChart();
      const b = new CoreBrush();
      b.chart = chart;
      b.axis = makeAxisStub({ data: [{ a: 1 }] });
      b.brush = makeBrush({ colors: (() => ({ nope: true })) as any });

      b.color(0);
      expect(chart.color).toHaveBeenCalledWith(0);
    });
  });

  describe("offset", () => {
    it("block type: no rangeBand added", () => {
      const b = new CoreBrush();
      b.axis = makeAxisStub({ x: makeScale((v) => (v as number) * 10, "block", 4) });
      expect(b.offset("x", 3)).toBe(30);
    });

    it("non-block type: adds rangeBand()/2", () => {
      const b = new CoreBrush();
      b.axis = makeAxisStub({ x: makeScale((v) => (v as number) * 10, "value", 4) });
      expect(b.offset("x", 3)).toBe(30 + 2);
    });
  });

  describe("drawAfter", () => {
    function makeFakeTransElement() {
      const attrs: Record<string, unknown> = {};
      const translateArgs: unknown[] = [];
      const obj = {
        attr: vi.fn((a: Record<string, unknown>) => {
          Object.assign(attrs, a);
          return obj;
        }),
        translate: vi.fn((...args: unknown[]) => {
          translateArgs.push(...args);
          return obj;
        }),
      };
      return { obj: obj as unknown as TransElement, attrs, translateArgs };
    }

    it("clips (default clip!==false), stamps brush-<type> class, translates to chart.area(x,y)", () => {
      const { chart } = makeChart();
      const b = new CoreBrush();
      b.chart = chart;
      b.axis = makeAxisStub({ get: (type) => (type === "clipId" ? "clip-42" : undefined) });
      b.brush = makeBrush({ clip: true, type: "line" });

      const { obj, attrs, translateArgs } = makeFakeTransElement();
      b.drawAfter(obj);

      expect(attrs["clip-path"]).toBe("url(#clip-42)");
      expect(attrs["class"]).toBe("brush-line");
      expect(translateArgs).toEqual([15, 25]); // chart.area("x")=15, chart.area("y")=25
    });

    it("clip:false skips the clip-path attr entirely", () => {
      const { chart } = makeChart();
      const b = new CoreBrush();
      b.chart = chart;
      b.axis = makeAxisStub();
      b.brush = makeBrush({ clip: false, type: "bar" });

      const { obj, attrs } = makeFakeTransElement();
      b.drawAfter(obj);

      expect(attrs["clip-path"]).toBeUndefined();
      expect(attrs["class"]).toBe("brush-bar");
    });
  });

  describe("drawTooltip", () => {
    it("builds a hidden group with [text, circle] children themed via chart.theme()", () => {
      const { chart } = makeChart();
      const b = new CoreBrush();
      b.chart = chart;

      const { tooltip } = b.drawTooltip("#f00", "#000", 1);

      expect(tooltip.attr("visibility")).toBe("hidden");
      const text = tooltip.get(0)!;
      const circle = tooltip.get(1)!;
      expect(text.element.tagName.toLowerCase()).toBe("text");
      expect(text.attr("fill")).toBe("#333");
      expect(text.attr("font-size")).toBe(11);
      expect(circle.element.tagName.toLowerCase()).toBe("circle");
      expect(circle.attr("r")).toBe(3);
      expect(circle.attr("fill")).toBe("#f00");
    });

    it("control() shows/hides based on value!=0 and orients text per side", () => {
      const { chart } = makeChart();
      const b = new CoreBrush();
      b.chart = chart;
      const { tooltip, control } = b.drawTooltip("#f00", "#000", 1);

      control("left", 10, 20, 5);
      expect(tooltip.attr("visibility")).toBe("visible");
      expect(tooltip.get(0)!.attr("x")).toBe(-7);
      expect(tooltip.get(0)!.attr("text-anchor")).toBe("end");

      control("right", 0, 0, 5);
      expect(tooltip.get(0)!.attr("x")).toBe(7);
      expect(tooltip.get(0)!.attr("text-anchor")).toBe("start");

      control("bottom", 0, 0, 5);
      expect(tooltip.get(0)!.attr("y")).toBe(16);

      control(undefined, 0, 0, 5);
      expect(tooltip.get(0)!.attr("y")).toBe(-7);

      // value == 0 -> hidden, even though visited last with a non-"left"/"right"/"bottom" orient.
      control(undefined, 0, 0, 0);
      expect(tooltip.attr("visibility")).toBe("hidden");
    });

    it("style() re-themes opacity on text and fill/stroke/opacity on circle", () => {
      const { chart } = makeChart();
      const b = new CoreBrush();
      b.chart = chart;
      const { tooltip, style } = b.drawTooltip("#f00", "#000", 1);

      style("#0f0", "#111", 0.5);
      expect(tooltip.get(0)!.attr("opacity")).toBe(0.5);
      expect(tooltip.get(1)!.attr("fill")).toBe("#0f0");
      expect(tooltip.get(1)!.attr("stroke")).toBe("#111");
      expect(tooltip.get(1)!.attr("opacity")).toBe(0.5);
    });
  });
});
