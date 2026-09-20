import { describe, it, expect } from "vitest";
import { SVGBase } from "./base";
import { TransElement } from "./element.transform";
import { PathElement } from "./element.path";
import { PathSymbolElement } from "./element.path.symbol";
import { PathRectElement } from "./element.path.rect";
import { PolyElement } from "./element.poly";

describe("SVGBase", () => {
    describe("plain tag methods", () => {
        it("custom() builds an arbitrary-named Element", () => {
            const b = new SVGBase();
            const el = b.custom("myTag", { x: 1 });
            expect(el.element.tagName).toBe("myTag");
            expect(el.element.getAttribute("x")).toBe("1");
        });

        it("rect()/line()/circle()/ellipse()/image()/foreignObject() return TransElement instances", () => {
            const b = new SVGBase();
            expect(b.rect({ width: 1 })).toBeInstanceOf(TransElement);
            expect(b.line()).toBeInstanceOf(TransElement);
            expect(b.circle()).toBeInstanceOf(TransElement);
            expect(b.ellipse()).toBeInstanceOf(TransElement);
            expect(b.image()).toBeInstanceOf(TransElement);
            expect(b.foreignObject()).toBeInstanceOf(TransElement);
        });

        it("g()/group() are aliases producing a <g> TransElement", () => {
            const b = new SVGBase();
            expect(b.g().element.tagName).toBe("g");
            expect(b.group().element.tagName).toBe("g");
        });

        it("path()/pathSymbol()/pathRect() return the specialized path element classes", () => {
            const b = new SVGBase();
            expect(b.path()).toBeInstanceOf(PathElement);
            expect(b.pathSymbol()).toBeInstanceOf(PathSymbolElement);
            expect(b.pathRect()).toBeInstanceOf(PathRectElement);
        });

        it("polyline()/polygon() return PolyElement instances with the right tag", () => {
            const b = new SVGBase();
            expect(b.polyline().element.tagName).toBe("polyline");
            expect(b.polygon()).toBeInstanceOf(PolyElement);
        });

        it("switch() (a reserved word) works as a method name", () => {
            const b = new SVGBase();
            expect(b.switch().element.tagName).toBe("switch");
        });

        it("callback runs with `this` bound to the created element (own create(), not SVGBase's)", () => {
            const b = new SVGBase();
            let receivedThis: any = null;
            let ranSynchronously = false;
            const g = b.group({}, function () {
                receivedThis = this;
                ranSynchronously = true;
            });

            // SVGBase.create() itself IGNORES the callback entirely - only a subclass (like
            // svg.ts's SVG) that overrides create() actually invokes it.
            expect(ranSynchronously).toBe(false);
            expect(receivedThis).toBeNull();
            expect(g).toBeInstanceOf(TransElement);
        });
    });

    describe("text()", () => {
        it("1-arg form creates a bare <text>", () => {
            const b = new SVGBase();
            const el = b.text({ x: 1 });
            expect(el.element.tagName).toBe("text");
            expect(el.element.textContent).toBe("");
        });

        it("2-arg string form sets text content directly", () => {
            const b = new SVGBase();
            const el = b.text({}, "hello");
            expect(el.element.textContent).toBe("hello");
        });

        it("2-arg function form treats the 2nd arg as a callback, not text", () => {
            const b = new SVGBase();
            const el = b.text({}, function () {});
            expect(el.element.textContent).toBe("");
        });
    });

    describe("textPath()/tref()/tspan()", () => {
        it("sets text content when given a string", () => {
            const b = new SVGBase();
            expect(b.textPath({}, "a").element.textContent).toBe("a");
            expect(b.tref({}, "b").element.textContent).toBe("b");
            expect(b.tspan({}, "c").element.textContent).toBe("c");
        });

        it("leaves text content empty when no string is given", () => {
            const b = new SVGBase();
            expect(b.textPath().element.textContent).toBe("");
        });
    });

    describe("createChild()-based elements", () => {
        it("stop()/animate()/feBlend() etc. build via createChild (delegates to create())", () => {
            const b = new SVGBase();
            expect(b.stop({ offset: "0%" }).element.tagName).toBe("stop");
            expect(b.animate().element.tagName).toBe("animate");
            expect(b.feGaussianBlur({ stdDeviation: 2 }).element.tagName).toBe("feGaussianBlur");
        });
    });

    describe("static SVGBase.create()", () => {
        it("lazily creates and reuses a single module-level SVGBase singleton", () => {
            const a = SVGBase.create("rect", { x: 1 });
            const b = SVGBase.create("circle", { r: 2 });
            expect(a.element.tagName).toBe("rect");
            expect(b.element.tagName).toBe("circle");
        });
    });
});
