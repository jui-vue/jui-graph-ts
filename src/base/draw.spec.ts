import { describe, expect, it, vi } from "vitest";
import { Draw } from "./draw";

describe("Draw", () => {
  describe("render", () => {
    it("throws if `draw` was never assigned by a subclass", () => {
      const d = new Draw();
      expect(() => d.render()).toThrow("JUI_CRITICAL_ERR: 'draw' method must be implemented");
    });

    it("calls drawBefore, draw, drawAfter in order and returns draw()'s result", () => {
      const calls: string[] = [];
      const d = new Draw();
      d.drawBefore = () => calls.push("before");
      d.draw = () => {
        calls.push("draw");
        return { ok: true };
      };
      d.drawAfter = (obj) => {
        calls.push("after:" + JSON.stringify(obj));
      };

      const result = d.render();

      expect(calls).toEqual(["before", "draw", 'after:{"ok":true}']);
      expect(result).toEqual({ ok: true });
    });

    it("calls drawAnimate when the host (brush/widget/grid/map) has animate !== false", () => {
      const d = new Draw();
      d.draw = () => "obj";
      d.brush = { animate: true };
      const animate = vi.fn();
      d.drawAnimate = animate;

      d.render();

      expect(animate).toHaveBeenCalledWith("obj");
    });

    it("skips drawAnimate when the host's animate === false", () => {
      const d = new Draw();
      d.draw = () => "obj";
      d.widget = { animate: false };
      const animate = vi.fn();
      d.drawAnimate = animate;

      d.render();

      expect(animate).not.toHaveBeenCalled();
    });

    it("prefers grid, then brush, then widget, then map when picking the animate-guard host", () => {
      const d = new Draw();
      d.draw = () => "obj";
      d.grid = { animate: false };
      d.brush = { animate: true };
      const animate = vi.fn();
      d.drawAnimate = animate;

      d.render();

      // grid found first (animate:false) even though brush would have allowed it
      expect(animate).not.toHaveBeenCalled();
    });
  });

  describe("format", () => {
    it("dispatches to the host's own format callback, bound to chart, when present", () => {
      const d = new Draw();
      const chart = { format: vi.fn() };
      d.chart = chart as any;
      const hostFormat = vi.fn(function (this: any) {
        return this === chart;
      });
      d.brush = { format: hostFormat };

      const result = d.format("a", "b");

      expect(hostFormat).toHaveBeenCalledWith("a", "b");
      expect(result).toBe(true);
      expect(chart.format).not.toHaveBeenCalled();
    });

    it("falls back to chart.format when the host has no format of its own", () => {
      const d = new Draw();
      const chartFormat = vi.fn(() => "chart-formatted");
      d.chart = { format: chartFormat } as any;
      d.widget = {};

      const result = d.format(1, 2);

      expect(chartFormat).toHaveBeenCalledWith(1, 2);
      expect(result).toBe("chart-formatted");
    });
  });

  describe("balloonPoints", () => {
    it("builds the 'top' balloon outline", () => {
      const d = new Draw();
      expect(d.balloonPoints("top", 100, 40, 10)).toBe(
        "0,0 100,0 100,40 55,40 50,50 45,40 0,40 0,0"
      );
    });

    it("builds the 'bottom' balloon outline", () => {
      const d = new Draw();
      expect(d.balloonPoints("bottom", 100, 40, 10)).toBe(
        "0,10 45,10 50,0 55,10 100,10 100,50 0,50 0,10"
      );
    });

    it("builds the 'left' balloon outline", () => {
      const d = new Draw();
      expect(d.balloonPoints("left", 100, 40, 10)).toBe(
        "0,0 100,0 100,15 110,20 100,25 100,40 0,40 0,0"
      );
    });

    it("builds the 'right' balloon outline", () => {
      const d = new Draw();
      expect(d.balloonPoints("right", 100, 40, 10)).toBe(
        "0,0 100,0 100,40 0,40 0,25 -10,20 0,15 0,0"
      );
    });

    it("falls back to a plain rectangle for any other/unrecognized type", () => {
      const d = new Draw();
      expect(d.balloonPoints("nonsense", 50, 20, 5)).toBe("0,0 50,0 50,20 0,20 0,0");
    });
  });

  describe("on", () => {
    it("registers via chart.on(type, wrapper, 'render') and forwards non-axis events directly", () => {
      const d = new Draw();
      let registered: ((...a: any[]) => void) | undefined;
      const chartOn = vi.fn((_type: string, cb: any, resetType: string) => {
        registered = cb;
        expect(resetType).toBe("render");
        return "handle";
      });
      d.chart = { on: chartOn, axis: vi.fn() } as any;

      const userCallback = vi.fn();
      const result = d.on("brush.click", userCallback);

      expect(result).toBe("handle");
      expect(chartOn).toHaveBeenCalledWith("brush.click", expect.any(Function), "render");

      registered!({ pageX: 1 });
      expect(userCallback).toHaveBeenCalledWith({ pageX: 1 });
    });

    it("for 'axis.*' events with an integer axis.index, only forwards when arguments[1] matches self.axis.index", () => {
      const d = new Draw();
      let registered: ((...a: any[]) => void) | undefined;
      const chartAxis = vi.fn(() => ({ some: "axis-object" }));
      d.chart = {
        on: (_type: string, cb: any) => {
          registered = cb;
        },
        axis: chartAxis,
      } as any;
      d.axis = { index: 2 } as any;

      const userCallback = vi.fn();
      d.on("axis.change", userCallback);

      // arguments[1] !== self.axis.index (2) -> not forwarded
      registered!({ e: 1 }, 0);
      expect(userCallback).not.toHaveBeenCalled();

      // arguments[1] === self.axis.index (2) -> forwarded with only [e]
      const event = { e: 2 };
      registered!(event, 2);
      expect(userCallback).toHaveBeenCalledWith(event);
      expect(chartAxis).toHaveBeenCalledWith(2);
    });

    it("for 'axis.*' events when self.axis.index is not an integer, treats it like a non-axis event", () => {
      const d = new Draw();
      let registered: ((...a: any[]) => void) | undefined;
      d.chart = {
        on: (_type: string, cb: any) => {
          registered = cb;
        },
        axis: vi.fn(),
      } as any;
      d.axis = {} as any; // index undefined -> not an integer

      const userCallback = vi.fn();
      d.on("axis.change", userCallback);

      registered!({ e: 1 }, 99);
      expect(userCallback).toHaveBeenCalledWith({ e: 1 }, 99);
    });
  });

  describe("calculate3d - cross-checked against jui-chart-vue's dot3d.js/usePolygon3d.ts Phase E writeup", () => {
    function makeAxis(overrides: Partial<{ w: number; h: number; d: number }> = {}) {
      const w = overrides.w ?? 300;
      const h = overrides.h ?? 200;
      const d = overrides.d ?? 500;
      return {
        area: (key: string) => {
          if (key === "width") return w;
          if (key === "height") return h;
          if (key === "x") return 10;
          if (key === "y") return 20;
          throw new Error("unexpected key " + key);
        },
        depth: d,
        degree: {},
        perspective: 0.9,
      };
    }

    it("rotates with depth=Math.max(width,height,axis.depth), NOT axis.depth directly, while the rotation center's z is axis.depth/2 (a different value)", () => {
      const d = new Draw();
      const axis = makeAxis({ w: 300, h: 200, d: 500 }); // depth is the max here
      d.axis = axis as any;

      const rotate = vi.fn();
      d.calculate3d({ perspective: undefined, rotate } as any);

      // depth param = max(300,200,500) = 500; center z = 500/2 = 250 (equal here since depth is
      // already the max - see the next test for a case where they genuinely diverge)
      expect(rotate).toHaveBeenCalledWith(500, axis.degree, 10 + 150, 20 + 100, 250);
    });

    it("diverges when the plot area is larger than axis.depth: depth param uses the max, center z stays axis.depth/2", () => {
      const d = new Draw();
      const axis = makeAxis({ w: 1000, h: 200, d: 40 }); // width dominates
      d.axis = axis as any;

      const rotate = vi.fn();
      d.calculate3d({ rotate } as any);

      // depth param = max(1000,200,40) = 1000 (NOT axis.depth=40); center z = 40/2 = 20
      expect(rotate).toHaveBeenCalledWith(1000, axis.degree, 10 + 500, 20 + 100, 20);
    });

    it("defaults non-integer degree.x/y/z to 0, and sets `.perspective` on every rotated object", () => {
      const d = new Draw();
      const axis = makeAxis();
      (axis.degree as any) = { x: "nope", y: undefined, z: 1.5 };
      d.axis = axis as any;

      const a: { rotate: (...args: any[]) => void; perspective?: any } = { rotate: vi.fn() };
      const b: { rotate: (...args: any[]) => void; perspective?: any } = { rotate: vi.fn() };
      d.calculate3d(a as any, b as any);

      expect(axis.degree).toEqual({ x: 0, y: 0, z: 0 });
      expect(a.perspective).toBe(0.9);
      expect(b.perspective).toBe(0.9);
      expect(a.rotate).toHaveBeenCalled();
      expect(b.rotate).toHaveBeenCalled();
    });
  });

  it("static setup() returns the {type:null, animate:false} defaults", () => {
    expect(Draw.setup()).toEqual({ type: null, animate: false });
  });
});
