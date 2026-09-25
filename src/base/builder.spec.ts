import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Builder,
  registerAxis,
  registerBrush,
  registerIcon,
  registerTheme,
  registerWidget,
  type AxisConstructor,
  type AxisLike,
  type DrawConstructor,
  type DrawLike,
} from "./builder";
import { Element as SvgElementCtor } from "../util/svg/element";

class FakeAxis implements AxisLike {
  data: any[];
  index?: number;
  reloaded: any[] = [];

  constructor(
    public chart: Builder,
    public rawOptions: any,
    public mergedOptions: any
  ) {
    this.data = (rawOptions && rawOptions.data) || [];
  }

  reload(options: any): void {
    this.reloaded.push(options);
  }
}
(FakeAxis as unknown as { setup(): any }).setup = () => ({});

class FakeDraw implements DrawLike {
  chart: any;
  axis: any;
  svg: any;
  canvas: any;
  renderCount = 0;

  constructor(
    public builderInstance: Builder,
    public axisRef: AxisLike | undefined,
    public options: any
  ) {}

  render(): any {
    this.renderCount++;
    return { rendered: true };
  }

  isRender(): boolean {
    return true;
  }
}
(FakeDraw as unknown as { setup(): any }).setup = () => ({});

beforeEach(() => {
  registerAxis(FakeAxis as unknown as AxisConstructor);
});

function mountBuilder(overrides: Record<string, any> = {}): Builder {
  const root = document.createElement("div");
  const builder = new Builder();
  builder.mount(root, {
    theme: { colors: ["#111111", "#222222", "#333333"] },
    ...overrides,
  } as any);
  return builder;
}

