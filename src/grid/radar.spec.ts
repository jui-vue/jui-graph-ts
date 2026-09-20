import { describe, it, expect, vi } from "vitest";
import { RadarGrid } from "./radar";
import type { RadarGridConfig } from "./radar";
import type { Axis, AxisChart, AreaBox } from "../base/axis";
import { SVG } from "../util/svg";
import { rotate } from "../util/math";

// ---------------------------------------------------------------------------------------------
// Test doubles - same convention `core.spec.ts`/`date.spec.ts` already established, extended with
// the `padding`/`text` members `RadarGridChart` needs beyond the shared `GridChart` type.
// ---------------------------------------------------------------------------------------------

function makeChart(overrides: Record<string, unknown> = {}): { chart: any; svg: SVG } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const svg = new SVG(container, { width: 400, height: 300 });

  const area: AreaBox = { x: 0, y: 0, x2: 400, y2: 300, width: 400, height: 300 };
  const paddingValues: Record<string, number> = { left: 5, top: 7, right: 5, bottom: 7 };

  const chart = {
    area: ((key?: string) => (key ? (area as any)[key] : area)) as AxisChart["area"],
    svg,
    index: 0,
    appendDefs: vi.fn(),
    theme: vi.fn((key: unknown) => `theme(${String(key)})`),
    isRender: () => false,
    render: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    gridTypes: {},
    axis: vi.fn(() => undefined),
    color: vi.fn((c: unknown) => `color(${JSON.stringify(c)})`),
    format: (v: unknown) => v,
    padding: vi.fn((key?: string) => (key ? paddingValues[key] : paddingValues)),
    text: vi.fn((attr: Record<string, unknown>, text?: string) => svg.text(attr, text)),
    ...overrides,
  };

  return { chart, svg };
}

function makeAxisStub(overrides: Partial<{ area: AreaBox }> = {}): Axis {
  const area: AreaBox = overrides.area ?? { x: 0, y: 0, x2: 200, y2: 100, width: 200, height: 100 };

  const stub = {
    area: ((key?: string) => (key ? (area as any)[key] : area)) as Axis["area"],
    depth: 0,
    degree: { x: 0, y: 0, z: 0 },
    isFull3D: () => false,
    data: [],
  };

  return stub as unknown as Axis;
}

function makeGrid(overrides: Partial<RadarGridConfig> = {}): RadarGridConfig {
  return {
    orient: "custom",
    type: "radar",
    domain: null,
    reverse: false,
    max: 100,
    step: 10,
    line: true,
    hideText: false,
    extra: false,
    shape: "radial",
    hide: false,
    ...overrides,
  };
}

function makeRadarGrid(gridOverrides: Partial<RadarGridConfig> = {}): { g: RadarGrid; chart: any } {
  const { chart } = makeChart();
  const g = new RadarGrid();
  g.chart = chart;
  g.axis = makeAxisStub();
  g.grid = makeGrid(gridOverrides);
  return { g, chart };
}

