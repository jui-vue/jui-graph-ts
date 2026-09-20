import { describe, it, expect, vi } from "vitest";
import { LogGrid } from "./log";
import { RangeGrid } from "./range";
import type { LogGridOptions } from "./log";
import type { GridChart } from "./core";
import type { Axis, AxisChart, AreaBox } from "../base/axis";
import { SVG } from "../util/svg";
import { log } from "../util/scale/log";

// Same test-double convention `range.spec.ts`/`date.spec.ts` already established.

function makeChart(overrides: Partial<GridChart> = {}): { chart: GridChart; svg: SVG } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const svg = new SVG(container, { width: 400, height: 300 });

  const area: AreaBox = { x: 0, y: 0, x2: 400, y2: 300, width: 400, height: 300 };

  const chart: GridChart = {
    area: ((key?: string) => (key ? (area as any)[key] : area)) as AxisChart["area"],
    svg,
    index: 0,
    appendDefs: vi.fn(),
    theme: vi.fn(() => "themed") as unknown as GridChart["theme"],
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

  return { chart, svg };
}

interface AxisStubOptions {
  area?: AreaBox;
  data?: unknown[];
}

function makeAxisStub(opts: AxisStubOptions = {}): Axis {
  const area: AreaBox = opts.area ?? { x: 0, y: 0, x2: 100, y2: 50, width: 100, height: 50 };
  const stub = {
    area: ((key?: string) => (key ? (area as any)[key] : area)) as Axis["area"],
    depth: 0,
    degree: { x: 0, y: 0, z: 0 },
    isFull3D: () => false,
    data: opts.data ?? [],
    get: (type: string) => (type === "x" || type === "y" ? { hide: false, orient: type === "x" ? "bottom" : "left" } : undefined),
  };
  return stub as unknown as Axis;
}

function makeGrid(overrides: Partial<LogGridOptions> = {}): LogGridOptions {
  return {
    orient: "bottom",
    type: "log",
    base: 10,
    step: 4,
    nice: false,
    hideText: false,
    ...overrides,
  };
}

function makeLogGrid(gridOverrides: Partial<LogGridOptions> = {}, axisOpts: AxisStubOptions = {}): { g: LogGrid; chart: GridChart } {
  const { chart } = makeChart();
  const g = new LogGrid();
  g.chart = chart;
  g.axis = makeAxisStub(axisOpts);
  g.grid = makeGrid(gridOverrides);
  return { g, chart };
}

