import { describe, it, expect, vi } from "vitest";
import { CanvasCoreBrush } from "./core";
import type { CanvasPolygon, CanvasPolygonEntry } from "./core";
import { CoreBrush } from "../core";

// ---------------------------------------------------------------------------------------------
// Test doubles - same convention `brush/core.spec.ts`/`base/draw.spec.ts` established: a plain
// axis stub covering both `Draw.calculate3d()`'s own needs (`area`/`depth`/`degree`/
// `perspective`) and `addPolygon()`'s own direct `this.axis.depth` read for the `order` formula.
// ---------------------------------------------------------------------------------------------
function makeAxis(overrides: Partial<{ w: number; h: number; x: number; y: number; d: number }> = {}) {
  const w = overrides.w ?? 300;
  const h = overrides.h ?? 200;
  const x = overrides.x ?? 10;
  const y = overrides.y ?? 20;
  const d = overrides.d ?? 500;
  return {
    area: (key: string) => {
      if (key === "width") return w;
      if (key === "height") return h;
      if (key === "x") return x;
      if (key === "y") return y;
      throw new Error("unexpected key " + key);
    },
    depth: d,
    degree: {},
    perspective: 0.9,
  };
}

function makePolygon(z: number, overrides: Partial<CanvasPolygon> = {}): CanvasPolygon {
  return {
    perspective: undefined,
    rotate: vi.fn(),
    max: () => ({ x: 0, y: 0, z }),
    ...overrides,
  };
}