describe("RadarGrid", () => {
  describe("static setup", () => {
    it("matches the original's 8-field literal", () => {
      expect(RadarGrid.setup()).toEqual({
        domain: null,
        reverse: false,
        max: 100,
        step: 10,
        line: true,
        hideText: false,
        extra: false,
        shape: "radial",
      });
    });
  });

  describe("initDomain", () => {
    it("string domain, reverse: false: forward field-value walk", () => {
      const { g } = makeRadarGrid({ domain: "label" });
      g.axis = makeAxisStub();
      (g.axis as any).data = [{ label: "A" }, { label: "B" }, { label: "C" }];

      expect(g.initDomain()).toEqual(["A", "B", "C"]);
    });

    it("preserved bug: string domain, reverse: true has NO NET EFFECT (backward walk + final reverse cancel out - Node-verified)", () => {
      const { g } = makeRadarGrid({ domain: "label", reverse: true });
      (g.axis as any).data = [{ label: "A" }, { label: "B" }, { label: "C" }];

      // Identical to the reverse:false result above - the bug.
      expect(g.initDomain()).toEqual(["A", "B", "C"]);
    });

    it("function domain: reverse: true DOES visibly reverse (contrast with the string-branch quirk above)", () => {
      const domainFn = vi.fn((_chart: unknown, _grid: unknown) => ["X", "Y", "Z"]);
      const { g } = makeRadarGrid({ domain: domainFn as any, reverse: true });

      expect(g.initDomain()).toEqual(["Z", "Y", "X"]);
      expect(domainFn).toHaveBeenCalledWith(g.chart, g.grid);
    });

    it("function domain: reverse: false leaves the function's own order untouched", () => {
      const domainFn = vi.fn((_chart: unknown, _grid: unknown) => ["X", "Y", "Z"]);
      const { g } = makeRadarGrid({ domain: domainFn as any, reverse: false });

      expect(g.initDomain()).toEqual(["X", "Y", "Z"]);
    });

    it("array domain (explicit), reverse: true: simple single reverse (no cancellation, unlike the string branch)", () => {
      const { g } = makeRadarGrid({ domain: ["A", "B", "C"], reverse: true });
      expect(g.initDomain()).toEqual(["C", "B", "A"]);
    });
  });

  describe("drawBefore", () => {
    it("sets this.domain from initDomain()", () => {
      const { g } = makeRadarGrid({ domain: ["A", "B"] });
      g.drawBefore();
      expect(g.domain).toEqual(["A", "B"]);
    });
  });

  describe("createScale (private, exercised via bracket access)", () => {
    it("hand-traced, index 0 (no rotation - exact arithmetic, no float noise): result = {x: dx+cx, y: dy+cy-pos}", () => {
      const { g, chart } = makeRadarGrid({ max: 100 });
      (g as any).domain = ["A", "B", "C", "D"];

      const obj = { x1: 10, y1: 20, x2: 10, y2: -30 };
      const scaleFn = (g as any).createScale(obj);

      // height = |20| - |-30| = -10; rate = 50/100 = 0.5; pos = -5; y = -pos = 5
      // result = {x: dx(5)+cx(10)+0, y: dy(7)+cy(20)+5} = {x: 15, y: 32}
      expect(scaleFn(0, 50)).toEqual({ x: 15, y: 32 });
      expect(chart.padding).toHaveBeenCalledWith("left");
      expect(chart.padding).toHaveBeenCalledWith("top");
    });

    it("hand-traced, index 1 (with rotation) - cross-checked against the real, already-verified util/math.ts rotate()", () => {
      const { g } = makeRadarGrid({ max: 100 });
      (g as any).domain = ["A", "B", "C", "D"]; // length 4 -> unit = 2*PI/4

      const obj = { x1: 10, y1: 20, x2: 10, y2: -30 };
      const scaleFn = (g as any).createScale(obj);

      const rate = 50 / 100;
      const height = Math.abs(obj.y1) - Math.abs(obj.y2);
      const pos = height * rate;
      const unit = (2 * Math.PI) / 4;
      const o = rotate(0, -pos, unit * 1);
      const expected = { x: 5 + obj.x1 + o.x, y: 7 + obj.y1 + o.y };

      expect(scaleFn(1, 50)).toEqual(expected);
    });
  });

  describe("draw", () => {
    it("grid.line: false - draws only domain spoke lines + labels, no split shapes, returns createScale(position[0])", () => {
      const { g, chart } = makeRadarGrid({ line: false, hideText: false });
      (g as any).domain = ["A", "B", "C"];

      const lineSpy = vi.spyOn(chart.svg, "line");
      const textSpy = vi.spyOn(chart, "text");
      const circleSpy = vi.spyOn(g as any, "drawCircle");
      const radialSpy = vi.spyOn(g as any, "drawRadial");

      const result = g.draw();

      expect(lineSpy).toHaveBeenCalledTimes(3); // one spoke line per domain entry
      expect(textSpy).toHaveBeenCalledTimes(3); // one label per domain entry
      expect(circleSpy).not.toHaveBeenCalled();
      expect(radialSpy).not.toHaveBeenCalled();
      expect(result.root).toBeDefined();
      expect(typeof result.scale).toBe("function");

      // The returned scale is `createScale(position[0])` - cross-check by calling it directly
      // and confirming it matches calling `createScale` with the SAME captured position[0].
      const position0 = (g as any).position[0];
      const direct = (g as any).createScale(position0)(0, 50);
      expect(result.scale(0, 50)).toEqual(direct);
    });

    it("grid.line: true, shape: radial (default) - invokes drawRadial per split-line step", () => {
      const { g, chart } = makeRadarGrid({ line: true, shape: "radial", step: 2, max: 100, hideText: true });
      (g as any).domain = ["A", "B", "C"];

      const radialSpy = vi.spyOn(g as any, "drawRadial").mockImplementation(() => {});
      const circleSpy = vi.spyOn(g as any, "drawCircle");

      g.draw();

      expect(radialSpy).toHaveBeenCalledTimes(2); // step: 2
      expect(circleSpy).not.toHaveBeenCalled();
      void chart;
    });

    it("grid.line: true, shape: circle - invokes drawCircle per split-line step", () => {
      const { g } = makeRadarGrid({ line: true, shape: "circle", step: 3, max: 100, hideText: true });
      (g as any).domain = ["A", "B", "C"];

      const circleSpy = vi.spyOn(g as any, "drawCircle").mockImplementation(() => {});
      const radialSpy = vi.spyOn(g as any, "drawRadial");

      g.draw();

      expect(circleSpy).toHaveBeenCalledTimes(3); // step: 3
      expect(radialSpy).not.toHaveBeenCalled();
    });

    it("grid.extra: true skips the first split-line step without drawing it", () => {
      const { g } = makeRadarGrid({ line: true, shape: "circle", step: 3, extra: true, max: 100, hideText: true });
      (g as any).domain = ["A", "B", "C"];

      const circleSpy = vi.spyOn(g as any, "drawCircle").mockImplementation(() => {});

      g.draw();

      expect(circleSpy).toHaveBeenCalledTimes(2); // step 3, first one skipped via `continue`
    });

    it("grid.hide: true sets display:none on the root", () => {
      const { g } = makeRadarGrid({ line: true, hide: true, hideText: true });
      (g as any).domain = ["A", "B"];

      const result = g.draw();
      expect(result.root.attr("display")).toBe("none");
    });

    it("grid.hideText: true suppresses both domain-spoke labels and split-line value labels", () => {
      const { g, chart } = makeRadarGrid({ line: true, hideText: true, step: 2 });
      (g as any).domain = ["A", "B", "C"];

      const textSpy = vi.spyOn(chart, "text");
      g.draw();

      expect(textSpy).not.toHaveBeenCalled();
    });
  });
});
