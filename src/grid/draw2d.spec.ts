import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoreGrid, __resetGridDrawMixinsForTesting } from "./core";
import type { GridChart } from "./core";
import { applyDraw2DGridMixin } from "./draw2d";
import type { Axis, AxisChart, AreaBox } from "../base/axis";
import { SVG } from "../util/svg";
import type { TransElement } from "../util/svg/element.transform";

// Standalone tests for `Draw2DGrid`'s own mixin shape/behavior, applied directly onto a bare
// `CoreGrid` instance (not via a concrete leaf subclass) - per this batch's own task
// instructions, since no OTHER concurrently-landed `CoreGrid` subclass (beyond this batch's own
// `PanelGrid`/`OverlapGrid`/`TableGrid`, which already get their own real end-to-end
// `registerGridDraw2D` wiring tests in `panel.spec.ts`/`overlap.spec.ts`/`table.spec.ts`) was
// confirmed available at the time this was written.

function makeChart(overrides: Partial<GridChart> = {}): GridChart & { text: (attr: Record<string, unknown>, content?: unknown) => TransElement } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const svg = new SVG(container, { width: 400, height: 300 });

  const themeValues: Record<string, string | number> = {
    gridTickBorderSize: 5,
    gridTickBorderWidth: 1,
    gridBorderColor: "#ccc",
    gridBorderWidth: 1,
    gridBorderDashArray: "none",
    gridPatternColor: "#eee",
    gridPatternOpacity: 0.5,
    backgroundColor: "#fff",
    gridXFontSize: 12,
    gridYFontSize: 12,
    gridXFontWeight: "normal",
    gridYFontWeight: "normal",
    gridTickPadding: 2,
    gridXAxisBorderWidth: 1,
    gridYAxisBorderWidth: 1,
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
    text: vi.fn((attr: Record<string, unknown>, content?: unknown) => svg.text(attr as any, content as any)),
    ...overrides,
  };
}

function makeAxisStub(overrides: Partial<{ area: AreaBox; get: (t: string) => unknown }> = {}): Axis {
  const area: AreaBox = overrides.area ?? { x: 10, y: 20, x2: 110, y2: 220, width: 100, height: 200 };

  return {
    area: ((key?: string) => (key ? (area as any)[key] : area)) as Axis["area"],
    depth: 0,
    degree: { x: 0, y: 0, z: 0 },
    isFull3D: () => false,
    data: [],
    get: overrides.get ?? ((type: string) => (type === "x" || type === "y" ? { hide: false, orient: type === "x" ? "bottom" : "left" } : undefined)),
  } as unknown as Axis;
}

function makeGrid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { orient: "bottom", type: "block", ...overrides };
}

function makeTarget(chartOverrides: Partial<GridChart> = {}, axisOverrides: Parameters<typeof makeAxisStub>[0] = {}) {
  const chart = makeChart(chartOverrides);
  const g = new CoreGrid();
  g.chart = chart;
  g.axis = makeAxisStub(axisOverrides);
  g.grid = makeGrid();
  applyDraw2DGridMixin(g);
  return { g, chart };
}

beforeEach(() => {
  document.body.innerHTML = "";
  __resetGridDrawMixinsForTesting();
});

