/**
 * DOM utility module - ported from jui-graph's util/dom.js
 * Provides DOM query, manipulation, and utility functions
 *
 * NOT reconciled with jui-core-ts's own `src/utils/dom.ts` (see this project's PORT_STATUS.md
 * "jui-core-ts reconciliation" entry): this file's local `typeCheck`-gated `find`/`attr`/`each`
 * gracefully degrade on malformed input (e.g. `find(123, 456)` returns an empty NodeList - see
 * dom.spec.ts's "type checking" suite), a defensive behavior jui-core-ts's own dom.ts doesn't
 * replicate (it would throw instead). Reconciling would need to either weaken this file's
 * validation or strengthen jui-core-ts's, so it was left local rather than risk silently changing
 * this project's tested error-handling behavior for the modest gain of de-duplicating ~150 lines.
 */

/**
 * Helper type for checking types
 */
type TypeCheckable = string | number | boolean | symbol | object | null | undefined | Function;

/**
 * Check if a value matches a type specification
 * @param type - type to check (can be string or array of strings)
 * @param value - value to check
 * @returns boolean - true if value matches the type
 */
function typeCheck(type: string | string[], value: TypeCheckable): boolean {
    function check(t: string, v: TypeCheckable): boolean {
        if (typeof t !== "string") return false;

        if (t === "string") {
            return typeof v === "string";
        } else if (t === "integer") {
            return typeof v === "number" && v % 1 === 0;
        } else if (t === "float") {
            return typeof v === "number" && v % 1 !== 0;
        } else if (t === "number") {
            return typeof v === "number";
        } else if (t === "boolean") {
            return typeof v === "boolean";
        } else if (t === "undefined") {
            return typeof v === "undefined";
        } else if (t === "null") {
            return v === null;
        } else if (t === "array") {
            return v instanceof Array;
        } else if (t === "date") {
            return v instanceof Date;
        } else if (t === "function") {
            return typeof v === "function";
        } else if (t === "object") {
            // typeCheck에 정의된 타입일 경우에는 object 체크시 false를 반환 (date, array, null)
            return (
                typeof v === "object" &&
                v !== null &&
                !(v instanceof Array) &&
                !(v instanceof Date) &&
                !(v instanceof RegExp)
            );
        }

        return false;
    }

    if (typeof type === "object" && Array.isArray(type)) {
        const typeList = type;

        for (let i = 0; i < typeList.length; i++) {
            if (check(typeList[i], value)) return true;
        }

        return false;
    } else {
        return check(type as string, value);
    }
}

/**
 * Find DOM elements matching a selector
 * Can take either a selector string or an element + selector pair
 *
 * @param args - either (selector: string) or (element, selector: string)
 * @returns - NodeListOf<Element> matching the selector
 */
export function find(...args: any[]): NodeListOf<Element> {
    if (args.length === 1) {
        if (typeCheck("string", args[0])) {
            return document.querySelectorAll(args[0]);
        }
    } else if (args.length === 2) {
        if (
            typeCheck("object", args[0]) &&
            typeCheck("string", args[1])
        ) {
            return (args[0] as Element).querySelectorAll(args[1]);
        }
    }

    // Return empty NodeList for invalid inputs
    const emptyDiv = document.createElement("div");
    return emptyDiv.querySelectorAll("*");
}

/**
 * Iterate over DOM elements and call a callback for each
 *
 * @param selectorOrElements - CSS selector string or array/NodeList of elements
 * @param callback - function to call for each element, receives (index, element)
 */
