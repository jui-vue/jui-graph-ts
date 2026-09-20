import { describe, it, expect } from "vitest";
import { PathSymbolElement } from "./element.path.symbol";

function makeSymbol(): PathSymbolElement {
    const el = new PathSymbolElement();
    el.create("path");
    return el;
}

describe("PathSymbolElement", () => {
    describe("template()", () => {
        it("builds raw command-string templates for each symbol shape", () => {
            const el = makeSymbol();
            const tpl = el.template(10, 10);

            expect(tpl.triangle).toBe("m0,-5 l5,10 l-10,0 l5,-10");
            expect(tpl.rect).toBe("m-5,-5 l10,0 l0,10 l-10,0 l0,-10");
            expect(tpl.rectangle).toBe(tpl.rect);
            expect(tpl.cross).toBe("m-5,-5 l10,10 m0,-10 l-10,10");
            expect(tpl.circle).toBe("m-10,0 a5,5 0 1,1 10,0 a5,5 0 1,1 -10,0");
        });
    });

    describe("add()/join()", () => {
        it("accumulates symbol instances added via add() and flushes them on join()", () => {
            const el = makeSymbol();
            const tpl = el.template(4, 4);

            el.add(0, 0, tpl.circle);
            el.add(10, 10, tpl.circle);

            expect(el.element.getAttribute("d")).toBeNull();
            el.join();

            expect(el.element.getAttribute("d")).toBe(" M0,0" + tpl.circle + " M10,10" + tpl.circle);
        });
    });

    describe("preserved bug: join() shadows PathElement's own accumulator", () => {
        it("triangle()/rect()/cross()/circle() build path data via the inherited command builder, but join() never flushes it", () => {
            const el = makeSymbol();
            el.triangle(5, 5, 4, 4);

            el.join();

            // PathSymbolElement's own join() override only ever reads/writes `ordersString`
            // (populated only by `.add()`) - the inherited MoveTo/moveTo/lineTo calls made by
            // triangle() went into PathElement's own private `orders` array instead, which this
            // override never looks at. Net effect: the `d` attribute is never actually set.
            expect(el.element.getAttribute("d")).toBeNull();
        });

        it("mixing add() and triangle() only ever writes the add()-sourced data", () => {
            const el = makeSymbol();
            const tpl = el.template(4, 4);

            el.add(1, 1, tpl.rect);
            el.rect(9, 9, 4, 4); // silently discarded, per the bug above
            el.join();

            expect(el.element.getAttribute("d")).toBe(" M1,1" + tpl.rect);
        });
    });
});
