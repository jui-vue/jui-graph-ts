import { describe, it, expect } from "vitest";
import { PathRectElement } from "./element.path.rect";

function makePathRect(): PathRectElement {
    const el = new PathRectElement();
    el.create("path");
    return el;
}

describe("PathRectElement", () => {
    it("round() builds and immediately joins a rounded-rect path", () => {
        const el = makePathRect();
        el.round(20, 10, 2, 3, 4, 5);

        // Hand-traced against the original's exact command sequence.
        expect(el.element.getAttribute("d")).toBe("M0,2 A2,2 0 0,1 2,0 H17 A3,3 0 0,1 20,3 V6 A4,4 0 0,1 16,10 H5 A5,5 0 0,1 0,5 Z");
    });

    it("normalizes falsy radii (including omitted args) to 0", () => {
        const el = makePathRect();
        el.round(20, 10);

        expect(el.element.getAttribute("d")).toBe("M0,0 A0,0 0 0,1 0,0 H20 A0,0 0 0,1 20,0 V10 A0,0 0 0,1 20,10 H0 A0,0 0 0,1 0,10 Z");
    });
});