describe("LogGrid", () => {
  it("extends RangeGrid directly (confirmed extend: chart.grid.range)", () => {
    const { g } = makeLogGrid();
    expect(g).toBeInstanceOf(RangeGrid);
  });

  describe("static setup() - byte-faithful to the original literal (does NOT merge RangeGrid.setup()'s own fields - see header comment)", () => {
    it("returns exactly base/step/nice/hideText", () => {
      expect(LogGrid.setup()).toEqual({
        base: 10,
        step: 4,
        nice: false,
        hideText: false,
      });
    });
  });

  describe("drawBefore - preserved quirk 1: forces grid.unit=false before initDomain() ever reads it", () => {
    it("initDomain() sees grid.unit === false at call time, regardless of what was configured", () => {
      const { g } = makeLogGrid({ domain: [1, 10], unit: 999 as unknown as undefined });

      let capturedUnitAtCallTime: unknown = "not-called";
      const original = g.initDomain.bind(g);
      g.initDomain = () => {
        capturedUnitAtCallTime = (g.grid as Record<string, unknown>).unit;
        return original();
      };

      g.drawBefore();

      expect(capturedUnitAtCallTime).toBe(false);
      // ...and the mutation is permanent on the shared config object.
      expect((g.grid as Record<string, unknown>).unit).toBe(false);
    });

    it("a configured numeric grid.unit is silently discarded - the auto-computed-from-step branch is always taken instead", () => {
      const { g: gWithUnit } = makeLogGrid({ domain: [1, 100], step: 4, unit: 5 as unknown as undefined });
      const { g: gWithoutUnit } = makeLogGrid({ domain: [1, 100], step: 4 });

      gWithUnit.drawBefore();
      gWithoutUnit.drawBefore();

      // Both produce the IDENTICAL domain/ticks, proving the configured `unit: 5` never took
      // effect (RangeGrid.initDomain()'s `typeof grid.unit === 'number'` branch never fires).
      expect(gWithUnit.ticks).toEqual(gWithoutUnit.ticks);
    });
  });

  describe("drawBefore - preserved quirk 2: never calls .clamp(...) - grid.clamp has zero effect either way", () => {
    it("clamp: true and clamp: false produce byte-identical scale output (the config is never consulted)", () => {
      const { g: gClampTrue } = makeLogGrid({ domain: [1, 100], clamp: true } as any);
      const { g: gClampFalse } = makeLogGrid({ domain: [1, 100], clamp: false } as any);

      gClampTrue.drawBefore();
      gClampFalse.drawBefore();

      expect(gClampTrue.scale(50)).toBe(gClampFalse.scale(50));
      expect(gClampTrue.scale(1000)).toBe(gClampFalse.scale(1000)); // out-of-domain too
    });
  });

  describe("drawBefore - preserved quirk 3: this.step reads grid.step directly, NOT the inherited initDomain()'s computed domain.step", () => {
    it("this.step === this.grid.step after drawBefore()", () => {
      const { g } = makeLogGrid({ domain: [1, 100], step: 7 });
      g.drawBefore();
      expect(g.step).toBe(7);
      expect(g.grid.step).toBe(7);
    });
  });

  describe("drawBefore - hand-traced, cross-checked against an independently-built reference log() scale (same already-tested Phase A primitive drawBefore() itself calls)", () => {
    it("domain [1, 10], base 10, bottom orient: ticks/values match a directly-constructed log(10).domain([1,10]).range([0,100])", () => {
      const { g } = makeLogGrid({ domain: [1, 10], step: 4, base: 10, orient: "bottom" });

      g.drawBefore();

      // LogGrid.drawBefore() builds its scale over `this.initDomain()`'s RESOLVED domain (the
      // inherited RangeGrid algorithm's own [min,max] snapping), NOT the raw `grid.domain: [1,10]`
      // literal directly - re-derive that same resolved domain (a pure, idempotent computation)
      // for the reference scale, rather than assuming the literal passes through unchanged.
      const resolvedDomain = g.initDomain();
      const reference = log(10).domain(resolvedDomain);
      reference.range([0, 100]);
      const referenceTicks = reference.ticks(4, false);

      expect(g.ticks).toEqual(referenceTicks);
      expect(g.values).toEqual(referenceTicks.map((t) => reference(t)));
      expect(g.start).toBe(0);
      expect(g.size).toBe(100);
      expect(g.end).toBe(100);
      expect(g.bar).toBe(6);

      // Boundary sanity, against the same reference scale (NOT hardcoded 0/100 - `log().domain()`
      // 's own `checkMax()`/`getNextMax()` step can silently widen the resolved domain's upper
      // bound further, e.g. 12 -> 100, so the raw domain's own numeric max isn't necessarily where
      // the scale's pixel range actually ends).
      const rawMin = Math.min.apply(Math, resolvedDomain);
      const rawMax = Math.max.apply(Math, resolvedDomain);
      expect(g.scale(rawMin)).toBeCloseTo(reference(rawMin));
      expect(g.scale(rawMax)).toBeCloseTo(reference(rawMax));
    });

    it("left/right orient: range is [obj.end, obj.start] AND ticks are reversed afterward, same as RangeGrid.drawBefore() (this file's own copy of that logic, not inherited - confirmed by reading the original directly)", () => {
      const { g } = makeLogGrid({ domain: [1, 10], step: 4, base: 10, orient: "left" }, { area: { x: 0, y: 0, x2: 100, y2: 50, width: 100, height: 50 } });

      g.drawBefore();

      const resolvedDomain = g.initDomain();
      const rawMin = Math.min.apply(Math, resolvedDomain);
      const rawMax = Math.max.apply(Math, resolvedDomain);
      const reference = log(10).domain(resolvedDomain);
      reference.range([50, 0]);

      // left/right uses axis.area('y')/('height') -> obj.start=0, obj.end=50, range=[50,0].
      expect(g.scale(rawMin)).toBeCloseTo(reference(rawMin));
      expect(g.scale(rawMax)).toBeCloseTo(reference(rawMax));

      // Ticks ascend (min..max) internally, but `drawBefore()` reverses the FINAL ticks array for
      // left/right orient (`this.ticks.reverse()`), same as `RangeGrid.drawBefore()` does.
      expect(g.ticks[0]).toBeGreaterThan(g.ticks[g.ticks.length - 1]);
    });
  });

  describe("draw", () => {
    it("calls drawGrid() with zero arguments (\"log\" was always dead code in the original)", () => {
      const { g } = makeLogGrid();
      const spy = vi.spyOn(g, "drawGrid").mockReturnValue({ root: {} as any, scale: null });

      g.draw();
      expect(spy).toHaveBeenCalledWith();
    });
  });

  describe("inherited orient methods (top/bottom/left/right/center) - unchanged from RangeGrid, work against a LogScale via its own .min()/.max()", () => {
    it("top(): drawPattern/drawTop/drawBaseLine wiring still works with a LogScale assigned to this.scale", () => {
      const { g } = makeLogGrid({ domain: [1, 10], step: 4 });
      g.drawBefore();

      g.drawPattern = vi.fn();
      g.drawBaseLine = vi.fn();
      g.drawTop = vi.fn() as any;

      const container = g.chart.svg.group();
      g.top(container);

      expect(g.drawPattern).toHaveBeenCalledWith("top", g.ticks, g.values);
      expect(g.drawBaseLine).toHaveBeenCalledWith("top", container);
      expect(g.drawTop).toHaveBeenCalledTimes(1);
    });
  });
});
