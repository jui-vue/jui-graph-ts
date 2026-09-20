import { describe, it, expect, vi, beforeEach } from "vitest";
import { OverlapGrid } from "./overlap";
import { registerGridDraw2D, __resetGridDrawMixinsForTesting } from "./core";
import type { GridChart } from "./core";
import { applyDraw2DGridMixin } from "./draw2d";
import type { Axis, AxisChart, AreaBox } from "../base/axis";
import { SVG } from "../util/svg";

function makeChart(overrides: Partial<GridChart> = {}): GridChart {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const svg = new SVG(container, { width: 400, height: 300 });

  const themeValues: Record<string, string | number> = {
    gridBorderColor: "#ccc",
    gridBorderWidth: 1,
    gridTickBorderSize: 5,
    gridTickBorderWidth: 1,
  };

  const themeSpy = vi.fn((...args: unknown[]) => {
    if (args.length === 3) {
      const [isActive, activeKey, inactiveKey] = args as [boolean, string, string];
      return isActive ? `active:${activeKey}` : `inactive:${inactiveKey}`;
    }
    return themeValues[args[0] as string];
  });

  const area: AreaBox = { x: 0, y: 0, x2: 400, y2: 300, width: 400, height: 300 };

  return {
    area: ((key?: string) => (key ? (area as any)[key] : area)) as AxisChart["area"],
    svg,
    index: 0,
    appendDefs: vi.fn(),
    theme: themeSpy as unknown as GridChart["theme"],
    isRender: () => false,
    render: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    gridTypes: {},
    axis: vi.fn(() => undefined),
    color: vi.fn((c: unknown) => `color(${JSON.stringify(c)})`),
    format: (v: unknown) => v,
    ...overrides,
  };
}

function makeAxisStub(overrides: Partial<{ area: AreaBox; data: unknown[] }> = {}): Axis {
  const area: AreaBox = overrides.area ?? { x: 0, y: 0, x2: 200, y2: 100, width: 200, height: 100 };

  return {
    area: ((key?: string) => (key ? (area as any)[key] : area)) as Axis["area"],
    depth: 0,
    degree: { x: 0, y: 0, z: 0 },
    isFull3D: () => false,
    data: overrides.data ?? [{}, {}, {}],
    get: (type: string) => (type === "x" || type === "y" ? { hide: false, orient: type === "x" ? "bottom" : "left" } : undefined),
  } as unknown as Axis;
}

function makeGrid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { orient: "custom", type: "overlap", ...overrides };
}

beforeEach(() => {
  document.body.innerHTML = "";
  __resetGridDrawMixinsForTesting();
});

describe("OverlapGrid", () => {
  describe("static setup()", () => {
    it("returns { count: null }", () => {
      expect(OverlapGrid.setup()).toEqual({ count: null });
    });
  });

  describe("drawBefore/scale", () => {
    it("uses grid.count when set, hand-traced values", () => {
      const g = new OverlapGrid();
      g.axis = makeAxisStub({ area: { x: 0, y: 0, x2: 200, y2: 100, width: 200, height: 100 } });
      g.grid = makeGrid({ count: 2 });

      g.drawBefore!();

      // size=2, widthUnit=(200/2)/2=50, heightUnit=(100/2)/2=25
      // scale(0): x=0*50=0 -> area.x+0=0; y=0; width=|100-0|*2=200; height=|50-0|*2=100
      expect(g.scale(0)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
      // scale(1): x=50 -> area.x+50=50; y=25; width=|100-50|*2=100; height=|50-25|*2=50
      expect(g.scale(1)).toEqual({ x: 50, y: 25, width: 100, height: 50 });
    });

    it("falls back to axis.data.length when grid.count is null, and to 1 when data is empty", () => {
      const g1 = new OverlapGrid();
      g1.axis = makeAxisStub({ data: [{}, {}] });
      g1.grid = makeGrid({ count: null });
      g1.drawBefore!();
      // size = 2 (axis.data.length)
      expect(g1.scale(0).width).toBeCloseTo(200);

      const g2 = new OverlapGrid();
      g2.axis = makeAxisStub({ data: [] });
      g2.grid = makeGrid({ count: null });
      g2.drawBefore!();
      // size = 1 (both grid.count and axis.data.length falsy)
      expect(g2.scale(0)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    });
  });

  describe("custom", () => {
    it(
      "GENUINE BUG: computes real per-row rects (chart.svg.rect IS called axis.data.length times) " +
        "but never appends any of them anywhere - custom() takes no parameter to receive the root group",
      () => {
        const chart = makeChart();
        const g = new OverlapGrid();
        g.chart = chart;
        g.axis = makeAxisStub({ data: [{}, {}, {}] });
        g.grid = makeGrid({ count: null });
        g.drawBefore!();

        const rectSpy = vi.spyOn(chart.svg, "rect");
        const root = chart.svg.group();

        // Faithful to the original: drawGrid() always calls `func.call(this, root)` - but
        // OverlapGrid.custom() declares ZERO parameters, so `root` is simply discarded here too.
        (g.custom as (...args: unknown[]) => void).call(g, root);

        expect(rectSpy).toHaveBeenCalledTimes(3);
        // ...and yet the group passed in (playing the role of drawGrid()'s `root`) stays empty.
        expect((root as any).children.length).toBe(0);
      },
    );
  });

  describe("draw", () => {
    it("forces grid.hide = true and delegates to drawGrid() (dropping the inert original 'overlap' argument)", () => {
      const chart = makeChart();
      const g = new OverlapGrid();
      g.chart = chart;
      g.axis = makeAxisStub();
      g.grid = makeGrid({ hide: false });

      const drawGridSpy = vi.spyOn(g, "drawGrid").mockReturnValue({ root: {} as any, scale: undefined });
      g.draw!();

      expect(g.grid.hide).toBe(true);
      expect(drawGridSpy).toHaveBeenCalledWith();
    });
  });

  describe("end-to-end render() with the real draw2d.ts mixin (registerGridDraw2D wiring confirmation)", () => {
    it("renders without throwing, applies the Draw2DGrid mixin, produces an empty (bug-preserved) root, hidden", () => {
      registerGridDraw2D(applyDraw2DGridMixin);

      const chart = makeChart();
      const g = new OverlapGrid();
      g.chart = chart;
      g.axis = makeAxisStub({ data: [{}, {}] });
      g.grid = makeGrid({ count: null });
      g.svg = chart.svg;

      const result = g.render();

      expect(typeof g.createGridX).toBe("function");
      expect(typeof g.createGridY).toBe("function");
      expect(typeof g.drawImage).toBe("function");

      // The mixin's presence doesn't change OverlapGrid's own bug: root stays empty regardless.
      expect((result.root as any).children.length).toBe(0);
      expect(result.root.attr("display")).toBe("none");
    });
  });
});
