import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Animation, type AnimationOptions } from "./animation";
import { Builder, registerAxis, type AxisConstructor, type AxisLike } from "./builder";

// Same test-double convention `builder.spec.ts` already established for `AxisImpl` (a fake,
// registered via `registerAxis()`, rather than pulling in the full real `Axis`/SVG grid-rendering
// stack this file's own logic doesn't need to exercise). Extended here with `set()`/`update()`
// spies since `Animation.set()`/`update()` call straight through to whatever `builder.axis(0)`
// returns (typed `any` by `Builder.axis()`, so nothing here needs a broader `AxisLike`).
class FakeAxis implements AxisLike {
  data: any[];
  index?: number;
  setCalls: Array<[string, unknown, boolean | undefined]> = [];
  updateCalls: unknown[] = [];

  constructor(
    public chart: Builder,
    public rawOptions: any,
    public mergedOptions: any
  ) {
    this.data = (rawOptions && rawOptions.data) || [];
  }

  reload(_options: any): void {}

  set(type: string, value: unknown, isReset?: boolean): void {
    this.setCalls.push([type, value, isReset]);
  }

  update(data: unknown): void {
    this.updateCalls.push(data);
  }
}
(FakeAxis as unknown as { setup(): any }).setup = () => ({});

beforeEach(() => {
  registerAxis(FakeAxis as unknown as AxisConstructor);
});

function makeAnimation(el: Element | string, options: AnimationOptions = {}): Animation {
  // `canvas: false` sidesteps a real, pre-existing jsdom limitation already documented in
  // PORT_STATUS.md for `util/canvas/hidpi.ts`: jsdom's `getContext("2d")` returns `null` (no
  // `canvas` npm package dependency), and `Builder`'s own `resetCanvasElement()` dereferences that
  // context unconditionally (`context.restore()`) - so mounting with `canvas: true` (Animation's
  // own real default - see the dedicated test below) throws under jsdom specifically, not because
  // of anything Animation itself does wrong. `builder.spec.ts` avoids the same landmine the same
  // way (never exercises `canvas: true`).
  return new Animation(el, { canvas: false, ...options });
}

describe("Animation.setup()", () => {
  it("layers its own render/canvas/interval overrides on top of Builder.setup()'s defaults without letting them get clobbered", () => {
    // Node-cross-checked against the private `extend()` port's semantics (`skip === true`: fill a
    // key only when the origin doesn't already have it - so origin's own render/canvas/interval
    // values win over anything Builder.setup() would otherwise supply for those same three keys).
    const setup = Animation.setup();

    expect(setup.render).toBe(false);
    expect(setup.canvas).toBe(true);
    expect(setup.interval).toBe(0);

    // Everything else comes from Builder.setup(), merged in because Animation's own base object
    // doesn't define these keys at all.
    expect(setup.width).toBe("100%");
    expect(setup.height).toBe("100%");
    expect(setup.theme).toBe("classic");
    expect(setup.axis).toEqual([]);
    expect(setup.brush).toEqual([]);
    expect(setup.widget).toEqual([]);
  });
});

describe("Animation constructor", () => {
  it("merges caller-supplied options against setup() defaults, filling gaps without overriding explicit values", () => {
    const anim = new Animation(document.createElement("div"), { canvas: false, interval: 500 });

    expect(anim.options.canvas).toBe(false); // explicit - not overridden by setup()'s canvas: true
    expect(anim.options.interval).toBe(500); // explicit - not overridden by setup()'s interval: 0
    expect(anim.options.render).toBe(false); // filled in from setup() (not explicitly provided)
    expect(anim.options.axis).toEqual([]); // filled in from setup() via Builder.setup()
  });
});

