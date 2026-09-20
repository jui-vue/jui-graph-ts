import { describe, it, expect } from "vitest";
import { PolyElement } from "./element.poly";

function makePoly(type = "polygon"): PolyElement {
    const el = new PolyElement();
    el.create(type);
    return el;
}

describe("PolyElement", () => {
    it("join() writes accumulated points, repeating the first point at the end", () => {
        const el = makePoly();
        el.point(0, 0).point(10, 0).point(10, 10);

        expect(el.element.getAttribute("points")).toBeNull();

        el.join();

        // "Firefox 처리" (Firefox handling) in the original - closes the shape by repeating the
        // first point.
        expect(el.element.getAttribute("points")).toBe("0,0 10,0 10,10 0,0");
    });

    it("join() is a no-op when there are no accumulated points", () => {
        const el = makePoly();
        el.attr({ points: "sentinel" });
        el.join();
        expect(el.element.getAttribute("points")).toBe("sentinel");
    });

    it("join() clears the buffer, so calling it twice in a row only writes once", () => {
        const el = makePoly();
        el.point(1, 1).point(2, 2);
        el.join();
        expect(el.element.getAttribute("points")).toBe("1,1 2,2 1,1");

        el.attr({ points: "sentinel" });
        el.join();
        expect(el.element.getAttribute("points")).toBe("sentinel");
    });

    it("supports transform inheritance from TransElement", () => {
        const el = makePoly("polyline");
        el.translate(3, 4);
        expect(el.element.getAttribute("transform")).toBe("translate(3,4)");
    });
});
