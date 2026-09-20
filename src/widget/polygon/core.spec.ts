import { describe, it, expect } from "vitest";
import { PolygonCoreWidget } from "./core";
import type { WidgetConfig } from "../core";
import { SVG } from "../../util/svg";

// ---------------------------------------------------------------------------------------------
// `PolygonCoreWidget` ("chart.widget.polygon.core") is byte-identical in shape to
// `CanvasCoreWidget` (confirmed via `diff` against the real source - see this file's header
// comment): zero-param constructor (inherited), one overridden method (`drawAfter`, empty body).
// Same test double conventions `widget/core.spec.ts`/`widget/canvas/core.spec.ts` established.
// This is also the file jui-chart-vue's `rotate3d.js`/`useRotate3d.ts` Phase E writeup already
// described as "a two-line pass-through - empty drawAfter() override, nothing else" - these tests
// confirm that description precisely.
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

describe("PolygonCoreWidget", () => {
  it("constructs with zero arguments (matches the original's parameterless constructor)", () => {
    const w = new PolygonCoreWidget();
    expect(w).toBeInstanceOf(PolygonCoreWidget);
  });

  describe("drawAfter", () => {
    it("is a completely empty override - does NOT stamp the widget-<type> CSS class CoreWidget's own drawAfter would", () => {
      const svg = makeSvgContainer();
      const w = new PolygonCoreWidget();
      w.widget = makeWidget({ type: "rotate3d" });

      const rect = svg.rect({ x: 0, y: 0, width: 10, height: 10 });
      w.drawAfter(rect);

      expect(rect.attr("class")).toBeFalsy();
    });

    it("does not throw even when this.widget is unset", () => {
      const svg = makeSvgContainer();
      const w = new PolygonCoreWidget();
      const rect = svg.rect({ x: 0, y: 0, width: 10, height: 10 });

      expect(() => w.drawAfter(rect)).not.toThrow();
    });
  });

  describe("inherited CoreWidget surface", () => {
    it("still has getIndexArray/isRender/getScaleToValue/getValueToScale/on available unchanged", () => {
      const w = new PolygonCoreWidget();
      expect(w.getIndexArray([2, 4])).toEqual([2, 4]);

      w.widget = makeWidget({ render: false });
      expect(w.isRender()).toBe(false);

      expect(w.getScaleToValue(0, 0, 10, 0, 100)).toBe(100);
      expect(w.getValueToScale(1, 0, 3, 0, 10)).toBe(6.7);
    });

    it("render() still throws the abstract 'draw method must be implemented' error - PolygonCoreWidget never assigns this.draw either", () => {
      const w = new PolygonCoreWidget();
      expect(() => w.render()).toThrow(/'draw' method must be implemented/);
    });
  });

  it("has no own static setup() override - inherits CoreWidget.setup()'s {render:false, index:0}", () => {
    expect(PolygonCoreWidget.setup()).toEqual({ render: false, index: 0 });
  });
});