export function each(
    selectorOrElements: string | Element[] | NodeListOf<Element>,
    callback: (this: Element, index: number, el: Element) => void
): void {
    if (!typeCheck("function", callback)) return;

    let elements: Element[] | NodeListOf<Element> | null = null;

    if (typeCheck("string", selectorOrElements)) {
        elements = document.querySelectorAll(selectorOrElements as string);
    } else if (typeCheck("array", selectorOrElements)) {
        elements = selectorOrElements as Element[];
    } else if ((selectorOrElements as any) instanceof NodeList || (selectorOrElements as any)?.length !== undefined) {
        elements = selectorOrElements as NodeListOf<Element>;
    }

    if (elements != null) {
        Array.prototype.forEach.call(elements, function (el: Element, i: number) {
            callback.call(el, i, el);
        });
    }
}

/**
 * Get or set attributes on DOM elements
 *
 * @param selectorOrElements - CSS selector string or array of elements
 * @param keyOrAttributes - attribute name (string) to get, or object of key-value pairs to set
 * @returns - attribute value if getting a single attribute
 */
export function attr(
    selectorOrElements: string | Element[],
    keyOrAttributes: string | Record<string, any>
): string | undefined {
    if (!typeCheck(["string", "array"], selectorOrElements)) return;

    const elements = document.querySelectorAll(selectorOrElements as string);

    if (typeCheck("object", keyOrAttributes)) {
        // set attributes
        const attrs = keyOrAttributes as Record<string, any>;
        for (let i = 0; i < elements.length; i++) {
            for (const key in attrs) {
                elements[i].setAttribute(key, attrs[key]);
            }
        }
    } else if (typeCheck("string", keyOrAttributes)) {
        // get attribute
        if (elements.length > 0) {
            return elements[0].getAttribute(keyOrAttributes as string) || undefined;
        }
    }
}

/**
 * Remove DOM elements from the document
 *
 * @param selectorOrElements - CSS selector string or array of elements
 */
export function remove(selectorOrElements: string | Element[] | NodeListOf<Element>): void {
    let elements: Element[] | NodeListOf<Element> | null = null;

    if (typeCheck("string", selectorOrElements)) {
        elements = document.querySelectorAll(selectorOrElements as string);
    } else if (typeCheck("array", selectorOrElements)) {
        elements = selectorOrElements as Element[];
    } else if ((selectorOrElements as any) instanceof NodeList) {
        elements = selectorOrElements as NodeListOf<Element>;
    }

    if (elements != null) {
        Array.prototype.forEach.call(elements, function (el: Element) {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
    }
}

/**
 * Get the offset position of an element relative to the document
 * Returns top and left properties
 *
 * @param elem - element to measure
 * @returns - object with top and left properties
 */
export function offset(elem: Element): { top: number; left: number } | undefined {
    function isWindow(obj: any): obj is Window {
        /* eslint-disable-next-line eqeqeq */
        return obj != null && obj == obj.window;
    }

    function getWindow(elem: Element | Document): Window | false {
        if (isWindow(elem as any)) {
            return elem as unknown as Window;
        } else if (elem.nodeType === 9) {
            return (elem as unknown as Document).defaultView || false;
        }
        return false;
    }

    let docElem: Element | null;
    let win: Window | false;
    const box = { top: 0, left: 0 };
    const doc = elem && elem.ownerDocument;

    if (!doc) {
        return;
    }

    docElem = doc.documentElement;

    // If we don't have gBCR, just use 0,0 rather than error
    // BlackBerry 5, iOS 3 (original iPhone)
    const strundefined = typeof undefined;
    let elementBox: DOMRect = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
    if (typeof (elem as any).getBoundingClientRect !== strundefined && (elem as any).getBoundingClientRect !== null) {
        try {
            elementBox = (elem as any).getBoundingClientRect();
        } catch (e) {
            // ignore errors from getBoundingClientRect
        }
    }
    win = getWindow(doc);

    if (!win) {
        return box;
    }

    return {
        top:
            elementBox.top +
            (win.pageYOffset || docElem!.scrollTop) -
            (docElem!.clientTop || 0),
        left:
            elementBox.left +
            (win.pageXOffset || docElem!.scrollLeft) -
            (docElem!.clientLeft || 0),
    };
}
