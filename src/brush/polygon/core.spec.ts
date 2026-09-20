import { describe, it, expect, vi } from "vitest";
import { PolygonCoreBrush } from "./core";
import type { PolygonBrushPolygon, PolygonBrushElement } from "./core";
import { CoreBrush } from "../core";

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

function makePolygon(z: number, overrides: Partial<PolygonBrushPolygon> = {}): PolygonBrushPolygon {
  return {
    perspective: undefined,
    rotate: vi.fn(),
    max: () => ({ x: 0, y: 0, z }),
    ...overrides,
  };
}

describe("PolygonCoreBrush", () => {
  it("extends CoreBrush (real chain: PolygonCoreBrush -> CoreBrush -> Draw)", () => {
    const b = new PolygonCoreBrush();
    expect(b).toBeInstanceOf(CoreBrush);
  });

  describe("static setup()", () => {
    it("returns {id: null, clip: false} - `clip` diverges from CoreBrush.setup()'s own `clip: true` default", () => {
      expect(PolygonCoreBrush.setup()).toEqual({ id: null, clip: false });
      expect(CoreBrush.setup()).toMatchObject({ clip: true });
    });
  });

  describe("createPolygon", () => {
    it("calls calculate3d(polygon) before invoking callback - matches the same calculate3d() formula addPolygon() uses", () => {
      const b = new PolygonCoreBrush();
      const axis = makeAxis({ w: 300, h: 200, d: 500, x: 10, y: 20 });
      b.axis = axis as any;

      const rotate = vi.fn();
      const p = makePolygon(0, { rotate });
      b.createPolygon(p, () => undefined);

      expect(rotate).toHaveBeenCalledWith(500, axis.degree, 160, 120, 250);
      expect(p.perspective).toBe(0.9);
    });

    it("invokes callback with `this` bound to the PolygonCoreBrush instance, passing the (now-rotated) polygon", () => {
      const b = new PolygonCoreBrush();
      b.axis = makeAxis() as any;
      const p = makePolygon(10);

      let capturedThis: unknown;
      let capturedPolygon: unknown;
      b.createPolygon(p, function (this: PolygonCoreBrush, polygon) {
        capturedThis = this;
        capturedPolygon = polygon;
        return undefined;
      });

      expect(capturedThis).toBe(b);
      expect(capturedPolygon).toBe(p);
    });

    it("when callback returns a truthy element, stamps order = axis.depth - polygon.max().z and returns it", () => {
      const b = new PolygonCoreBrush();
      b.axis = makeAxis({ d: 500 }) as any;
      const p = makePolygon(120);
      const element: PolygonBrushElement = { tag: "polygon-el" };

      const result = b.createPolygon(p, () => element);

      expect(result).toBe(element);
      expect(result!.order).toBe(500 - 120); // 380
    });

    it("PRESERVED QUIRK: when callback returns nothing (undefined), createPolygon() itself returns undefined and stamps NO order anywhere (line3d.js's real usage pattern)", () => {
      const b = new PolygonCoreBrush();
      b.axis = makeAxis({ d: 500 }) as any;
      const p = makePolygon(120);

      const result = b.createPolygon(p, () => undefined);

      expect(result).toBeUndefined();
    });

    it("PRESERVED QUIRK: a falsy-but-not-undefined callback return value (e.g. null) is also treated as 'no element' - no order stamped, undefined returned", () => {
      const b = new PolygonCoreBrush();
      b.axis = makeAxis({ d: 500 }) as any;
      const p = makePolygon(120);

      const result = b.createPolygon(p, () => null as any);

      expect(result).toBeUndefined();
    });
  });
});
