import { describe, it, expect, vi, beforeEach } from "vitest";
import { TableGrid } from "./table";
import { registerGridDraw2D, __resetGridDrawMixinsForTesting } from "./core";
import type { GridChart } from "./core";
import { applyDraw2DGridMixin } from "./draw2d";
import type { Axis, AxisChart, AreaBox, GridConstructor } from "../base/axis";
import { SVG } from "../util/svg";

function makeChart(overrides: Partial<GridChart> = {}): GridChart {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const svg = new SVG(container, { width: 400, height: 300 });

  const themeValues: Record<string, string | number> = {
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

function makeAxisStub(overrides: Partial<{ area: AreaBox }> = {}): Axis {
  const area: AreaBox = overrides.area ?? { x: 0, y: 0, x2: 210, y2: 110, width: 210, height: 110 };

  return {
    area: ((key?: string) => (key ? (area as any)[key] : area)) as Axis["area"],
    depth: 0,
    degree: { x: 0, y: 0, z: 0 },
    isFull3D: () => false,
    data: [],
    get: (type: string) => (type === "x" || type === "y" ? { hide: false, orient: type === "x" ? "bottom" : "left" } : undefined),
  } as unknown as Axis;
}

function makeGrid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { orient: "custom", type: "table", rows: 2, columns: 3, padding: 10, ...overrides };
}

beforeEach(() => {
  document.body.innerHTML = "";
  __resetGridDrawMixinsForTesting();
});

describe("TableGrid", () => {
  describe("3-parameter-constructor investigation", () => {
    it("has an implicit 0-arg constructor (matching every other CoreGrid subclass) - `new Grid(chart, axis, options)` still works, extra args are simply ignored", () => {
      const chart = makeChart();
      const axis = makeAxisStub();
      // Mirrors the original engine's own real call site (`base/axis.js`'s `drawGridType()`:
      // `new Grid(chart, axis, axis[k])`) - proving a 3-arg construction call still succeeds even
      // though TableGrid's real constructor (inherited from CoreGrid) takes none.
      const g = new (TableGrid as unknown as new (a: unknown, b: unknown, c: unknown) => TableGrid)(chart, axis, makeGrid());
      expect(g).toBeInstanceOf(TableGrid);
    });

    it("compiles as a GridConstructor (fewer-params-than-declared assignability, same as CoreGrid itself)", () => {
      const ctor: GridConstructor = TableGrid;
      expect(typeof ctor).toBe("function");
    });
  });

  describe("static setup()", () => {
    it("returns the original's exact default option shape", () => {
      expect(TableGrid.setup()).toEqual({ rows: 1, columns: 1, padding: 10 });
    });
  });

  describe("drawBefore/scale - hand-traced", () => {
    it("computes row/column layout correctly (unaffected by custom()'s dead-loop bug)", () => {
      const g = new TableGrid();
      g.axis = makeAxisStub({ area: { x: 0, y: 0, x2: 210, y2: 110, width: 210, height: 110 } });
      g.grid = makeGrid({ rows: 2, columns: 3, padding: 10 });

      g.drawBefore!();

      // columnUnit = (210 - (3-1)*10)/3 = (210-20)/3 = 190/3 ≈ 63.333
      // rowUnit = (110 - (2-1)*10)/2 = (110-10)/2 = 50
      const columnUnit = (210 - 2 * 10) / 3;
      const rowUnit = (110 - 1 * 10) / 2;

      // index 0 -> r=0,c=0: x=0*colUnit+0*10=0, y=0*rowUnit+0*10=0
      expect(g.scale(0)).toEqual({ x: 0, y: 0, width: columnUnit, height: rowUnit });

      // index 4 -> r=Math.floor(4/3)=1, c=4%3=1: x=1*colUnit + 1*10, y=1*rowUnit + 1*10
      const expectedX = 1 * columnUnit + 1 * 10;
      const expectedY = 1 * rowUnit + 1 * 10;
      expect(g.scale(4)).toEqual({ x: expectedX, y: expectedY, width: columnUnit, height: rowUnit });
    });
  });

  describe("custom - PRESERVED BUG: the entire loop body is dead code", () => {
    it("this.row/this.column are always undefined (drawBefore() shadows them with its own locals, never assigns the instance fields)", () => {
      const g = new TableGrid();
      g.axis = makeAxisStub();
      g.grid = makeGrid();

      g.drawBefore!();

      expect((g as any).row).toBeUndefined();
      expect((g as any).column).toBeUndefined();
    });

    it("custom() never calls chart.svg.rect - the for loops can never iterate (r < undefined is always false)", () => {
      const chart = makeChart();
      const g = new TableGrid();
      g.chart = chart;
      g.axis = makeAxisStub();
      g.grid = makeGrid();
      g.drawBefore!();

      const rectSpy = vi.spyOn(chart.svg, "rect");
      const root = chart.svg.group();

      expect(() => g.custom(root)).not.toThrow();
      expect(rectSpy).not.toHaveBeenCalled();
      expect((root as any).children.length).toBe(0);
    });
  });

  describe("draw", () => {
    it("forces grid.hide = true and delegates to drawGrid() (dropping the inert original 'table' argument)", () => {
      const chart = makeChart();
      const g = new TableGrid();
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
      const g = new TableGrid();
      g.chart = chart;
      g.axis = makeAxisStub();
      g.grid = makeGrid();
      g.svg = chart.svg;

      const result = g.render();

      expect(typeof g.createGridX).toBe("function");
      expect(typeof g.drawImage).toBe("function");
      expect((result.root as any).children.length).toBe(0);
      expect(result.root.attr("display")).toBe("none");
    });
  });
});
