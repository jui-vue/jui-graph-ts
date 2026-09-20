import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Plane } from "./plane";
import {
  registerAxis,
  registerBrush,
  registerWidget,
  type AxisConstructor,
  type AxisLike,
  type DrawConstructor,
  type DrawLike,
} from "./builder";

class FakeAxis implements AxisLike {
  data: any[];
  constructor(
    public chart: any,
    public rawOptions: any,
    public mergedOptions: any
  ) {
    this.data = (rawOptions && rawOptions.data) || [];
  }
  reload(): void {}
}
(FakeAxis as unknown as { setup(): any }).setup = () => ({});

class FakeDraw implements DrawLike {
  chart: any;
  axis: any;
  svg: any;
  canvas: any;
  constructor(
    public builderInstance: any,
    public axisRef: any,
    public options: any
  ) {}
  render(): any {
    return { rendered: true };
  }
  isRender(): boolean {
    return true;
  }
}
(FakeDraw as unknown as { setup(): any }).setup = () => ({});

// `Plane.render()` always builds its `Builder` chart with `canvas: true` (hardcoded in the
// original). jsdom's `HTMLCanvasElement.getContext('2d')` returns `null` without the optional
// `canvas` npm package (same documented limitation as this project's existing
// `canvas/hidpi.spec.ts`/`canvas/base.spec.ts`) - stub it with a minimal fake context so
// `Builder`'s canvas-setup/reset/double-buffer-draw calls have something to call methods on.
// `HidpiUtil.apply()` itself is a no-op against this stub regardless (jsdom's `pixelRatio`
// computes to exactly `1`, which trips `apply()`'s own early-return guard - see `hidpi.ts`).
function fakeCanvasContext(): CanvasRenderingContext2D {
  return {
    restore: vi.fn(),
    save: vi.fn(),
    clearRect: vi.fn(),
    translate: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  registerAxis(FakeAxis as unknown as AxisConstructor);
  registerBrush("canvas.dot3d", FakeDraw as unknown as DrawConstructor);
  registerWidget("polygon.rotate3d", FakeDraw as unknown as DrawConstructor);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(fakeCanvasContext() as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mountPlane(overrides: Record<string, any> = {}): Plane {
  const root = document.createElement("div");
  const plane = new Plane();
  plane.mount(root, overrides);
  return plane;
}

describe("Plane", () => {
  describe("init() - derives baseAxis/etcAxis from options", () => {
    it("2d dimension forces perspective=1 and all degrees to 0, and hides the z axis's text", () => {
      const plane = mountPlane({ dimension: "2d", dx: 10, dy: 5, dz: 7, perspective: 0.5 });
      const baseAxis = (plane as any).baseAxis;

      expect(baseAxis.perspective).toBe(1);
      expect(baseAxis.degree).toEqual({ x: 0, y: 0, z: 0 });
      expect(baseAxis.z.hideText).toBe(true);
    });

    it("3d dimension keeps the configured perspective/degree values", () => {
      const plane = mountPlane({ dimension: "3d", dx: 10, dy: 5, dz: 7, perspective: 0.5 });
      const baseAxis = (plane as any).baseAxis;

      expect(baseAxis.perspective).toBe(0.5);
      expect(baseAxis.degree).toEqual({ x: 10, y: 5, z: 7 });
      expect(baseAxis.z.hideText).toBeUndefined();
    });

    it("derives x/y orientation, domain, and a depth reduced by padding*2", () => {
      const plane = mountPlane({ x: [-50, 50], y: [-20, 20], depth: 400, padding: 30 });
      const baseAxis = (plane as any).baseAxis;

      expect(baseAxis.x).toMatchObject({ domain: [-50, 50], orient: "bottom", type: "range" });
      expect(baseAxis.y).toMatchObject({ domain: [-20, 20], orient: "left", type: "range" });
      expect(baseAxis.depth).toBe(400 - 30 * 2);
    });

    it("etcAxis hides x/y/z and sets extend:0, for every axis after the first", () => {
      const plane = mountPlane();
      const etcAxis = (plane as any).etcAxis;
      expect(etcAxis).toEqual({ extend: 0, x: { hide: true }, y: { hide: true }, z: { hide: true } });
    });
  });

  describe("push()", () => {
    it("silently no-ops for non-array data (PRESERVED: no error, no state change)", () => {
      const plane = mountPlane();
      plane.push("not-an-array" as any);
      expect((plane as any).axis).toEqual([]);
    });

    it("creates a fresh axis entry from baseAxis for the first push, then accumulates data rows on repeat pushes", () => {
      const plane = mountPlane();
      plane.push([1, 2, 3]);
      plane.push([4, 5, 6]);

      const axis = (plane as any).axis;
      expect(axis.length).toBe(1);
      expect(axis[0].data).toEqual([[1, 2, 3], [4, 5, 6]]);
      // first axis entry is seeded from baseAxis (has x/y/z/depth/degree/perspective)
      expect(axis[0].x).toMatchObject({ type: "range" });
      expect(axis[0].depth).toBeDefined();
    });
  });

  describe("commit()", () => {
    it("pushes a canvas.dot3d brush entry using the current axisIndex, then increments it", () => {
      const plane = mountPlane({ symbol: "dot", r: 3 });
      plane.push([1]);
      plane.commit();

      const brush = (plane as any).brush;
      expect(brush).toEqual([{ type: "canvas.dot3d", color: 0, axis: 0, symbol: "dot", size: 6 }]);
      expect((plane as any).axisIndex).toBe(1);
    });

    it("prefers explicit symbol/r arguments over the configured defaults", () => {
      const plane = mountPlane({ symbol: "dot", r: 3 });
      plane.commit("square", 5);

      const brush = (plane as any).brush;
      expect(brush[0]).toMatchObject({ symbol: "square", size: 10 });
    });
  });

  describe("append()", () => {
    it("creates a new axis entry (from etcAxis when axisIndex > 0) with the given data, and a matching brush entry", () => {
      const plane = mountPlane({ symbol: "dot", r: 2 });
      plane.push([0, 0]); // creates axis[0] from baseAxis
      plane.commit(); // brush entry for axis 0, axisIndex -> 1
      plane.append([{ x: 1 }], "triangle", 4);

      const axis = (plane as any).axis;
      const brush = (plane as any).brush;
      expect(axis[1].data).toEqual([{ x: 1 }]);
      expect(axis[1]).toMatchObject({ x: { hide: true } }); // seeded from etcAxis (axisIndex=1)
      expect(brush[1]).toEqual({ type: "canvas.dot3d", color: 1, axis: 1, symbol: "triangle", size: 8 });
    });
  });

  describe("render()", () => {
    it("builds a Builder chart from the accumulated axis/brush/widget, then resets internal state for the next cycle", () => {
      const plane = mountPlane({ dimension: "3d" });
      plane.push([1, 2]);
      plane.commit();

      expect(() => plane.render()).not.toThrow();

      expect((plane as any).axis).toEqual([]);
      expect((plane as any).brush).toEqual([]);
      expect((plane as any).widget).toEqual([]);
      expect((plane as any).axisIndex).toBe(0);
      expect((plane as any).chart).not.toBeNull();
    });

    it("falls back to a single baseAxis entry when nothing was ever pushed", () => {
      const plane = mountPlane();
      expect(() => plane.render()).not.toThrow();
      expect((plane as any).chart.axis().length).toBe(1);
    });

    it("adds a polygon.rotate3d widget only in 3d dimension", () => {
      const plane2d = mountPlane({ dimension: "2d" });
      plane2d.render();
      expect((plane2d as any).chart.get("widget").length).toBe(0);

      const plane3d = mountPlane({ dimension: "3d" });
      plane3d.render();
      expect((plane3d as any).chart.get("widget").length).toBe(1);
    });

    it("resolves each configured color through the built chart and applies it as the theme (array `colors` option)", () => {
      const plane = mountPlane({ colors: ["#111111", "#222222"] });
      expect(() => plane.render()).not.toThrow();
      expect((plane as any).chart.theme("colors")).toEqual(["#111111", "#222222"]);
    });

    it("clears the previous chart's root content and replaces it with a new chart on re-render", () => {
      const plane = mountPlane();
      plane.render();
      const firstChart = (plane as any).chart;
      plane.render();
      expect((plane as any).chart).not.toBe(firstChart);
    });
  });
});
