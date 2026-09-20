import { describe, it, expect } from "vitest";
import { PathElement } from "./element.path";

function makePath(): PathElement {
    const el = new PathElement();
    el.create("path");
    return el;
}

describe("PathElement", () => {
    it("builds a command string and joins it into the `d` attribute", () => {
        const el = makePath();
        el.MoveTo(0, 0).LineTo(10, 0).LineTo(10, 10).ClosePath();
        expect(el.element.getAttribute("d")).toBeNull();

        el.join();

        expect(el.element.getAttribute("d")).toBe("M0,0 L10,0 L10,10 Z");
    });

    it("join() clears the buffer, so a second join() with no new commands is a no-op", () => {
        const el = makePath();
        el.MoveTo(0, 0).join();
        expect(el.element.getAttribute("d")).toBe("M0,0");

        el.attr({ d: "sentinel" });
        el.join();
        expect(el.element.getAttribute("d")).toBe("sentinel");
    });

    it("lowercase relative variants use the lowercase command letters", () => {
        const el = makePath();
        el.moveTo(1, 1).lineTo(2, 2).hLineTo(5).vLineTo(6).join();
        expect(el.element.getAttribute("d")).toBe("m1,1 l2,2 h5 v6");
    });

    it("curve commands", () => {
        const el = makePath();
        el.MoveTo(0, 0)
            .CurveTo(1, 1, 2, 2, 3, 3)
            .SCurveTo(4, 4, 5, 5)
            .QCurveTo(6, 6, 7, 7)
            .TCurveTo(8, 8, 9, 9)
            .join();
        expect(el.element.getAttribute("d")).toBe("M0,0 C1,1 2,2 3,3 S4,4 5,5 Q6,6 7,7 T8,8 9,9");
    });

    it("Arc() normalizes flags to 0/1", () => {
        const el = makePath();
        el.MoveTo(0, 0).Arc(5, 5, 0, true, false, 10, 10).join();
        expect(el.element.getAttribute("d")).toBe("M0,0 A5,5 0 1,0 10,10");
    });

    it("length(): jsdom does not implement SVGGeometryElement.getTotalLength() at all", () => {
        // Real browsers: getTotalLength() returns a real numeric path length. jsdom has no
        // rendering engine and doesn't even expose the method (not just a stub returning 0), so
        // this port's `length()` throws a TypeError under jsdom - "not implemented", not a
        // meaningful assertion about the ported logic itself (the temporary <svg><path>
        // construction/attach/detach dance leading up to the call is exercised correctly; only
        // the final unimplemented DOM API call fails). Documented rather than worked around.
        const el = makePath();
        el.MoveTo(0, 0).LineTo(10, 0);
        expect(() => el.length()).toThrow(TypeError);
    });
});