describe("Animation.init()", () => {
  it("moves options.interval into private state and deletes it from options ('the chart builder doesn't use the interval option')", () => {
    const anim = makeAnimation(document.createElement("div"), { interval: 250 });
    anim.init();

    expect(anim.options.interval).toBeUndefined();
    expect((anim as any).interval).toBe(250);
  });

  it("throws when more than one axis is configured - the real-time module only supports a single axis", () => {
    const anim = makeAnimation(document.createElement("div"), { axis: [{ data: [] }, { data: [] }] });
    expect(() => anim.init()).toThrow("JUI_CRITICAL_ERR: the real-time module allows only a single axes");
  });

  it("does not throw for zero or one configured axis", () => {
    expect(() => makeAnimation(document.createElement("div"), {}).init()).not.toThrow();
    expect(() => makeAnimation(document.createElement("div"), { axis: [{ data: [] }] }).init()).not.toThrow();
  });

  it("mounts a single Builder directly on a literal Element selector", () => {
    const el = document.createElement("div");
    const anim = makeAnimation(el);
    anim.init();

    expect(anim.builder).toBeInstanceOf(Builder);
    expect(anim.builder.root).toBe(el);
  });

  it("resolves a string selector matching exactly one element the same way", () => {
    document.body.innerHTML = '<div id="single-target"></div>';
    const anim = makeAnimation("#single-target");
    anim.init();

    expect(anim.builder).toBeInstanceOf(Builder);
    expect(anim.builder.root.id).toBe("single-target");
    document.body.innerHTML = "";
  });

  it("falls back to creating a fresh <div> when selector is neither a string nor an object (mirrors the original's UICore.build 'else' branch)", () => {
    const anim = makeAnimation(123 as unknown as Element);
    anim.init();

    expect(anim.builder).toBeInstanceOf(Builder);
    expect(anim.builder.root.tagName).toBe("DIV");
  });

  it("PRESERVED bug: a selector matching zero elements leaves `builder` null, and any subsequent chart-facing call throws exactly as the untyped original does on first use", () => {
    const anim = makeAnimation("#does-not-exist-anywhere");
    anim.init();

    expect(anim.builder).toBeNull();
    expect(() => anim.render()).toThrow(TypeError);
    expect(() => anim.set("x", 1)).toThrow(TypeError);
    expect(() => anim.update({})).toThrow(TypeError);
  });

  it("PRESERVED bug: a selector matching more than one element leaves `builder` a raw array (built per-element, exactly like UICore.build's list), and any chart-facing call throws", () => {
    document.body.innerHTML = '<div class="multi-target"></div><div class="multi-target"></div>';
    const anim = makeAnimation(".multi-target");
    anim.init();

    expect(Array.isArray(anim.builder)).toBe(true);
    expect((anim.builder as unknown as Builder[]).length).toBe(2);
    expect(() => anim.render()).toThrow(TypeError);
    document.body.innerHTML = "";
  });

  it("jsdom limitation, not an Animation bug: mounting with the real canvas: true default throws because jsdom's canvas 2D context is always null (see util/canvas/hidpi.ts's own PORT_STATUS.md notes)", () => {
    // Deliberately NOT using makeAnimation()'s canvas:false override, to exercise Animation's own
    // actual default (canvas: true) once and document what happens under this test environment.
    const anim = new Animation(document.createElement("div"), {});
    expect(() => anim.init()).toThrow(TypeError);
  });
});

