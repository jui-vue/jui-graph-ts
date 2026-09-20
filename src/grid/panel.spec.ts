import { describe, it, expect, vi, beforeEach } from "vitest";
import { PanelGrid } from "./panel";
import { registerGridDraw2D, __resetGridDrawMixinsForTesting } from "./core";
import type { GridChart } from "./core";
import { applyDraw2DGridMixin } from "./draw2d";
import type { Axis, AxisChart, AreaBox } from "../base/axis";
import { SVG } from "../util/svg";

// Same test-double convention as `core.spec.ts` (no shared test-helper module exists in this
// port - each spec file keeps its own minimal fixtures).
function makeChart(overrides: Partial<GridChart> = {}): GridChart {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const svg = new SVG(container, { width: 400, height: 300 });

  const themeValues: Record<string, string | number> = {
    gridBorderColor: "#ccc",
    gridBorderWidth: 1,
    gridBorderDashArray: "none",
    gridBorderOpacity: 1,
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
  const area: AreaBox = overrides.area ?? { x: 10, y: 20, x2: 110, y2: 220, width: 100, height: 200 };

  return {
    area: ((key?: string) => (key ? (area as any)[key] : area)) as Axis["area"],
    depth: 0,
    degree: { x: 0, y: 0, z: 0 },
    isFull3D: () => false,
    data: overrides.data ?? [],
    get: (type: string) => (type === "x" || type === "y" ? { hide: false, orient: type === "x" ? "bottom" : "left" } : undefined),
  } as unknown as Axis;
}

function makeGrid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { orient: "custom", type: "panel", ...overrides };
}

beforeEach(() => {
  document.body.innerHTML = "";
  __resetGridDrawMixinsForTesting();
});

describe("PanelGrid", () => {
  describe("drawBefore/scale", () => {
    it("scale(i) always returns the full axis-area rect, regardless of i", () => {
      const g = new PanelGrid();
      g.axis = makeAxisStub({ area: { x: 10, y: 20, x2: 110, y2: 220, width: 100, height: 200 } });

      g.drawBefore!();

      expect(g.scale(0)).toEqual({ x: 10, y: 20, width: 100, height: 200 });
      // PRESERVED QUIRK: index is ignored entirely - index 5, 99, whatever, same result.
      expect(g.scale(5)).toEqual({ x: 10, y: 20, width: 100, height: 200 });
      expect(g.scale(99)).toEqual({ x: 10, y: 20, width: 100, height: 200 });
    });
  });

  describe("custom", () => {
    it("PRESERVED QUIRK: always renders at x=0,y=0 (area offset subtracted right back out), transparent fill/stroke", () => {
      const chart = makeChart();
      const g = new PanelGrid();
      g.chart = chart;
      g.axis = makeAxisStub({ area: { x: 10, y: 20, x2: 110, y2: 220, width: 100, height: 200 } });
      g.grid = makeGrid();
      g.drawBefore!();

      const root = chart.svg.group();
      g.custom(root);

      const children = (root as any).children as unknown[];
      expect(children.length).toBe(1);
      const rect = children[0] as any;
      // `.attr(key)`'s already-documented Phase A quirk (`util/svg/element.ts`): a falsy CACHED
      // value (here `0`) falls through to `getAttribute()`, which always returns a string.
      expect(rect.attr("x")).toBe("0");
      expect(rect.attr("y")).toBe("0");
      expect(rect.attr("width")).toBe(100);
      expect(rect.attr("height")).toBe(200);
      expect(rect.attr("fill")).toBe("transparent");
      expect(rect.attr("stroke")).toBe("transparent");
    });
  });

  describe("draw", () => {
    it("forces grid.hide = true and delegates to drawGrid() (dropping the inert original 'panel' argument)", () => {
      const chart = makeChart();
      const g = new PanelGrid();
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
    it("renders without throwing, applies the Draw2DGrid mixin, and hides the root (grid.hide forced true)", () => {
      registerGridDraw2D(applyDraw2DGridMixin);

      const chart = makeChart();
      const g = new PanelGrid();
      g.chart = chart;
      g.axis = makeAxisStub({ area: { x: 10, y: 20, x2: 110, y2: 220, width: 100, height: 200 } });
      g.grid = makeGrid();
      g.svg = chart.svg;

      const result = g.render();

      // The mixin genuinely got applied - createGridX/createGridY/drawImage (CoreGrid's own
      // definite-assignment fields, unset before any mixin runs) are now real functions.
      expect(typeof g.createGridX).toBe("function");
      expect(typeof g.createGridY).toBe("function");
      expect(typeof g.drawImage).toBe("function");
      expect(typeof g.drawValueText).toBe("function");

      // The panel rect itself was still drawn (custom() doesn't use any Draw2DGrid method, but
      // the mixin application happens unconditionally before func.call(this, root) runs - see
      // `grid/core.ts`'s drawGrid()).
      const rootChildren = (result.root as any).children as unknown[];
      expect(rootChildren.length).toBe(1);

      // draw() forces grid.hide = true, so drawGrid() sets display:none on the root.
      expect(result.root.attr("display")).toBe("none");
    });
  });
});
