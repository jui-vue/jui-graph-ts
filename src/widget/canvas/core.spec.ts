import { describe, it, expect } from "vitest";
import { CanvasCoreWidget } from "./core";
import type { WidgetConfig } from "../core";
import { SVG } from "../../util/svg";

// ---------------------------------------------------------------------------------------------
// `CanvasCoreWidget` ("chart.widget.canvas.core") is a two-line pass-through over `CoreWidget`:
// zero-param constructor (inherited), one overridden method (`drawAfter`, empty body). Same test
// double conventions `widget/core.spec.ts` established.
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

describe("CanvasCoreWidget", () => {
  it("constructs with zero arguments (matches the original's parameterless constructor)", () => {
    const w = new CanvasCoreWidget();
    expect(w).toBeInstanceOf(CanvasCoreWidget);
  });

  describe("drawAfter", () => {
    it("is a completely empty override - does NOT stamp the widget-<type> CSS class CoreWidget's own drawAfter would", () => {
      const svg = makeSvgContainer();
      const w = new CanvasCoreWidget();
      w.widget = makeWidget({ type: "legend" });

      const rect = svg.rect({ x: 0, y: 0, width: 10, height: 10 });
      w.drawAfter(rect);

      // CoreWidget.drawAfter would set class="widget-legend" here (see widget/core.spec.ts) -
      // CanvasCoreWidget's override shadows that entirely, so no class attribute is ever set.
      expect(rect.attr("class")).toBeFalsy();
    });

    it("does not throw even when this.widget is unset (the body never reads any field)", () => {
      const svg = makeSvgContainer();
      const w = new CanvasCoreWidget();
      const rect = svg.rect({ x: 0, y: 0, width: 10, height: 10 });

      expect(() => w.drawAfter(rect)).not.toThrow();
    });
  });

  describe("inherited CoreWidget surface", () => {
    it("still has getIndexArray/isRender/getScaleToValue/getValueToScale/on available unchanged", () => {
      const w = new CanvasCoreWidget();
      expect(w.getIndexArray(undefined)).toEqual([0]);
      expect(w.getIndexArray(3)).toEqual([3]);

      w.widget = makeWidget({ render: true });
      expect(w.isRender()).toBe(true);

      expect(w.getScaleToValue(5, 0, 10, 0, 100)).toBe(50);
      expect(w.getValueToScale(50, 0, 100, 0, 10)).toBe(5);
    });

    it("render() still throws the abstract 'draw method must be implemented' error - CanvasCoreWidget never assigns this.draw either", () => {
      const w = new CanvasCoreWidget();
      expect(() => w.render()).toThrow(/'draw' method must be implemented/);
    });
  });

  it("has no own static setup() override - inherits CoreWidget.setup()'s {render:false, index:0}", () => {
    expect(CanvasCoreWidget.setup()).toEqual({ render: false, index: 0 });
  });
});
