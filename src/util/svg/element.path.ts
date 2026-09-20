// Port of juijs-graph's `src/util/svg/element.path.js` ("util.svg.element.path").
// Extends `element.transform.ts`'s `TransElement` with an SVG `<path d="...">` command builder.

import { TransElement } from "./element.transform";

/**
 * Inlined from `util/base.js`'s `createId()` (the registry singleton this project doesn't port -
 * Phase 0 rule 4), same treatment `dom.ts` already gave its own small `util.base` helper needs.
 */
function createId(key?: string): string {
  return [key || "id", +new Date(), Math.round(Math.random() * 100) % 100].join("-");
}

export class PathElement extends TransElement {
  private orders: string[] = [];

  moveTo(x: number | string, y: number | string, type?: string): this {
    this.orders.push((type || "m") + x + "," + y);
    return this;
  }
  MoveTo(x: number | string, y: number | string): this {
    return this.moveTo(x, y, "M");
  }

  lineTo(x: number | string, y: number | string, type?: string): this {
    this.orders.push((type || "l") + x + "," + y);
    return this;
  }
  LineTo(x: number | string, y: number | string): this {
    return this.lineTo(x, y, "L");
  }

  hLineTo(x: number | string, type?: string): this {
    this.orders.push((type || "h") + x);
    return this;
  }
  HLineTo(x: number | string): this {
    return this.hLineTo(x, "H");
  }

  vLineTo(y: number | string, type?: string): this {
    this.orders.push((type || "v") + y);
    return this;
  }
  VLineTo(y: number | string): this {
    return this.vLineTo(y, "V");
  }

  curveTo(x1: number | string, y1: number | string, x2: number | string, y2: number | string, x: number | string, y: number | string, type?: string): this {
    this.orders.push((type || "c") + x1 + "," + y1 + " " + x2 + "," + y2 + " " + x + "," + y);
    return this;
  }
  CurveTo(x1: number | string, y1: number | string, x2: number | string, y2: number | string, x: number | string, y: number | string): this {
    return this.curveTo(x1, y1, x2, y2, x, y, "C");
  }

  sCurveTo(x2: number | string, y2: number | string, x: number | string, y: number | string, type?: string): this {
    this.orders.push((type || "s") + x2 + "," + y2 + " " + x + "," + y);
    return this;
  }
  SCurveTo(x2: number | string, y2: number | string, x: number | string, y: number | string): this {
    return this.sCurveTo(x2, y2, x, y, "S");
  }

  qCurveTo(x1: number | string, y1: number | string, x: number | string, y: number | string, type?: string): this {
    this.orders.push((type || "q") + x1 + "," + y1 + " " + x + "," + y);
    return this;
  }
  QCurveTo(x1: number | string, y1: number | string, x: number | string, y: number | string): this {
    return this.qCurveTo(x1, y1, x, y, "Q");
  }

  tCurveTo(x1: number | string, y1: number | string, x: number | string, y: number | string, type?: string): this {
    this.orders.push((type || "t") + x1 + "," + y1 + " " + x + "," + y);
    return this;
  }
  TCurveTo(x1: number | string, y1: number | string, x: number | string, y: number | string): this {
    return this.tCurveTo(x1, y1, x, y, "T");
  }

  arc(
    rx: number | string,
    ry: number | string,
    x_axis_rotation: number | string,
    large_arc_flag: unknown,
    sweep_flag: unknown,
    x: number | string,
    y: number | string,
    type?: string
  ): this {
    const largeArcFlag = large_arc_flag ? 1 : 0;
    const sweepFlag = sweep_flag ? 1 : 0;

    this.orders.push((type || "a") + rx + "," + ry + " " + x_axis_rotation + " " + largeArcFlag + "," + sweepFlag + " " + x + "," + y);
    return this;
  }
  Arc(
    rx: number | string,
    ry: number | string,
    x_axis_rotation: number | string,
    large_arc_flag: unknown,
    sweep_flag: unknown,
    x: number | string,
    y: number | string
  ): this {
    return this.arc(rx, ry, x_axis_rotation, large_arc_flag, sweep_flag, x, y, "A");
  }

  closePath(type?: string): this {
    this.orders.push(type || "z");
    return this;
  }
  ClosePath(): this {
    return this.closePath("Z");
  }

  /** Flushes the accumulated path commands into the `d` attribute and clears the buffer. */
  join(): void {
    if (this.orders.length > 0) {
      this.attr({ d: this.orders.join(" ") });
      this.orders = [];
    }
  }

  /**
   * Computes the rendered path's total length via a throwaway, temporarily-DOM-attached
   * `<svg><path/></svg>`.
   *
   * **Preserved bug**: the wrapper is created with `document.createElement("svg")` - i.e.
   * plain HTML-namespace element creation, NOT `document.createElementNS(SVG_NS, "svg")` - so
   * it is not really a conforming `SVGSVGElement`. The inner `<path>` node itself IS created
   * correctly via `createElementNS`. Left exactly as-is (not "fixed" to use the namespaced
   * constructor) per Phase 0's preserve-bugs rule.
   *
   * Note: this method is effectively untestable under jsdom - jsdom does not implement
   * `SVGGeometryElement.getTotalLength()` (a real-renderer-only API), so any test exercising it
   * can only assert that it throws/behaves the way jsdom's stub does, not a real numeric length.
   */
  length(): number {
    const id = createId();
    const d = this.orders.join(" ");

    const svg = document.createElement("svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    path.setAttributeNS(null, "id", id);
    path.setAttributeNS(null, "d", d);
    svg.appendChild(path);

    document.body.appendChild(svg);
    const length = (document.getElementById(id) as unknown as SVGPathElement).getTotalLength();
    document.body.removeChild(svg);

    return length;
  }
}