describe("Animation.run()/stop()", () => {
  let rafCallbacks: FrameRequestCallback[];
  let rafId: number;
  let cancelSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    cancelSpy = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return ++rafId;
    });
    vi.stubGlobal("cancelAnimationFrame", cancelSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function armed(options: AnimationOptions = {}): Animation {
    const anim = makeAnimation(document.createElement("div"), options);
    anim.init();
    return anim;
  }

  it("always renders on the first call (prevTime starts at 0) regardless of a nonzero interval, since Date.now() dwarfs any realistic interval", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const anim = armed({ interval: 100 });
    const renderSpy = vi.spyOn(anim.builder, "render");
    const setCacheSpy = vi.spyOn(anim.builder, "setCache");

    anim.run();

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(setCacheSpy).toHaveBeenCalledWith("tpf", 1); // clamped: (currentTime - 0) / 1000 >> 1
    expect(setCacheSpy).toHaveBeenCalledWith("fps", 1);
    expect(rafCallbacks).toHaveLength(1);
  });

  it("clamps tpf to 1 when more than 1000ms have elapsed since the previously RENDERED frame (the tpf===1 skip-guard jui-chart-vue's dot3d.js writeup flagged)", () => {
    const nowSpy = vi.spyOn(Date, "now");
    const base = 1_700_000_000_000;
    nowSpy.mockReturnValue(base);

    const anim = armed({ interval: 0 });
    const setCacheSpy = vi.spyOn(anim.builder, "setCache");
    vi.spyOn(anim.builder, "render");

    anim.run(); // first call: tpf = (base - 0) / 1000, astronomically large -> clamped to 1 too
    expect(setCacheSpy).toHaveBeenLastCalledWith("fps", 1);

    nowSpy.mockReturnValue(base + 5000); // 5s later
    anim.run();
    expect(setCacheSpy).toHaveBeenCalledWith("tpf", 1);
    expect(setCacheSpy).toHaveBeenLastCalledWith("fps", 1);
  });

  it("computes an un-clamped tpf/fps when elapsed time is under 1 second", () => {
    const nowSpy = vi.spyOn(Date, "now");
    const base = 0;
    nowSpy.mockReturnValue(base);

    const anim = armed({ interval: 0 });
    const setCacheSpy = vi.spyOn(anim.builder, "setCache");
    vi.spyOn(anim.builder, "render");

    anim.run(); // prevTime 0, currentTime 0 -> tpf = 0
    expect(setCacheSpy).toHaveBeenCalledWith("tpf", 0);

    nowSpy.mockReturnValue(500); // 500ms later
    anim.run();
    expect(setCacheSpy).toHaveBeenCalledWith("tpf", 0.5);
    expect(setCacheSpy).toHaveBeenCalledWith("fps", 2);
  });

  it("respects a nonzero interval: skips the render branch (and the callback, and prevTime update) until enough time has elapsed since the last RENDERED frame, but still schedules the next RAF frame either way", () => {
    const nowSpy = vi.spyOn(Date, "now");
    const base = 1_700_000_000_000;
    nowSpy.mockReturnValue(base);

    const anim = armed({ interval: 100 });
    const renderSpy = vi.spyOn(anim.builder, "render");

    anim.run(); // huge gap since prevTime(0) -> renders, prevTime := base
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(rafCallbacks).toHaveLength(1);

    nowSpy.mockReturnValue(base + 50); // only 50ms since the last RENDERED frame - under interval
    anim.run();
    expect(renderSpy).toHaveBeenCalledTimes(1); // unchanged
    expect(rafCallbacks).toHaveLength(2); // RAF is still scheduled regardless

    nowSpy.mockReturnValue(base + 150); // now over the 100ms interval
    anim.run();
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  it("invokes the callback with elapsed time since the FIRST run() call, with `this` bound to the Animation instance - only when the render branch actually runs", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1000);
    const anim = armed({ interval: 0 });
    vi.spyOn(anim.builder, "render");
    vi.spyOn(anim.builder, "setCache");

    let receivedElapsed: number | undefined;
    let receivedThis: unknown;
    const callback = vi.fn(function (this: Animation, elapsed: number) {
      receivedElapsed = elapsed;
      receivedThis = this;
    });

    anim.run(callback);
    expect(receivedElapsed).toBe(0); // startTime just latched to currentTime on this first call
    expect(receivedThis).toBe(anim);

    nowSpy.mockReturnValue(3500);
    anim.run(callback);
    expect(receivedElapsed).toBe(2500); // 3500 - startTime(1000)
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("stop() cancels the pending frame and resets state so a second stop() call is a no-op (matches the animateSeq !== -1 guard)", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const anim = armed();
    anim.run();
    expect((anim as any).animateSeq).not.toBe(-1);

    anim.stop();
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect((anim as any).animateSeq).toBe(-1);

    anim.stop();
    expect(cancelSpy).toHaveBeenCalledTimes(1); // guarded - no second cancelAnimationFrame call
  });

  it("stop() before any run() is a no-op (animateSeq starts at -1)", () => {
    const anim = armed();
    anim.stop();
    expect(cancelSpy).not.toHaveBeenCalled();
  });
});

describe("Animation.set()/update()/render() delegation", () => {
  it("set() delegates to builder.axis(0).set(type, value, isReset)", () => {
    const anim = makeAnimation(document.createElement("div"), { axis: [{ data: [] }] });
    anim.init();

    anim.set("range", [0, 10], true);

    const axis0 = anim.builder.axis(0) as FakeAxis;
    expect(axis0.setCalls).toEqual([["range", [0, 10], true]]);
  });

  it("update() delegates to builder.axis(0).update(data)", () => {
    const anim = makeAnimation(document.createElement("div"), { axis: [{ data: [] }] });
    anim.init();

    anim.update([{ a: 1 }]);

    const axis0 = anim.builder.axis(0) as FakeAxis;
    expect(axis0.updateCalls).toEqual([[{ a: 1 }]]);
  });

  it("render() delegates to builder.render(isAll)", () => {
    const anim = makeAnimation(document.createElement("div"));
    anim.init();
    const renderSpy = vi.spyOn(anim.builder, "render");

    anim.render(true);
    expect(renderSpy).toHaveBeenCalledWith(true);

    anim.render();
    expect(renderSpy).toHaveBeenLastCalledWith(undefined);
  });
});