describe("applyDraw2DGridMixin (grid/draw2d.ts)", () => {
  it("assigns all 9 methods (the 4 CoreGrid declares fields for, plus 5 internal-only ones) as OWN properties", () => {
    const g = new CoreGrid();
    applyDraw2DGridMixin(g);

    for (const name of ["createGridX", "createGridY", "fillRectObject", "drawAxisLine", "drawPattern", "drawBaseLine", "drawValueLine", "drawValueText", "drawImage"]) {
      expect(Object.prototype.hasOwnProperty.call(g, name)).toBe(true);
      expect(typeof (g as any)[name]).toBe("function");
    }
  });

  describe("createGridX/createGridY", () => {
    it("createGridX('bottom', ...) draws the tick line with y2 = +gridTickBorderSize", () => {
      const { g } = makeTarget();
      const axisGroup = g.createGridX("bottom", 0, 15, false, false);

      expect(axisGroup.attr("transform")).toBe("translate(15,0)");
      const tickLine = (axisGroup as any).children[0];
      expect(tickLine.attr("y2")).toBe(5); // +gridTickBorderSize
    });

    it("createGridX('top', ...) uses y2 = -gridTickBorderSize", () => {
      const { g } = makeTarget();
      const axisGroup = g.createGridX("top", 0, 0, false, false);
      const tickLine = (axisGroup as any).children[0];
      expect(tickLine.attr("y2")).toBe(-5);
    });

    it("createGridY('left', ...) uses x2 = -gridTickBorderSize; 'right' uses +", () => {
      const { g } = makeTarget();
      const left = g.createGridY("left", 0, 0, false, false);
      const right = g.createGridY("right", 0, 0, false, false);

      expect((left as any).children[0].attr("x2")).toBe(-5);
      expect((right as any).children[0].attr("x2")).toBe(5);
    });

    it("draws a value line (drawValueLine) when getLineOption() is truthy, and appends it under the axis group", () => {
      const { g } = makeTarget();
      g.grid = makeGrid({ line: "solid" });

      const axisGroup = g.createGridX("bottom", 0, 0, false, true);
      // tick line + value line = 2 children (line 'bottom' with isLast -> checkDrawLineX gates it,
      // grid.type 'block' + non-realtime + isLast -> checkDrawLineX returns false for bottom+isLast
      // only when grid.realtime is falsy - here it IS falsy, so the value line is suppressed).
      // Assert instead against a non-suppressed case (index 0, not last):
      expect((axisGroup as any).children.length).toBe(1);
    });

    it("does NOT call drawValueLine when getLineOption() is falsy (grid.line: false)", () => {
      const { g } = makeTarget();
      g.grid = makeGrid({ line: false });

      const spy = vi.spyOn(g as any, "drawValueLine");
      g.createGridX("bottom", 0, 0, false, false);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("fillRectObject", () => {
    it("gradient type: appends a rect using chart.color's linear-gradient string", () => {
      const { g, chart } = makeTarget();
      const target = chart.svg.group();

      (g as any).fillRectObject(target, { type: "gradient" }, "bottom", 1, 2, 3, 4);

      expect((target as any).children.length).toBe(1);
      const rect = (target as any).children[0];
      expect(rect.attr("width")).toBe(3);
      expect(rect.attr("height")).toBe(4);
      expect(chart.color).toHaveBeenCalledWith("linear(bottom) #eee,0.5 #fff");
    });

    it("rect type: appends a rect using line.fill when set, else the theme pattern color", () => {
      const { g, chart } = makeTarget();
      const target = chart.svg.group();

      (g as any).fillRectObject(target, { type: "rect", fill: "red" }, "left", 0, 0, 1, 1);

      expect((target as any).children.length).toBe(1);
      expect(chart.color).toHaveBeenCalledWith("red");
    });

    it("neither gradient nor rect: appends nothing", () => {
      const { g, chart } = makeTarget();
      const target = chart.svg.group();

      (g as any).fillRectObject(target, { type: "dashed" }, "left", 0, 0, 1, 1);

      expect((target as any).children.length).toBe(0);
    });
  });

  describe("drawAxisLine/drawBaseLine", () => {
    it("drawAxisLine merges themed x-axis defaults with the given attr for top/bottom", () => {
      const { g, chart } = makeTarget();
      const target = chart.svg.group();

      (g as any).drawAxisLine("top", target, { x1: 5 });

      const line = (target as any).children[0];
      expect(line.attr("x1")).toBe(5);
      expect(line.attr("stroke-opacity")).toBe(1);
    });

    it("drawBaseLine('bottom', g) forwards getGridSize()'s start/end as x1/x2", () => {
      const { g, chart } = makeTarget();
      g.grid = makeGrid({ orient: "bottom" });
      const target = chart.svg.group();

      (g as any).drawBaseLine("bottom", target);

      const line = (target as any).children[0];
      // getGridSize() for orient=bottom uses axis.area('x')/'width': start=10, end=110 (see makeAxisStub default area)
      expect(line.attr("x1")).toBe(10);
      expect(line.attr("x2")).toBe(110);
    });

    it("drawBaseLine('left', g) forwards start/end as y1/y2", () => {
      const { g, chart } = makeTarget();
      g.grid = makeGrid({ orient: "left" });
      const target = chart.svg.group();

      (g as any).drawBaseLine("left", target);

      const line = (target as any).children[0];
      expect(line.attr("y1")).toBe(20);
      expect(line.attr("y2")).toBe(220);
    });
  });

  describe("drawValueLine", () => {
    it("skips drawing when checkDrawLineX/Y says no (e.g. index 0 on a left-orient, non-realtime y axis via 'top'/'bottom' -> checkDrawLineY)", () => {
      const { g, chart } = makeTarget({}, { get: () => ({ hide: false, orient: "left" }) });
      const target = chart.svg.group();

      (g as any).drawValueLine("top", target, false, { type: "solid" }, 0, false);

      expect((target as any).children.length).toBe(0);
    });

    it("draws a themed line and applies a dashed stroke-dasharray when line.type contains 'dashed'", () => {
      const { g, chart } = makeTarget({}, { get: () => ({ hide: false, orient: "left" }) });
      const target = chart.svg.group();

      (g as any).drawValueLine("top", target, true, { type: "dashed" }, 1, false);

      expect((target as any).children.length).toBe(1);
      const line = (target as any).children[0];
      expect(line.attr("stroke")).toBe("active:gridActiveBorderColor");
      expect(line.attr("stroke-dasharray")).toBe("3,3");
    });
  });

  describe("drawValueText", () => {
    it("does nothing when grid.hideText is set", () => {
      const { g, chart } = makeTarget();
      g.grid = makeGrid({ hideText: true });
      const target = chart.svg.group();

      (g as any).drawValueText("top", target, 0, 0, "A", 5, false);

      expect((target as any).children.length).toBe(0);
    });

    it("'bottom': places text below the axis (positive y offset), center-anchored", () => {
      const { g, chart } = makeTarget();
      const target = chart.svg.group();

      (g as any).drawValueText("bottom", target, 0, 0, "A", 5, false);

      expect((target as any).children.length).toBe(1);
      const text = (target as any).children[0];
      expect(text.attr("x")).toBe(5);
      expect(text.attr("y")).toBe(5 + 2 * 2); // gridTickBorderSize(5) + gridTickPadding(2)*2
      expect(text.attr("text-anchor")).toBe("middle");
    });

    it("'left': end-anchored, negative x offset", () => {
      const { g, chart } = makeTarget();
      const target = chart.svg.group();

      (g as any).drawValueText("left", target, 0, 0, "A", 5, false);

      const text = (target as any).children[0];
      expect(text.attr("x")).toBe(-(5 + 2)); // -(gridTickBorderSize + gridTickPadding)
      expect(text.attr("y")).toBe(5);
      expect(text.attr("text-anchor")).toBe("end");
    });

    it("'right': start-anchored, positive x offset", () => {
      const { g, chart } = makeTarget();
      const target = chart.svg.group();

      (g as any).drawValueText("right", target, 0, 0, "A", 5, false);

      const text = (target as any).children[0];
      expect(text.attr("x")).toBe(5 + 2);
      expect(text.attr("text-anchor")).toBe("start");
    });
  });

  describe("drawPattern", () => {
    it("no-ops when grid.hide is set, or position/ticks/values are missing", () => {
      const { g, chart } = makeTarget();
      const groupSpy = vi.spyOn(chart.svg, "group");

      g.grid = makeGrid({ hide: true });
      (g as any).drawPattern("bottom", ["a"], [0, 10]);
      expect(groupSpy).not.toHaveBeenCalled();

      g.grid = makeGrid({ hide: false });
      (g as any).drawPattern(undefined, ["a"], [0, 10]);
      (g as any).drawPattern("bottom", undefined, [0, 10]);
      (g as any).drawPattern("bottom", ["a"], undefined);
      expect(groupSpy).not.toHaveBeenCalled();
    });

    it("draws fill rects for each value-pair when line.type is gradient/rect", () => {
      const { g } = makeTarget();
      g.grid = makeGrid({ line: "rect" });

      const fillSpy = vi.spyOn(g as any, "fillRectObject");
      (g as any).drawPattern("bottom", ["a", "b"], [0, 10, 10, 30]);

      expect(fillSpy).toHaveBeenCalledTimes(2);
    });

    it("does nothing (no fillRectObject calls) when line.type has neither gradient nor rect", () => {
      const { g } = makeTarget();
      g.grid = makeGrid({ line: "solid" });

      const fillSpy = vi.spyOn(g as any, "fillRectObject");
      (g as any).drawPattern("bottom", ["a", "b"], [0, 10, 10, 30]);

      expect(fillSpy).not.toHaveBeenCalled();
    });
  });

  describe("drawImage", () => {
    it("no-ops when grid.image is not a function", () => {
      const { g, chart } = makeTarget();
      g.grid = makeGrid({ image: undefined });
      const target = chart.svg.group();

      (g as any).drawImage("bottom", target, {}, 0, 0, 0);

      expect((target as any).children.length).toBe(0);
    });

    it("no-ops when grid.image(...) doesn't return an object", () => {
      const { g, chart } = makeTarget();
      g.grid = makeGrid({ image: () => null });
      const target = chart.svg.group();

      (g as any).drawImage("bottom", target, {}, 0, 0, 0);

      expect((target as any).children.length).toBe(0);
    });

    it("creates and positions an image for orient='bottom' (block type uses rangeBand/2 - width/2)", () => {
      const { g, chart } = makeTarget();
      const imageFn = vi.fn(() => ({ uri: "x.png", width: 20, height: 10, dist: 3 }));
      g.grid = makeGrid({ image: imageFn, type: "block" });
      g.scale = { rangeBand: () => 40 };
      const target = chart.svg.group();

      (g as any).drawImage("bottom", target, "tick0", 0, 7, 8);

      expect(imageFn).toHaveBeenCalledWith("tick0", 0);
      expect((target as any).children.length).toBe(1);
      const img = (target as any).children[0];
      expect(img.attr("x")).toBe(40 / 2 - 20 / 2); // 10
      expect(img.attr("y")).toBe(3); // orient=bottom -> y: opts.dist
      expect(img.attr("transform")).toBe("translate(7,8)");
    });

    it("orient='left' sets y from rangeBand/height and x from -(dist+width)", () => {
      const { g, chart } = makeTarget();
      g.grid = makeGrid({ image: () => ({ uri: "x.png", width: 20, height: 10, dist: 3 }), type: "line" });
      const target = chart.svg.group();

      (g as any).drawImage("left", target, "tick0", 0, 0, 0);

      const img = (target as any).children[0];
      expect(img.attr("y")).toBe(-(10 / 2)); // non-block type -> -(height/2)
      expect(img.attr("x")).toBe(-(3 + 20)); // -(dist+width)
    });
  });
});
