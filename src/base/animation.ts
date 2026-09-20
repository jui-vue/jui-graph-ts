// Port of juijs-graph's `src/base/animation.js` ("chart.animation", extend: "core").
//
// A RAF-polling wrapper: builds (via `base/builder.ts`'s already-ported `Builder`) a single
// real-time chart instance and repeatedly re-renders it on every animation frame, tracking a
// frames-per-second estimate (`tpf`/`fps`) that gets threaded through to any brush/widget reading
// it back via `Builder.getCache("tpf"/"fps")`. jui-chart-vue's `dot3d.js` Phase E writeup flagged
// this file (then unported) as the origin of the `tpf===1` skip-first-frame guard its own
// `ChartCanvasBase.vue`/RAF loop reproduces differently - that non-migration decision stands; this
// is a faithful, independent port of the original, no obligation to retrofit jui-chart-vue's
// `useAnimationFrameLoop.ts` to use it (a Phase F question, once evaluated against the real thing).
//
// ============================================================================================
// STRUCTURAL GAP (same category as `builder.ts`'s own header comment - read that one first for the
// established pattern this file follows): `animation.js` is `extend: "core"` in the original, but
// `base/core.ts` doesn't exist yet (excluded from this task, a future Phase B item). Checking what
// this file's OWN methods (`init`/`run`/`stop`/`set`/`update`/`render`) actually use from Core:
// **nothing.** Core's real surface (`emit`/`on`/`off`/`setOption`/`destroy`, the `this.event`
// array) is never referenced anywhere in `animation.js` itself. Even `this.options`/`this.selector`
// aren't defined by Core's own constructor (`UICore`) either - Core's constructor only *defines
// methods*; `options`/`selector`/`root`/`event`/`index` are wired externally by the dropped
// registry's `jui.createUIObject` (a hack that assigns them onto `mainObj.init.prototype`, itself
// `=== mainObj` via a prior-line reassignment, before calling `.init()` - see `base/base.js`'s
// `createUIObject`). So nothing is actually lost by not literally extending anything yet: `selector`
// and `options` are real constructor parameters here instead (assigned directly, replacing what the
// registry would have wired in), and the unused Core event-bus surface is not reproduced. When
// `base/core.ts` lands, `class Animation extends Core` can be revisited for real - no additional
// Core-provided member is needed by this file's current logic, so that revisit is a formality, not
// a functional gap today.
//
// `this.builder = builder(this.selector, opts)` in the original resolves `builder` to
// `UICore.build(BuilderUI)` - a factory that (a) resolves `selector` to zero, one, or *many* DOM
// elements via `$.find`, (b) builds one chart instance per matched element via
// `jui.createUIObject`, (c) returns `null` (zero matches), the single instance (one match), or a
// raw JS **array** of instances (two-or-more matches) - the array case then gets wrapped in a
// `UICollection` purely for the dropped registry's own bookkeeping (see `collection.js`'s writeup
// in PORT_STATUS.md - not ported, pure registry artifact). Every one of `animation.js`'s own
// methods (`run`/`set`/`update`/`render`) then calls methods directly on `this.builder` as if it
// were always a single instance (`this.builder.axis(0)`, `this.builder.setCache(...)`,
// `this.builder.render(...)`) - meaning the "matches more than one element" case was **already
// broken in the original**: calling any of those on a raw array throws `TypeError` (arrays have no
// `.setCache`/`.axis` method), and the zero-match (`null`) case throws
// `TypeError: Cannot read properties of null` on first use too. Neither is a port-introduced bug.
// This port reproduces both faithfully via `resolveBuilderTarget()` below (tested), rather than
// silently only supporting the single-match happy path.
//
// `Animation.builder` is typed as `Builder` (the intended/working single-match case) even though
// it may actually hold `null` or `Builder[]` at runtime in the two broken-in-the-original edge
// cases above - the same "untyped JS lied about the shape too" situation the original itself had,
// just made visible here as a documented, deliberate type assertion instead of silent `any`.
//
// Precondition inherited transitively from `Builder.mount()` (see `builder.ts`): `registerAxis()`
// must be called with a real `AxisConstructor` (e.g. the already-ported `Axis` from `./axis`)
// before `Animation.init()` runs, or `Builder.mount()` throws `JUI_CRITICAL_ERR: no Axis
// implementation registered`. `animation.ts` does not call `registerAxis()` itself (that wiring
// belongs to whoever assembles the real chart, same as `builder.ts` already expects) - tests below
// register a fake per Builder's own established test convention (`builder.spec.ts`'s `FakeAxis`).
// ============================================================================================

import { Builder, type BuilderOptions } from "./builder";
import { find } from "../util/dom";

export interface AnimationOptions {
  interval?: number;
  axis?: any[];
  [key: string]: any;
}

