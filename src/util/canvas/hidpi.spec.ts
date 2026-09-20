import { describe, it, expect } from "vitest";
import { pixelRatio, apply, polyfills } from "./hidpi";

// Under jsdom (no real `canvas` npm package installed, matching this project's dependencies),
// `HTMLCanvasElement.getContext('2d')` returns `null` and `window.devicePixelRatio` is `1` - so
// `pixelRatio` always computes to exactly 1 in this test environment, which means
// `polyfillForCanvasRenderingContext2D()`'s own `if (pixelRatio === 1) return;` guard (see
// hidpi.ts) fires on every call here, and the actual coordinate-scaling logic below it never
// runs. That logic (and the `isPointinPath`/`isPointinStroke` typo bug documented in hidpi.ts)
// is verified by hand-trace/Node-cross-check in the comments below instead, the same treatment
// `element.path.ts`'s jsdom-unimplemented `length()` got.
describe("canvas/hidpi", () => {
    it("pixelRatio is a positive finite number, computed once at module load", () => {
        expect(typeof pixelRatio).toBe("number");
        expect(pixelRatio).toBeGreaterThan(0);
        expect(Number.isFinite(pixelRatio)).toBe(true);
    });

    it("under jsdom, pixelRatio is exactly 1 (devicePixelRatio=1, backingStorePixelRatio falls back to 1 since getContext('2d') is null)", () => {
        expect(pixelRatio).toBe(1);
    });

    it("apply() does not throw against a context-shaped stub, and leaves methods unpatched when pixelRatio===1", () => {
        const originalFillRect = () => "sentinel";
        const ctx: any = { fillRect: originalFillRect, stroke: () => {}, fillText: () => {}, strokeText: () => {} };

        expect(() => apply(ctx)).not.toThrow();
        // pixelRatio===1 short-circuits the whole patch loop - the method is untouched.
        expect(ctx.fillRect).toBe(originalFillRect);
    });

    it("polyfills() throws under jsdom: the global CanvasRenderingContext2D class itself doesn't exist without the optional `canvas` npm package", () => {
        // This is a real environment limitation, not a port bug: jsdom defines
        // `HTMLCanvasElement` regardless, but only defines `CanvasRenderingContext2D` as a global
        // when the native `canvas` package (not a dependency of this project) is installed.
        // `polyfills()` references `CanvasRenderingContext2D.prototype` directly - exactly like
        // the original - so it throws a ReferenceError here. `apply()` (tested above) is
        // unaffected since it takes a context object directly rather than reaching for the
        // global class.
        expect(() => polyfills()).toThrow(ReferenceError);
    });

    // Hand-trace (not runtime-verifiable under jsdom's pixelRatio===1 environment): with e.g.
    // pixelRatio=2, `ratioArgs.arc = [0,1,2]` means `context.arc(x,y,r,start,end)` gets patched
    // so only ARGUMENT INDICES 0/1/2 (x, y, r) are multiplied by 2 - start/end angles (indices
    // 3/4) are deliberately left unscaled, which is correct (angles aren't pixel coordinates).
    // `ratioArgs.fillRect = 'all'` instead multiplies EVERY argument - correct there too, since
    // all 4 of fillRect(x,y,w,h) are pixel-space.
    //
    // Preserved bug (see hidpi.ts's `ratioArgs` doc comment, verified by direct inspection of the
    // object literal rather than a runtime assertion, since jsdom can't construct a real
    // CanvasRenderingContext2D to patch - see the test above): `isPointinPath`/`isPointinStroke`
    // are typo'd (should be `isPointInPath`/`isPointInStroke`), so the patch loop patches two
    // dead, never-callable property names instead of the real methods - `isPointInPath`/
    // `isPointInStroke` remain completely unscaled by this polyfill, a genuine coverage gap.
    it("documents the isPointinPath/isPointinStroke typo via apply() against a stub context", () => {
        const ctx: any = { isPointInPath: () => true, isPointInStroke: () => true };
        // pixelRatio===1 under jsdom prevents actually observing the patch loop run at all (see
        // the guard-behavior test above) - this at least confirms apply() doesn't accidentally
        // touch the correctly-spelled methods regardless.
        apply(ctx);
        expect(typeof ctx.isPointInPath).toBe("function");
        expect(typeof ctx.isPointInStroke).toBe("function");
        expect(ctx.isPointinPath).toBeUndefined();
        expect(ctx.isPointinStroke).toBeUndefined();
    });
});
