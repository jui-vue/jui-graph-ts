import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoreWidget } from "./core";
import type { WidgetConfig } from "./core";
import { SVG } from "../util/svg";

// ---------------------------------------------------------------------------------------------
// Test doubles - same convention `grid/core.spec.ts` established for `GridChart`/`Axis` stubs:
// plain objects satisfying `CoreWidget`'s real structural needs (`Draw`'s `chart: DrawChartLike`
// field - `on(type, callback, resetType?)`/`axis(index?)`/`format?`).
// ---------------------------------------------------------------------------------------------

function makeChart() {
  const registered: Array<{ type: string; callback: (...args: any[]) => any; resetType?: string }> = [];

  const chart = {
    on: vi.fn((type: string, callback: (...args: any[]) => any, resetType?: string) => {
      registered.push({ type, callback, resetType });
      return { type, callback, resetType };
    }),
    axis: vi.fn((index?: number) => (index === undefined ? undefined : { index })),
    format: (v: unknown) => v,
  };

  return { chart, registered };
}

function makeSvgContainer() {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.appendChild(container);
  return new SVG(container, { width: 400, height: 300 });
}

function makeWidget(overrides: WidgetConfig = {}): WidgetConfig {
  return { render: false, type: "test", index: 0, ...overrides };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("CoreWidget", () => {
  describe("getIndexArray", () => {
    it("defaults to [0] when index is undefined", () => {
      const w = new CoreWidget();
      expect(w.getIndexArray(undefined)).toEqual([0]);
    });

    it("wraps a single integer into a 1-element array", () => {
      const w = new CoreWidget();
      expect(w.getIndexArray(2)).toEqual([2]);
    });

    it("passes an array value through unchanged", () => {
      const w = new CoreWidget();
      expect(w.getIndexArray([1, 3, 5])).toEqual([1, 3, 5]);
    });

    it("defaults to [0] for a non-array, non-integer value (e.g. a float or string)", () => {
      const w = new CoreWidget();
      expect(w.getIndexArray(1.5)).toEqual([0]);
      expect(w.getIndexArray("2")).toEqual([0]);
    });
  });

  describe("getScaleToValue", () => {
    it("maps the min scale to the max value and the max scale to the min value (inverted)", () => {
      const w = new CoreWidget();
      // scale domain [0,10], value domain [0,100]: tick=(10-0)*10=100, step=(100-0)/100=1
      // value = 100 - 1*((scale-0)/0.1)
      expect(w.getScaleToValue(0, 0, 10, 0, 100)).toBe(100);
      expect(w.getScaleToValue(10, 0, 10, 0, 100)).toBe(0);
      // scale=5 -> value = 100 - 1*(5/0.1) = 100 - 50 = 50
      expect(w.getScaleToValue(5, 0, 10, 0, 100)).toBe(50);
    });

    it("clamps below minValue and above maxValue", () => {
      const w = new CoreWidget();
      // scale below minScale pushes value above maxValue -> clamped to maxValue
      expect(w.getScaleToValue(-5, 0, 10, 0, 100)).toBe(100);
      // scale above maxScale pushes value below minValue -> clamped to minValue
      expect(w.getScaleToValue(15, 0, 10, 0, 100)).toBe(0);
    });
  });

  describe("getValueToScale", () => {
    it("is the (rounded) inverse of getScaleToValue for an in-range value", () => {
      const w = new CoreWidget();
      // value domain [0,100], scale domain [0,10]: tick=100, step=1
      // scale = 0 + ((100-value)/1) * 0.1
      expect(w.getValueToScale(100, 0, 100, 0, 10)).toBe(0);
      expect(w.getValueToScale(0, 0, 100, 0, 10)).toBe(10);
      expect(w.getValueToScale(50, 0, 100, 0, 10)).toBe(5);
    });

    it("rounds to 1 decimal place via toFixed(1), unlike getScaleToValue which is unrounded", () => {
      const w = new CoreWidget();
      // value domain [0,3], scale domain [0,10]: tick=100, step=0.03
      // scale = 0 + ((3-1)/0.03)*0.1 = 0 + 66.666...*0.1 = 6.6666... -> toFixed(1) -> "6.7"
      expect(w.getValueToScale(1, 0, 3, 0, 10)).toBe(6.7);
    });

    it("is NOT clamped to [minScale, maxScale] (asymmetric with getScaleToValue, preserved)", () => {
      const w = new CoreWidget();
      // value domain [0,100], scale domain [0,10]: a value outside [0,100] produces a scale
      // outside [0,10] too, with no clamping guard (unlike getScaleToValue's explicit clamp).
      expect(w.getValueToScale(200, 0, 100, 0, 10)).toBe(-10);
    });
  });

  describe("isRender", () => {
    it("returns true only when widget.render is exactly true", () => {
      const w = new CoreWidget();
      w.widget = makeWidget({ render: true });
      expect(w.isRender()).toBe(true);
    });

    it("returns false for render: false, undefined, or a truthy non-true value", () => {
      const w = new CoreWidget();
      w.widget = makeWidget({ render: false });
      expect(w.isRender()).toBe(false);

      w.widget = makeWidget({ render: undefined });
      expect(w.isRender()).toBe(false);

      // `=== true` (not a loose truthy check) - preserved: a truthy-but-not-literal-true value
      // (e.g. the string "true") is NOT considered "render".
      w.widget = makeWidget({ render: "true" as unknown as boolean });
      expect(w.isRender()).toBe(false);
    });
  });

  describe("on", () => {
    it("registers via chart.on with resetType 'renderAll' when isRender() is false (default)", () => {
      const w = new CoreWidget();
      const { chart, registered } = makeChart();
      w.chart = chart as any;
      w.widget = makeWidget({ render: false });

      const cb = vi.fn();
      w.on("click", cb);

      expect(chart.on).toHaveBeenCalledTimes(1);
      expect(registered[0].type).toBe("click");
      expect(registered[0].resetType).toBe("renderAll");
    });

    it("registers via chart.on with resetType 'render' when isRender() is true", () => {
      const w = new CoreWidget();
      const { chart, registered } = makeChart();
      w.chart = chart as any;
      w.widget = makeWidget({ render: true });

      w.on("click", vi.fn());

      expect(registered[0].resetType).toBe("render");
    });

    it("non-'axis.*' events: invokes callback with all forwarded args, this bound to the widget", () => {
      const w = new CoreWidget();
      const { chart, registered } = makeChart();
      w.chart = chart as any;
      w.widget = makeWidget();

      const cb = vi.fn(function (this: unknown) {
        return this;
      });
      w.on("click", cb);

      const dispatched = registered[0].callback;
      dispatched("eventArg", "extra");

      expect(cb).toHaveBeenCalledWith("eventArg", "extra");
      expect(cb.mock.instances[0]).toBe(w);
    });

    it("'axis.*' events with an integer axisIndex: only invokes callback when args[1] matches axisIndex", () => {
      const w = new CoreWidget();
      const { chart, registered } = makeChart();
      w.chart = chart as any;
      w.widget = makeWidget();

      const cb = vi.fn();
      w.on("axis.zoom", cb, 2);

      const dispatched = registered[0].callback;

      // args[1] !== axisIndex -> callback NOT invoked
      dispatched({ foo: "bar" }, 0);
      expect(cb).not.toHaveBeenCalled();

      // args[1] === axisIndex -> callback invoked with ONLY the first arg (the event), per the
      // original's `callback.apply(self, [e])` - extra args are dropped on the axis-scoped path
      // (unlike the non-axis path, which forwards every arg).
      dispatched({ foo: "baz" }, 2, "ignored-extra");
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith({ foo: "baz" });
    });

    it("'axis.*' events: axisIndex resolves via chart.axis(axisIndex), and no dispatch happens when that resolves to undefined", () => {
      const w = new CoreWidget();
      const { chart, registered } = makeChart();
      // chart.axis(index) stub returns undefined for any index - simulates an unresolvable axis.
      chart.axis = vi.fn(() => undefined);
      w.chart = chart as any;
      w.widget = makeWidget();

      const cb = vi.fn();
      w.on("axis.zoom", cb, 3);

      registered[0].callback({}, 3);

      expect(chart.axis).toHaveBeenCalledWith(3);
      expect(cb).not.toHaveBeenCalled();
    });

    it("'axis.*' events without an integer axisIndex: falls through to the non-axis-scoped branch (forwards all args)", () => {
      const w = new CoreWidget();
      const { chart, registered } = makeChart();
      w.chart = chart as any;
      w.widget = makeWidget();

      const cb = vi.fn();
      w.on("axis.zoom", cb, undefined);

      registered[0].callback("e", 5);

      expect(cb).toHaveBeenCalledWith("e", 5);
    });
  });

  describe("drawAfter", () => {
    it("stamps a widget-<type> class onto the drawn element", () => {
      const svg = makeSvgContainer();
      const w = new CoreWidget();
      w.widget = makeWidget({ type: "legend" });

      const rect = svg.rect({ x: 0, y: 0, width: 10, height: 10 });
      w.drawAfter(rect);

      expect(rect.attr("class")).toBe("widget-legend");
    });
  });

  describe("render (inherited from Draw)", () => {
    it("throws the abstract 'draw method must be implemented' error - CoreWidget never assigns this.draw", () => {
      const w = new CoreWidget();
      expect(() => w.render()).toThrow(/'draw' method must be implemented/);
    });
  });

  describe("static setup", () => {
    it("returns the render/index defaults", () => {
      expect(CoreWidget.setup()).toEqual({ render: false, index: 0 });
    });
  });
});
