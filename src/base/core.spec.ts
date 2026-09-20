import { describe, expect, it, vi } from "vitest";
import { Core, type CoreOptions } from "./core";

interface TestOptions extends CoreOptions {
  label: string;
}

class TestCore extends Core<TestOptions> {
  initCalls = 0;
  lastOptionsAtInit: TestOptions | null = null;

  init(): void {
    this.initCalls++;
    this.lastOptionsAtInit = this.options;
  }

  static setup(): TestOptions {
    return { label: "default-label" };
  }
}

describe("Core", () => {
  describe("emit/on", () => {
    it("invokes a registered callback matching the (case-insensitive) type", () => {
      const core = new TestCore();
      const spy = vi.fn();
      core.on("Click", spy);

      core.emit("click", ["a", "b"]);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith("a", "b");
    });

    it("wraps a non-array `args` into a single-element array", () => {
      const core = new TestCore();
      const spy = vi.fn();
      core.on("tick", spy);

      core.emit("tick", "solo" as any);

      expect(spy).toHaveBeenCalledWith("solo");
    });

    it("invokes every matching handler and returns the LAST one's result (preserved original behavior)", () => {
      const core = new TestCore();
      core.on("x", () => "first");
      core.on("x", () => "second");

      expect(core.emit("x")).toBe("second");
    });

    it("on() silently no-ops for a non-string type or non-function callback", () => {
      const core = new TestCore();
      core.on(123 as any, () => {});
      core.on("y", "not-a-function" as any);
      expect(core.event.length).toBe(0);
    });

    it("emit() silently returns undefined for a non-string type", () => {
      const core = new TestCore();
      const spy = vi.fn();
      core.on("z", spy);
      expect(core.emit(123 as any)).toBeUndefined();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("off", () => {
    it("removes only entries matching the given type string", () => {
      const core = new TestCore();
      const a = vi.fn();
      const b = vi.fn();
      core.on("a", a);
      core.on("b", b);

      core.off("a");
      core.emit("a");
      core.emit("b");

      expect(a).not.toHaveBeenCalled();
      expect(b).toHaveBeenCalledTimes(1);
    });

    it("removes only entries matching the given callback reference", () => {
      const core = new TestCore();
      const a = vi.fn();
      const b = vi.fn();
      core.on("shared", a);
      core.on("shared", b);

      core.off(a);
      core.emit("shared");

      expect(a).not.toHaveBeenCalled();
      expect(b).toHaveBeenCalledTimes(1);
    });

    it("PRESERVED QUIRK: off() with neither a string nor a function wipes ALL events unconditionally", () => {
      const core = new TestCore();
      core.on("a", vi.fn());
      core.on("b", vi.fn());
      expect(core.event.length).toBe(2);

      core.off(undefined as any);

      expect(core.event.length).toBe(0);
    });
  });

  describe("setOption", () => {
    it("sets a single key/value pair", () => {
      const core = new TestCore();
      core.options = { label: "a" } as TestOptions;
      core.setOption("label", "b");
      expect(core.options.label).toBe("b");
    });

    it("merges an object of key/value pairs", () => {
      const core = new TestCore();
      core.options = { label: "a", extra: 1 } as any;
      core.setOption({ label: "z", extra: 2 });
      expect(core.options).toMatchObject({ label: "z", extra: 2 });
    });
  });

  describe("destroy", () => {
    it("is a verified no-op under real class semantics: does not throw, does not remove methods " +
      "from this instance or a sibling instance (the original's registry-shared-prototype " +
      "corruption bug is NOT reproduced, per Phase 0's inherit()-artifact rule)", () => {
      const a = new TestCore();
      const b = new TestCore();
      const spy = vi.fn();
      a.on("x", spy);

      expect(() => a.destroy()).not.toThrow();

      // `a`'s own methods/state still work after destroy()
      a.emit("x");
      expect(spy).toHaveBeenCalledTimes(1);

      // a sibling instance's methods are completely unaffected (no cross-instance corruption)
      expect(typeof b.on).toBe("function");
      expect(typeof b.emit).toBe("function");
      const spy2 = vi.fn();
      b.on("y", spy2);
      b.emit("y");
      expect(spy2).toHaveBeenCalledTimes(1);
    });
  });

  describe("mount", () => {
    it("wires root/options/timestamp and calls init()", () => {
      const core = new TestCore();
      const root = document.createElement("div");

      const before = Date.now();
      const result = core.mount(root, { label: "custom" });
      const after = Date.now();

      expect(result).toBe(core);
      expect(core.root).toBe(root);
      expect(core.options.label).toBe("custom");
      expect(core.timestamp).toBeGreaterThanOrEqual(before);
      expect(core.timestamp).toBeLessThanOrEqual(after);
      expect(core.initCalls).toBe(1);
      expect(core.lastOptionsAtInit).toBe(core.options);
    });

    it("fills in missing keys from the subclass's own static setup() when omitted", () => {
      const core = new TestCore();
      core.mount(document.createElement("div"));
      expect(core.options.label).toBe("default-label");
    });

    it("also fills in Core.setup()'s own {event:{}} default (leaf-then-ancestor merge order, " +
      "mirroring the original's getOptions() parent-chain walk)", () => {
      const core = new TestCore();
      core.mount(document.createElement("div"));
      expect(core.options.event).toEqual({});
    });

    it("binds each options.event entry via on(), matching createUIObject's real behavior", () => {
      const core = new TestCore();
      const handler = vi.fn();

      core.mount(document.createElement("div"), { event: { greet: handler } });
      core.emit("greet", ["hi"]);

      expect(handler).toHaveBeenCalledWith("hi");
    });

    it("index defaults to 0 (no DOM-selector multi-instantiation in this port)", () => {
      const core = new TestCore();
      expect(core.index).toBe(0);
      core.mount(document.createElement("div"));
      expect(core.index).toBe(0);
    });
  });

  describe("static setup", () => {
    it("Core.setup() itself returns just {event: {}}", () => {
      expect(Core.setup()).toEqual({ event: {} });
    });
  });
});
