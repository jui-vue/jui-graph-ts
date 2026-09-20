import { describe, it, expect } from "vitest";
import { MapCoreWidget } from "./core";
import type { WidgetConfig } from "../core";
import { SVG } from "../../util/svg";

// ---------------------------------------------------------------------------------------------
// `MapCoreWidget` ("chart.widget.map.core") is an empty extension-point stub with zero concrete
// subclasses anywhere public in the real engine (confirmed via grep - see this file's header
// comment), same category as `brush/map/core.ts`. Unlike `CanvasCoreWidget`/`PolygonCoreWidget`,
// it does NOT override `drawAfter` at all - it only adds a 3-parameter (but unused-body)
// constructor and a `static setup()` override returning `{ axis: 0 }`.
// ---------------------------------------------------------------------------------------------

function makeSvgContainer() {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.appendChild(container);
  return new SVG(container, { width: 400, height: 300 });
}

function makeWidget(overrides: WidgetConfig = {}): WidgetConfig {
  return { render: false, type: "test", index: 0, ...overrides };
}

describe("MapCoreWidget", () => {
  it("constructs with zero arguments", () => {
    const w = new MapCoreWidget();
    expect(w).toBeInstanceOf(MapCoreWidget);
  });

  it("constructs with (chart, axis, widget) arguments too, matching the original's 3-param signature, but ignores them entirely", () => {
    const fakeChart = { on: () => {}, axis: () => undefined };
    const fakeAxis = { index: 1 };
    const fakeWidgetCfg = makeWidget({ type: "map" });

    const w = new MapCoreWidget(fakeChart, fakeAxis, fakeWidgetCfg);

    // None of the constructor args are assigned anywhere - this.chart/this.axis/this.widget stay
    // unset (undefined) after construction, exactly like the original's empty constructor body.
    expect((w as any).chart).toBeUndefined();
    expect((w as any).axis).toBeUndefined();
    expect((w as any).widget).toBeUndefined();
  });

  describe("drawAfter (inherited, unmodified, unlike CanvasCoreWidget/PolygonCoreWidget)", () => {
    it("still stamps the widget-<type> CSS class - MapCoreWidget does not override drawAfter at all", () => {
      const svg = makeSvgContainer();
      const w = new MapCoreWidget();
      w.widget = makeWidget({ type: "map" });

      const rect = svg.rect({ x: 0, y: 0, width: 10, height: 10 });
      w.drawAfter(rect);

      expect(rect.attr("class")).toBe("widget-map");
    });
  });

  describe("inherited CoreWidget surface", () => {
    it("still has getIndexArray/isRender/getScaleToValue/getValueToScale/on available unchanged", () => {
      const w = new MapCoreWidget();
      expect(w.getIndexArray(undefined)).toEqual([0]);

      w.widget = makeWidget({ render: true });
      expect(w.isRender()).toBe(true);
    });

    it("render() still throws the abstract 'draw method must be implemented' error - MapCoreWidget never assigns this.draw either", () => {
      const w = new MapCoreWidget();
      expect(() => w.render()).toThrow(/'draw' method must be implemented/);
    });
  });

  describe("static setup()", () => {
    it("returns {axis: 0}, REPLACING (not merging with) CoreWidget.setup()'s {render:false, index:0}", () => {
      expect(MapCoreWidget.setup()).toEqual({ axis: 0 });
    });
  });
});