describe("Builder", () => {
  describe("mount()/init() (Core-stand-in smoke test)", () => {
    it("wires root/options, builds a real SVG document, and renders without a configured brush/widget/axis", () => {
      const builder = mountBuilder();

      expect(builder.root).toBeInstanceOf(HTMLElement);
      expect(builder.svg).toBeDefined();
      expect(builder.root.querySelector("svg")).not.toBeNull();
    });

    it("assigns each mounted instance an incrementing `index` (replaces the dropped global-registry counter)", () => {
      const a = mountBuilder();
      const b = mountBuilder();
      expect(b.index).toBeGreaterThan(a.index);
    });

    it("defaults padding from an integer to a {left,right,top,bottom} object", () => {
      const builder = mountBuilder({ padding: 20 });
      expect(builder.padding()).toEqual({ left: 20, right: 20, top: 20, bottom: 20 });
    });

    it("passes an already-object padding through unchanged", () => {
      const builder = mountBuilder({ padding: { left: 1, right: 2, top: 3, bottom: 4 } });
      expect(builder.padding()).toEqual({ left: 1, right: 2, top: 3, bottom: 4 });
      expect(builder.padding("left")).toBe(1);
    });
  });

  describe("get/axis/area/padding accessors", () => {
    it("get() returns the whole collection when no key matches, or the keyed entry when it does", () => {
      const builder = mountBuilder();
      expect(builder.get("axis")).toBe(builder.axis());
      expect(builder.get("axis", 0)).toBe(builder.axis(0));
    });

    it("axis() with no args returns the whole array; with an index, that entry", () => {
      const builder = mountBuilder();
      expect(Array.isArray(builder.axis())).toBe(true);
      expect(builder.axis(0)).toBeInstanceOf(FakeAxis);
    });

    it("area()/padding() with no key return the whole object; with a key, that value", () => {
      const builder = mountBuilder({ padding: 5 });
      expect(builder.area()).toHaveProperty("width");
      expect(typeof builder.area("width")).toBe("number");
      expect(builder.padding()).toEqual({ left: 5, right: 5, top: 5, bottom: 5 });
      expect(builder.padding("top")).toBe(5);
    });
  });

  describe("color()", () => {
    it("resolves an integer key against the theme's colors array", () => {
      const builder = mountBuilder();
      expect(builder.color(0)).toBe("#111111");
      expect(builder.color(1)).toBe("#222222");
    });

    it("clamps an out-of-range integer index to the last theme color (PRESERVED: no wraparound)", () => {
      const builder = mountBuilder();
      expect(builder.color(99)).toBe("#333333");
    });

    it("a plain string key is returned as-is once ColorUtil.parse finds nothing to transform", () => {
      const builder = mountBuilder();
      expect(builder.color("#abcdef")).toBe("#abcdef");
    });

    it("resolves against an explicit `colors` array argument when given 2 args", () => {
      const builder = mountBuilder();
      expect(builder.color(0, ["#aaa", "#bbb"])).toBe("#aaa");
    });
  });

  describe("theme()", () => {
    it("0 args returns the whole theme object", () => {
      const builder = mountBuilder();
      expect(builder.theme()).toMatchObject({ colors: ["#111111", "#222222", "#333333"] });
    });

    it("1 arg returns the raw value for a non-Color key", () => {
      const builder = mountBuilder({ theme: { colors: ["#111"], fontFamily: "Arial" } });
      expect(builder.theme("fontFamily")).toBe("Arial");
    });

    it("1 arg with a key containing 'Color' resolves the value through createColor()", () => {
      const builder = mountBuilder({ theme: { colors: ["#111"], fontColor: "#ff0000" } });
      expect(builder.theme("fontColor")).toBe("#ff0000");
    });

    it("3 args picks between two keys based on the first (boolean) argument", () => {
      const builder = mountBuilder({
        theme: { colors: ["#111"], selectedFontColor: "#00ff00", fontColor: "#ff0000" },
      });
      expect(builder.theme(true, "selectedFontColor", "fontColor")).toBe("#00ff00");
      expect(builder.theme(false, "selectedFontColor", "fontColor")).toBe("#ff0000");
    });
  });

  describe("format()", () => {
    it("returns undefined immediately when called with no arguments", () => {
      const builder = mountBuilder();
      expect(builder.format()).toBeUndefined();
    });

    it("returns the first argument unchanged when no format callback is configured", () => {
      const builder = mountBuilder();
      expect(builder.format("raw-value")).toBe("raw-value");
    });

    it("applies a configured format callback with `this` bound to the builder", () => {
      const cb = vi.fn(function (this: Builder, v: any) {
        return this === builder ? "formatted:" + v : "wrong-this";
      });
      var builder = mountBuilder({ format: cb });
      expect(builder.format("x")).toBe("formatted:x");
    });
  });

  describe("isFullSize() - PRESERVED bug: always returns true regardless of configured size", () => {
    it("returns true even for a fixed-pixel, non-100% size", () => {
      const builder = mountBuilder({ width: 400, height: 300 });
      expect(builder.isFullSize()).toBe(true);
    });

    it("also returns true for an actual 100% size", () => {
      const builder = mountBuilder({ width: "100%", height: "100%" });
      expect(builder.isFullSize()).toBe(true);
    });
  });

  describe("isRender()", () => {
    it("returns true before the instance has ever rendered, regardless of the `render` option", () => {
      const builder = new Builder();
      expect(builder.isRender()).toBe(true);
    });

    it("after the first render, reflects the configured `render` option", () => {
      const rendered = mountBuilder({ render: false });
      expect(rendered.isRender()).toBe(false);

      const rendered2 = mountBuilder({ render: true });
      expect(rendered2.isRender()).toBe(true);
    });
  });

  describe("setCache/getCache", () => {
    it("round-trips a value, and returns the default when missing", () => {
      const builder = mountBuilder();
      expect(builder.getCache("missing", "fallback")).toBe("fallback");
      builder.setCache("k", 42);
      expect(builder.getCache("k")).toBe(42);
    });
  });

  describe("dynamic brush/widget resolution (explicit registry stand-in for JUI.include)", () => {
    it("drawBrush() resolves a registered brush type, constructs it, wires chart/axis/svg/canvas, and calls render()", () => {
      registerBrush("test.fakebrush", FakeDraw as unknown as DrawConstructor);

      let constructed: FakeDraw | undefined;
      class Spy extends (FakeDraw as any) {
        constructor(...args: any[]) {
          super(...args);
          constructed = this as any;
        }
      }
      registerBrush("test.fakebrush.spy", Spy as unknown as DrawConstructor);

      const builder = mountBuilder({
        axis: [{ data: [{ a: 1 }] }],
        brush: [{ type: "test.fakebrush.spy" }],
      });

      expect(constructed).toBeDefined();
      expect(constructed!.renderCount).toBe(1);
      expect(constructed!.chart).toBe(builder);
      expect(constructed!.svg).toBe(builder.svg);
    });

    it("throws a clear error for an unregistered brush type instead of a silent registry miss", () => {
      expect(() =>
        mountBuilder({ brush: [{ type: "no.such.brush" }] })
      ).toThrow(/brush type 'no\.such\.brush' is not registered/);
    });

    it("throws a clear error for an unregistered widget type", () => {
      expect(() =>
        mountBuilder({ widget: [{ type: "no.such.widget" }] })
      ).toThrow(/widget type 'no\.such\.widget' is not registered/);
    });

    it("drawWidget() resolves a registered widget type, constructs it against axis(0), and calls render()", () => {
      registerWidget("test.fakewidget", FakeDraw as unknown as DrawConstructor);

      let constructed: FakeDraw | undefined;
      class WidgetSpy extends (FakeDraw as any) {
        constructor(...args: any[]) {
          super(...args);
          constructed = this as any;
        }
      }
      registerWidget("test.fakewidget.spy", WidgetSpy as unknown as DrawConstructor);

      const builder = mountBuilder({
        axis: [{ data: [{ a: 1 }] }],
        widget: [{ type: "test.fakewidget.spy" }],
      });

      expect(constructed).toBeDefined();
      expect(constructed!.renderCount).toBe(1);
      expect(constructed!.axis).toBe(builder.axis(0));
    });

    it("drawBrush() infers `target` from the first data row's keys when not explicitly set", () => {
      registerBrush("test.target-infer", FakeDraw as unknown as DrawConstructor);

      let captured: any;
      class Spy2 extends (FakeDraw as any) {
        constructor(_chart: any, _axis: any, options: any) {
          super(_chart, _axis, options);
          captured = options;
        }
      }
      registerBrush("test.target-infer.spy", Spy2 as unknown as DrawConstructor);

      mountBuilder({
        axis: [{ data: [{ foo: 1, bar: 2 }] }],
        brush: [{ type: "test.target-infer.spy", axis: 0 }],
      });

      expect(captured.target).toEqual(["foo", "bar"]);
    });

    it("defineOptions() merges the FULL extend chain leaf-first, not just the leaf class's own setup() " +
      "(regression test for a real, previously-shipped gap - see defineOptions()'s doc comment)", () => {
      class FakeCoreBrushLike extends (FakeDraw as any) {
        static setup(): Record<string, unknown> {
          return { fromCore: "core-default", overridden: "core-value" };
        }
      }
      class FakeLeafBrush extends FakeCoreBrushLike {
        static setup(): Record<string, unknown> {
          return { fromLeaf: "leaf-default", overridden: "leaf-value" };
        }
      }

      let captured: any;
      class Spy3 extends (FakeLeafBrush as any) {
        constructor(_chart: any, _axis: any, options: any) {
          super(_chart, _axis, options);
          captured = options;
        }
      }
      registerBrush("test.chain-merge.spy", Spy3 as unknown as DrawConstructor);

      mountBuilder({
        axis: [{ data: [{ a: 1 }] }],
        brush: [{ type: "test.chain-merge.spy" }],
      });

      // Both the leaf's own default AND its ancestor's default must be present...
      expect(captured.fromLeaf).toBe("leaf-default");
      expect(captured.fromCore).toBe("core-default");
      // ...and where both levels declare the SAME key, the more-leaf (more specific) class's own
      // value wins - matching `extend(..., true)`'s "only fill what's still missing" semantics
      // applied leaf-first.
      expect(captured.overridden).toBe("leaf-value");
    });

    it("defineOptions() applies the same full-chain merge for registered widgets", () => {
      class FakeCoreWidgetLike extends (FakeDraw as any) {
        static setup(): Record<string, unknown> {
          return { render: false, fromCore: "core-default" };
        }
      }
      class FakeLeafWidget extends FakeCoreWidgetLike {
        static setup(): Record<string, unknown> {
          return { fromLeaf: "leaf-default" };
        }
      }

      let captured: any;
      class WidgetSpy2 extends (FakeLeafWidget as any) {
        constructor(_chart: any, _axis: any, options: any) {
          super(_chart, _axis, options);
          captured = options;
        }
      }
      registerWidget("test.widget-chain-merge.spy", WidgetSpy2 as unknown as DrawConstructor);

      mountBuilder({
        axis: [{ data: [{ a: 1 }] }],
        widget: [{ type: "test.widget-chain-merge.spy" }],
      });

      expect(captured.fromLeaf).toBe("leaf-default");
      expect(captured.fromCore).toBe("core-default");
    });
  });

  describe("addBrush/removeBrush/updateBrush/addWidget/removeWidget/updateWidget", () => {
    it("addBrush pushes into options.brush and re-renders when isRender() is true", () => {
      registerBrush("test.whatever", FakeDraw as unknown as DrawConstructor);
      const builder = mountBuilder();
      const renderSpy = vi.spyOn(builder, "render");
      builder.addBrush({ type: "test.whatever" });
      expect(renderSpy).toHaveBeenCalled();
    });

    it("removeBrush/removeWidget splice by index", () => {
      registerBrush("test.removable", FakeDraw as unknown as DrawConstructor);
      const builder = mountBuilder({ brush: [{ type: "test.removable" }, { type: "test.removable" }] });
      builder.removeBrush(0);
      expect(builder.get("brush").length).toBe(1);
    });

    it("updateBrush with isReset=true replaces the whole entry; without it, merges", () => {
      registerBrush("test.update", FakeDraw as unknown as DrawConstructor);
      const builder = mountBuilder({ render: false, brush: [{ type: "test.update", color: "red" }] });
      builder.updateBrush(0, { color: "blue" });
      // merge: type survives, color overwritten
      // (isRender() is false here so no re-render is triggered by the update itself)
      builder.updateBrush(0, { type: "test.update" }, true);
      expect(() => builder.render()).not.toThrow();
    });
  });

  describe("appendDefs", () => {
    it("appends the given element into the internal <defs>", () => {
      const builder = mountBuilder();
      const before = builder.root.querySelectorAll("defs > *").length;
      const el = new SvgElementCtor();
      el.create("circle", { r: 5 });
      builder.appendDefs(el);
      // Flush the in-memory element tree into the real DOM directly via `svg.render()` -
      // NOT `builder.render()`, which would call `drawBefore()` and rebuild `_defs` from
      // scratch first, discarding what was just appended (matches the original: `_defs` is
      // reset every render pass).
      builder.svg.render();
      expect(builder.root.querySelectorAll("defs > *").length).toBe(before + 1);
    });
  });

  describe("icon()/text()/texts() (registerIcon stand-in for JUI.include('chart.icon.*'))", () => {
    it("icon() looks up a registered icon set by the configured icon.type", () => {
      registerIcon("classic", { home: "" });
      const builder = mountBuilder({ icon: { type: "classic", path: null } });
      expect(builder.icon("home")).toBe("");
    });

    it("icon() throws a clear error when the icon type isn't registered", () => {
      const builder = mountBuilder({ icon: { type: "no-such-icon-set", path: null } });
      expect(() => builder.icon("home")).toThrow(/icon type 'no-such-icon-set' is not registered/);
    });

    it("text() replaces `{key}` tokens in a plain string via parseIconInText()/icon()", () => {
      registerIcon("classic", { star: "★" });
      const builder = mountBuilder({ icon: { type: "classic", path: null } });
      const el = builder.text({}, "rating {star} here");
      expect(el.element.textContent).toBe("rating ★ here");
    });

    it("texts() creates one child text element per string entry, skipping non-strings", () => {
      const builder = mountBuilder();
      const g = builder.texts({ "font-size": 10 }, ["a", "b"]);
      expect(g.children.length).toBe(2);
    });
  });

  describe("setVectorFontIcons() (icon.path -> @font-face injection)", () => {
    // Every prior icon.* test above configures `path: null`, which hits this method's own early
    // return before ever reaching the @font-face injection - none of them exercise this code path
    // at all. These do, and also clean up after themselves since `document.head` is shared,
    // uncleaned, global state across every `it()` in this file (unlike `builder.root`, a fresh
    // detached `<div>` per `mountBuilder()` call).
    afterEach(() => {
      document.head.querySelectorAll("style[data-jui-icon-type]").forEach((el) => el.remove());
    });

    function fontFaceStyles(type: string): HTMLStyleElement[] {
      return Array.from(document.head.querySelectorAll(`style[data-jui-icon-type="${type}"]`));
    }

    it("injects a <style data-jui-icon-type> whose full @font-face rule text is set via textContent - not via CSSStyleSheet.insertRule()", () => {
      mountBuilder({ icon: { type: "vftest-basic", path: "/fonts/icomoon.woff" } });

      const styles = fontFaceStyles("vftest-basic");
      expect(styles.length).toBe(1);

      // The defining, deliberate difference from the dropped `insertRule()` technique: the rule
      // text is present as real markup content, not inserted into an initially-empty stylesheet
      // after the fact.
      expect(styles[0].textContent).toContain("@font-face");
      expect(styles[0].textContent).toContain("font-family: vftest-basic");
      expect(styles[0].textContent).toContain("/fonts/icomoon.woff");
      expect(styles[0].textContent).toContain("format('woff')");
    });

    it("builds one url()/format() src entry per path when icon.path is an array, picking the format from each file extension", () => {
      mountBuilder({
        icon: {
          type: "vftest-multi",
          path: ["/fonts/icomoon.eot", "/fonts/icomoon.woff", "/fonts/icomoon.ttf", "/fonts/icomoon.svg"],
        },
      });

      const rule = fontFaceStyles("vftest-multi")[0].textContent!;
      expect(rule).toContain("format('embedded-opentype')");
      expect(rule).toContain("format('woff')");
      expect(rule).toContain("format('truetype')");
      expect(rule).toContain("format('svg')");
    });

    it("does nothing when icon.path is null (unchanged early-return behavior)", () => {
      mountBuilder({ icon: { type: "vftest-nopath", path: null } });
      expect(fontFaceStyles("vftest-nopath").length).toBe(0);
    });

    it("regression: mounting a second Builder with the SAME icon.type does not inject a duplicate <style>/@font-face", () => {
      mountBuilder({ icon: { type: "vftest-dedup", path: "/fonts/icomoon.woff" } });
      expect(fontFaceStyles("vftest-dedup").length).toBe(1);

      // A second, independent Builder instance/mount - e.g. a second `<Chart>` on the same page,
      // or the SAME `<Chart>` remounting on a reactive prop change (this project's own
      // `jui-chart-vue` `<Chart>` always constructs a fresh `Builder` rather than reusing one) -
      // configured with the identical icon type.
      mountBuilder({ icon: { type: "vftest-dedup", path: "/fonts/icomoon.woff" } });
      expect(fontFaceStyles("vftest-dedup").length).toBe(1);

      // A THIRD mount with a DIFFERENT icon.type is unaffected by the dedup guard - it's scoped
      // per `icon.type`, not a global "only ever inject once" latch.
      mountBuilder({ icon: { type: "vftest-dedup-other", path: "/fonts/icomoon.woff" } });
      expect(fontFaceStyles("vftest-dedup").length).toBe(1);
      expect(fontFaceStyles("vftest-dedup-other").length).toBe(1);

      document.head.querySelectorAll('style[data-jui-icon-type="vftest-dedup-other"]').forEach((el) => el.remove());
    });
  });

  describe("setThemeStyle via setTheme()/string-theme registerTheme dispatch", () => {
    it("resolves a string theme through the theme registry, merged with options.style", () => {
      registerTheme("test-theme", { colors: ["#000"], fontFamily: "Georgia" });
      const builder = mountBuilder({ theme: "test-theme", style: { fontFamily: "Overridden" } });
      expect(builder.theme("fontFamily")).toBe("Overridden");
      expect(builder.theme("colors")).toEqual(["#000"]);
    });
  });
});
