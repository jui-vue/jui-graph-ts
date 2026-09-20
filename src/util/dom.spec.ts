import { describe, it, expect, beforeEach } from "vitest";
import * as dom from "./dom";

describe("dom module", () => {
    beforeEach(() => {
        // Setup DOM for testing
        document.body.innerHTML = `
            <div id="container">
                <div class="item" data-id="1">Item 1</div>
                <div class="item" data-id="2">Item 2</div>
                <div class="item" data-id="3">Item 3</div>
            </div>
        `;
    });

    describe("find()", () => {
        it("should find elements by selector", () => {
            const result = dom.find(".item");
            expect(result.length).toBe(3);
        });

        it("should return empty NodeList for no matches", () => {
            const result = dom.find(".nonexistent");
            expect(result.length).toBe(0);
        });

        it("should find elements within a parent element", () => {
            const container = document.getElementById("container") as Element;
            const result = dom.find(container, ".item");
            expect(result.length).toBe(3);
        });

        it("should handle single selector string", () => {
            const result = dom.find("#container");
            expect(result.length).toBe(1);
        });

        it("should find nested elements", () => {
            const result = dom.find("div div");
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe("each()", () => {
        it("should iterate over elements by selector", () => {
            const indices: number[] = [];
            dom.each(".item", function (_index: number) {
                indices.push(_index);
            });
            expect(indices).toEqual([0, 1, 2]);
        });

        it("should pass element to callback", () => {
            const elements: string[] = [];
            dom.each(".item", function (_index, el) {
                elements.push(el.textContent || "");
            });
            expect(elements).toEqual(["Item 1", "Item 2", "Item 3"]);
        });

        it("should iterate over NodeList", () => {
            const items = document.querySelectorAll(".item");
            const count = { value: 0 };
            dom.each(items, function () {
                count.value++;
            });
            expect(count.value).toBe(3);
        });

        it("should iterate over array of elements", () => {
            const items = Array.from(document.querySelectorAll(".item"));
            const count = { value: 0 };
            dom.each(items, function () {
                count.value++;
            });
            expect(count.value).toBe(3);
        });

        it("should not iterate if callback is not a function", () => {
            const count = { value: 0 };
            const callback = "not a function" as any;
            dom.each(".item", callback);
            expect(count.value).toBe(0);
        });

        it("should set 'this' context to the element", () => {
            let thisElement: Element | null = null;
            dom.each(".item", function (this: Element) {
                thisElement = this;
            });
            expect((thisElement as any)?.className).toBe("item");
        });
    });

    describe("attr()", () => {
        it("should get attribute value", () => {
            const value = dom.attr(".item", "data-id");
            expect(value).toBe("1"); // gets first match
        });

        it("should return undefined for missing attribute", () => {
            const value = dom.attr(".item", "nonexistent");
            expect(value).toBeUndefined();
        });

        it("should set single attribute on all matching elements", () => {
            dom.attr(".item", { "data-modified": "true" });
            const items = document.querySelectorAll(".item");
            items.forEach((item) => {
                expect(item.getAttribute("data-modified")).toBe("true");
            });
        });

        it("should set multiple attributes", () => {
            dom.attr(".item", { "data-x": "10", "data-y": "20" });
            const firstItem = document.querySelector(".item");
            expect(firstItem?.getAttribute("data-x")).toBe("10");
            expect(firstItem?.getAttribute("data-y")).toBe("20");
        });

        it("should get first matching element's attribute", () => {
            const value = dom.attr(".item", "data-id");
            expect(value).toBe("1");
        });

        it("should handle class attribute", () => {
            dom.attr("#container", { class: "new-class" });
            const container = document.getElementById("container");
            expect(container?.getAttribute("class")).toBe("new-class");
        });
    });

    describe("remove()", () => {
        it("should remove elements by selector", () => {
            expect(document.querySelectorAll(".item").length).toBe(3);
            dom.remove(".item");
            expect(document.querySelectorAll(".item").length).toBe(0);
        });

        it("should remove from parent", () => {
            const container = document.getElementById("container");
            expect(container?.children.length).toBe(3);
            dom.remove(".item");
            expect(container?.children.length).toBe(0);
        });

        it("should remove elements from array", () => {
            const items = Array.from(document.querySelectorAll(".item"));
            dom.remove(items);
            expect(document.querySelectorAll(".item").length).toBe(0);
        });

        it("should handle removing from NodeList", () => {
            const items = document.querySelectorAll(".item");
            dom.remove(items as any);
            expect(document.querySelectorAll(".item").length).toBe(0);
        });
    });

    describe("offset()", () => {
        it("should return offset object with top and left", () => {
            const element = document.getElementById("container") as Element;
            const offset = dom.offset(element);
            expect(offset).toBeDefined();
            expect(offset?.top).toBeDefined();
            expect(offset?.left).toBeDefined();
            expect(typeof offset?.top).toBe("number");
            expect(typeof offset?.left).toBe("number");
        });

        it("should return undefined for missing element", () => {
            const offset = dom.offset(null as any);
            expect(offset).toBeUndefined();
        });

        it("should calculate offset correctly for positioned elements", () => {
            const element = document.getElementById("container") as Element;
            const offset = dom.offset(element);
            expect(offset).toBeDefined();
            // offset should be numeric values
            expect(offset!.top).toBeGreaterThanOrEqual(0);
            expect(offset!.left).toBeGreaterThanOrEqual(0);
        });

        it("should handle elements without getBoundingClientRect gracefully", () => {
            const element = document.getElementById("container") as Element;
            const originalBCR = (element as any).getBoundingClientRect;
            (element as any).getBoundingClientRect = null;

            const offset = dom.offset(element);
            expect(offset).toBeDefined();
            expect(offset?.top).toBe(0);
            expect(offset?.left).toBe(0);

            (element as any).getBoundingClientRect = originalBCR;
        });

        it("should include scroll offset", () => {
            const element = document.getElementById("container") as Element;
            const offset = dom.offset(element);
            expect(offset).toBeDefined();
            // offset should include current scroll position
            expect(offset!.top).toBeGreaterThanOrEqual(0);
            expect(offset!.left).toBeGreaterThanOrEqual(0);
        });
    });

    describe("type checking", () => {
        it("should handle type mismatches gracefully", () => {
            // find should return empty with invalid arguments
            const result = dom.find(123 as any, 456 as any);
            expect(result.length).toBe(0);
        });

        it("should only set attributes when second argument is object", () => {
            // should not set when second argument is not object or string
            const beforeHTML = document.body.innerHTML;
            dom.attr(".item", 123 as any);
            // HTML should be unchanged
            expect(document.body.innerHTML).toBe(beforeHTML);
        });

        it("each should handle invalid selector types", () => {
            let called = false;
            dom.each(123 as any, () => {
                called = true;
            });
            expect(called).toBeFalsy();
        });
    });

    describe("integration", () => {
        it("should chain operations", () => {
            dom.attr(".item", { "data-processed": "true" });
            expect(dom.attr(".item", "data-processed")).toBe("true");

            dom.each(".item", function () {
                expect(this.getAttribute("data-processed")).toBe("true");
            });
        });

        it("should modify and query elements", () => {
            // Add attributes
            dom.attr(".item", { "data-test": "123" });

            // Query them back
            expect(dom.attr(".item", "data-test")).toBe("123");

            // Iterate to verify
            dom.each(".item", function () {
                expect(this.getAttribute("data-test")).toBe("123");
            });
        });

        it("should find and remove elements", () => {
            const initialCount = dom.find(".item").length;
            expect(initialCount).toBe(3);

            dom.remove([document.querySelector(".item") as Element]);
            expect(dom.find(".item").length).toBe(2);
        });
    });
});
