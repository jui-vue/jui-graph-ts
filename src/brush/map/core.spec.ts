import { describe, it, expect, vi } from "vitest";
import { MapCoreBrush } from "./core";
import { CoreBrush } from "../core";

describe("MapCoreBrush", () => {
  it("extends CoreBrush (real chain: MapCoreBrush -> CoreBrush -> Draw) and is a pure, empty extension point", () => {
    const b = new MapCoreBrush();
    expect(b).toBeInstanceOf(CoreBrush);
  });

  it("adds NO methods/fields beyond CoreBrush - own-property set is identical to a bare CoreBrush instance's", () => {
    const b = new MapCoreBrush();
    const base = new CoreBrush();
    // Matches the original's literally-empty constructor body (`var MapCoreBrush = function()
    // {}`) - no own properties assigned by MapCoreBrush itself beyond whatever `Draw`/`CoreBrush`
    // already declare as class fields (`chart`/`axis`/`grid`/`brush`/`widget`/`map`/`svg`/
    // `canvas`/`draw`/`drawBefore`/`drawAfter`/`drawAnimate`, all `undefined` until externally
    // wired post-construction - see `brush/core.ts`'s own header comment).
    expect(Object.keys(b).sort()).toEqual(Object.keys(base).sort());
  });

  it("inherits CoreBrush's real method surface unmodified (e.g. static setup()'s 6-key defaults)", () => {
    expect(MapCoreBrush.setup()).toEqual({
      target: null,
      colors: null,
      axis: 0,
      index: null,
      clip: true,
      useEvent: true,
    });
  });

  it("inherits CoreBrush.drawAfter (clip-path/CSS-class/translate wiring) UNMODIFIED - not shadowed like CanvasCoreBrush's own override", () => {
    const b = new MapCoreBrush();
    b.axis = { get: () => "clip-id-0" } as any;
    b.brush = { clip: true, type: "map-test" } as any;
    b.chart = { area: (key: string) => (key === "x" ? 5 : 7) } as any;

    const attr = vi.fn();
    const translate = vi.fn();
    b.drawAfter({ attr, translate } as any);

    expect(attr).toHaveBeenCalledWith({ "clip-path": "url(#clip-id-0)" });
    expect(attr).toHaveBeenCalledWith({ class: "brush-map-test" });
    expect(translate).toHaveBeenCalledWith(5, 7);
  });
});
