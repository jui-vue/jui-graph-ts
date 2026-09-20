import { describe, it, expect } from "vitest";
import { SVG3d } from "./base3d";
import { TransElement } from "./element.transform";

describe("SVG3d", () => {
    it("rect3d()/cylinder3d() return a <g> TransElement", () => {
        const svg3d = new SVG3d();
        expect(svg3d.rect3d("#ff0000", 10, 10, 30, 5)).toBeInstanceOf(TransElement);
        expect(svg3d.cylinder3d("#00ff00", 10, 10, 30, 5)).toBeInstanceOf(TransElement);
    });

    it("preserved quirk: a bare SVG3d instance's create() never invokes group() callbacks, so rect3d()/cylinder3d() build empty groups", () => {
        // SVGBase.create() (inherited, unshadowed here - only svg.ts's SVG class overrides it)
        // completely ignores the `callback` argument. rect3d()/cylinder3d() build their actual
        // path/ellipse content INSIDE such a callback (`self.group({}, function() {...})`), so on
        // a bare SVG3d (or SVGBase) instance that content is never actually constructed - the
        // returned group has zero children. This only "works" for real when accessed through the
        // full SVG class (see svg.spec.ts), whose create() override does invoke callbacks
        // synchronously - exactly matching the original's own behavior.
        const svg3d = new SVG3d();
        const g = svg3d.rect3d("#ff0000", 10, 10, 30, 5);
        expect(g.children).toEqual([]);

        const cyl = svg3d.cylinder3d("#00ff00", 10, 10, 30, 5);
        expect(cyl.children).toEqual([]);
    });
});