describe("CanvasCoreBrush", () => {
  it("extends CoreBrush (real chain: CanvasCoreBrush -> CoreBrush -> Draw)", () => {
    const b = new CanvasCoreBrush();
    expect(b).toBeInstanceOf(CoreBrush);
  });

  describe("addPolygon", () => {
    it("lazily initializes `polygons` to [] on first call", () => {
      const b = new CanvasCoreBrush();
      b.axis = makeAxis() as any;
      expect(b.polygons).toBeUndefined();

      const p = makePolygon(100);
      const handler = vi.fn();
      b.addPolygon(p, handler);

      expect(Array.isArray(b.polygons)).toBe(true);
      expect(b.polygons!.length).toBe(1);
    });

    it("re-checks the array guard on every call (an existing array is left untouched, not reset)", () => {
      const b = new CanvasCoreBrush();
      b.axis = makeAxis() as any;

      b.addPolygon(makePolygon(1), vi.fn());
      const firstArrayRef = b.polygons;
      b.addPolygon(makePolygon(2), vi.fn());

      expect(b.polygons).toBe(firstArrayRef); // same array instance, not replaced
      expect(b.polygons!.length).toBe(2);
    });

    it("PRESERVED QUIRK: a truthy-but-non-array `polygons` value is reset to [] (matches the original's `!_.typeCheck('array', ...)` guard, not a `??=`-style 'only if unset' check)", () => {
      const b = new CanvasCoreBrush();
      b.axis = makeAxis() as any;
      (b as any).polygons = "not an array";

      b.addPolygon(makePolygon(1), vi.fn());

      expect(Array.isArray(b.polygons)).toBe(true);
      expect(b.polygons!.length).toBe(1);
    });

    it("calls calculate3d(polygon) before queuing - rotate() is invoked with the calculate3d formula's arguments", () => {
      const b = new CanvasCoreBrush();
      const axis = makeAxis({ w: 300, h: 200, d: 500, x: 10, y: 20 });
      b.axis = axis as any;

      const rotate = vi.fn();
      const p = makePolygon(0, { rotate });
      b.addPolygon(p, vi.fn());

      // depth param = max(300,200,500) = 500; center = (10+150, 20+100, 500/2=250) - same formula
      // base/draw.spec.ts's calculate3d tests already verify directly.
      expect(rotate).toHaveBeenCalledWith(500, axis.degree, 160, 120, 250);
      expect(p.perspective).toBe(0.9); // calculate3d() stamps `.perspective` onto the rotated object
    });

    it("queues {polygon, order: axis.depth - polygon.max().z, handler}", () => {
      const b = new CanvasCoreBrush();
      b.axis = makeAxis({ d: 500 }) as any;

      const p = makePolygon(120);
      const handler = vi.fn();
      b.addPolygon(p, handler);

      const entry = b.polygons![0] as CanvasPolygonEntry;
      expect(entry.polygon).toBe(p);
      expect(entry.order).toBe(500 - 120); // 380
      expect(entry.handler).toBe(handler);
    });
  });

  describe("drawAfter", () => {
    it("no-op when `polygons` was never initialized (addPolygon never called)", () => {
      const b = new CanvasCoreBrush();
      expect(() => b.drawAfter()).not.toThrow();
      expect(b.polygons).toBeUndefined();
    });

    it("sorts the queue ASCENDING by order and drains it, calling each handler.call(this, polygon)", () => {
      const b = new CanvasCoreBrush();
      b.axis = makeAxis({ d: 500 }) as any;

      const calls: number[] = [];
      // order = axis.depth(500) - polygon.max().z: LARGER z (closer to the far plane, i.e.
      // visually FARTHER per calculate3d()'s own depth-cue convention - see dot3d.js's
      // `radiusDepthScale` cross-check in usePolygon3d.ts) -> SMALLER order -> sorted/drawn
      // FIRST (back-to-front painter's algorithm): pNear(z=0,order=500) is nearest the viewer
      // and must be drawn LAST (on top); pFar(z=400,order=100) is farthest and drawn FIRST.
      const pNear = makePolygon(0); // order = 500 - 0 = 500 (drawn LAST)
      const pMid = makePolygon(200); // order = 500 - 200 = 300 (drawn MIDDLE)
      const pFar = makePolygon(400); // order = 500 - 400 = 100 (drawn FIRST)

      b.addPolygon(pNear, function (this: CanvasCoreBrush, polygon) {
        calls.push(polygon.max().z);
      });
      b.addPolygon(pFar, function (this: CanvasCoreBrush, polygon) {
        calls.push(polygon.max().z);
      });
      b.addPolygon(pMid, function (this: CanvasCoreBrush, polygon) {
        calls.push(polygon.max().z);
      });

      b.drawAfter();

      expect(calls).toEqual([400, 200, 0]); // pFar (z=400) first, pNear (z=0) last
    });

    it("drains the queue completely - `polygons` ends up empty after drawAfter()", () => {
      const b = new CanvasCoreBrush();
      b.axis = makeAxis() as any;
      b.addPolygon(makePolygon(1), vi.fn());
      b.addPolygon(makePolygon(2), vi.fn());

      b.drawAfter();

      expect(b.polygons!.length).toBe(0);
    });

    it("handler runs with `this` bound to the CanvasCoreBrush instance, not the polygon", () => {
      const b = new CanvasCoreBrush();
      b.axis = makeAxis() as any;
      let capturedThis: unknown;
      b.addPolygon(makePolygon(0), function (this: CanvasCoreBrush) {
        capturedThis = this;
      });

      b.drawAfter();

      expect(capturedThis).toBe(b);
    });

    it("PRESERVED BEHAVIOR: completely shadows CoreBrush.drawAfter() - no clip-path/CSS-class/translate wiring runs", () => {
      const b = new CanvasCoreBrush();
      b.axis = makeAxis() as any;
      (b.axis as any).get = () => "clip-id";
      b.brush = { clip: true, type: "canvas-poly" } as any;
      b.chart = { area: vi.fn(() => 0) } as any;

      const attr = vi.fn();
      const translate = vi.fn();

      b.drawAfter();

      // CoreBrush.drawAfter would call obj.attr({clip-path...}), obj.attr({class...}), and
      // obj.translate(...) - none of that happens here since CanvasCoreBrush's own drawAfter
      // field completely replaces (does not call) the inherited one.
      expect(attr).not.toHaveBeenCalled();
      expect(translate).not.toHaveBeenCalled();
      expect(b.chart.area).not.toHaveBeenCalled();
    });
  });
});