// ---- inlined `util/base.js` `extend()` (private, per-file convention already established by
// `axis.ts`/`builder.ts`) - only the two type tags `extend()` itself actually branches on
// ("object"/"function", to validate its own arguments; "undefined", to decide skip-vs-overwrite)
// are reproduced, not the full `typeCheck()` surface. -----------------------------------------
function isPlainObjectOrFunction(value: unknown): boolean {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function isRecursive(value: unknown): boolean {
  // Original: `utility.typeCheck("object", value)` - excludes arrays/functions/null, same as
  // every other private `typeCheck` port in this project.
  return typeof value === "object" && value !== null && !(value instanceof Array) && !(value instanceof Date);
}

function extend(origin: Record<string, any>, add: Record<string, any>, skip?: boolean): Record<string, any> {
  if (!isPlainObjectOrFunction(origin)) origin = {};
  if (!isPlainObjectOrFunction(add)) return origin;

  for (const key in add) {
    if (skip === true) {
      if (isRecursive(origin[key])) {
        extend(origin[key], add[key], skip);
      } else if (typeof origin[key] === "undefined") {
        origin[key] = add[key];
      }
    } else {
      if (isRecursive(origin[key])) {
        extend(origin[key], add[key], skip);
      } else {
        origin[key] = add[key];
      }
    }
  }

  return origin;
}

/**
 * Resolves `selector` to 0/1/many root elements (mirrors `base/core.js`'s `UICore.build` element
 * resolution: a string selector via `find()`, a literal DOM object passed straight through, or a
 * freshly-created `<div>` as the fallback for anything else) and mounts one `Builder` per matched
 * element. See this file's header comment for why the 0-match/many-match results (`null`/an array)
 * are deliberately NOT narrowed to `Builder` - they faithfully reproduce the original's own
 * already-broken behavior for those cases.
 */
function resolveBuilderTarget(
  selector: string | Element | null | undefined,
  options: AnimationOptions
): Builder | Builder[] | null {
  let elemList: Element[];

  if (typeof selector === "string") {
    elemList = Array.from(find(selector));
  } else if (selector && typeof selector === "object") {
    elemList = [selector];
  } else {
    elemList = [document.createElement("div")];
  }

  const list = elemList.map((elem) => new Builder().mount(elem as HTMLElement, options as Partial<BuilderOptions>));

  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  return list;
}

export class Animation {
  selector: string | Element;
  options: AnimationOptions;

  /** See header comment: intended shape is a single `Builder`, but a selector matching zero or
   * more-than-one element faithfully reproduces the original's own runtime TypeError instead. */
  builder!: Builder;

  private interval = 0;
  private animateSeq = -1;
  private prevTime = 0;
  private startTime = 0;

  constructor(selector: string | Element, options: AnimationOptions = {}) {
    this.selector = selector;
    // Registry equivalent of `jui.defineOptions(UI["class"], options)` - merges caller-supplied
    // options against this class's own `setup()` defaults (skip = true: fill only, never override
    // an explicitly-passed value).
    this.options = extend(options || {}, Animation.setup(), true) as AnimationOptions;
  }

  init(): void {
    const opts = this.options;

    // 차트 빌더는 interval 옵션을 사용하지 않기 때문에 삭제함
    // (the chart builder doesn't use the `interval` option, so it's removed)
    this.interval = (opts.interval as number) ?? 0;
    delete opts.interval;

    if (opts.axis!.length && opts.axis!.length > 1) {
      throw new Error("JUI_CRITICAL_ERR: the real-time module allows only a single axes");
    }

    this.builder = resolveBuilderTarget(this.selector, opts) as unknown as Builder;
  }

  run(callback?: (this: Animation, elapsed: number) => any): void {
    const currentTime = Date.now();

    if (this.startTime === 0) {
      this.startTime = currentTime;
    }

    if (currentTime - this.prevTime > this.interval || this.interval === 0) {
      let tpf = (currentTime - this.prevTime) / 1000;
      if (tpf > 1) tpf = 1;

      this.builder.setCache("tpf", tpf);
      this.builder.setCache("fps", 1.0 / tpf);

      if (typeof callback === "function") {
        callback.call(this, currentTime - this.startTime);
      }

      this.render();
      this.prevTime = currentTime;
    }

    this.animateSeq = requestAnimationFrame(() => {
      this.run(callback);
    });
  }

  stop(): void {
    if (this.animateSeq !== -1) {
      cancelAnimationFrame(this.animateSeq);
      this.animateSeq = -1;
    }
  }

  set(type: string, value: unknown, isReset?: boolean): void {
    this.builder.axis(0).set(type, value, isReset);
  }

  update(data: unknown): void {
    this.builder.axis(0).update(data);
  }

  render(isAll?: boolean): void {
    this.builder.render(isAll);
  }

  static setup(): AnimationOptions {
    return extend({ render: false, canvas: true, interval: 0 }, Builder.setup(), true) as AnimationOptions;
  }
}
