// Port of juijs-graph's `src/util/svg/base.js` ("util.svg.base").
//
// The tag-builder base class: one method per SVG element tag, each just a thin wrapper around
// `this.create(new <ElementClass>(), "<tag>", attr, callback)`. Ported per Phase 0 rule 2 as a
// real class so that `this.create`/`this.createChild` calls dynamically dispatch to whatever a
// subclass (`base3d.ts`'s `SVG3d`, `svg.ts`'s `SVG`) overrides them with - exactly like the
// original relied on (its own `component()` doc comment lists `util.svg.element*` as
// `@requires`). `SVG.ts`'s `create`/`createChild` overrides are what make e.g. `svg.rect(...)`
// actually attach into the right parent group instead of just constructing a detached element.

import { Element } from "./element";
import { TransElement } from "./element.transform";
import { PathElement } from "./element.path";
import { PathSymbolElement } from "./element.path.symbol";
import { PathRectElement } from "./element.path.rect";
import { PolyElement } from "./element.poly";

type Attr = Record<string, any> | null | undefined;

export class SVGBase {
  private static globalObj: SVGBase | null = null;

  /**
   * `create`/`createChild` here are the "no-op glue" version: just calls `obj.create(type, attr)`
   * and returns `obj`, ignoring `callback` entirely (deliberately - it exists purely as an
   * override point; `svg.ts`'s `SVG.create()` is the one that actually invokes it).
   */
  create<T extends Element>(obj: T, type: string, attr?: Attr, _callback?: (this: T) => void): T {
    obj.create(type, attr);
    return obj;
  }

  createChild<T extends Element>(obj: T, type: string, attr?: Attr, callback?: (this: T) => void): T {
    return this.create(obj, type, attr, callback);
  }

  custom(name: string, attr?: Attr, callback?: (this: Element) => void): Element {
    return this.create(new Element(), name, attr, callback);
  }

  defs(callback?: (this: Element) => void): Element {
    return this.create(new Element(), "defs", null, callback);
  }

  symbol(attr?: Attr, callback?: (this: Element) => void): Element {
    return this.create(new Element(), "symbol", attr, callback);
  }

  group(attr?: Attr, callback?: (this: TransElement) => void): TransElement {
    return this.create(new TransElement(), "g", attr, callback);
  }
  /** @alias group */
  g(attr?: Attr, callback?: (this: TransElement) => void): TransElement {
    return this.group(attr, callback);
  }

  marker(attr?: Attr, callback?: (this: Element) => void): Element {
    return this.create(new Element(), "marker", attr, callback);
  }

  a(attr?: Attr, callback?: (this: TransElement) => void): TransElement {
    return this.create(new TransElement(), "a", attr, callback);
  }

  switch(attr?: Attr, callback?: (this: Element) => void): Element {
    return this.create(new Element(), "switch", attr, callback);
  }

  use(attr?: Attr): Element {
    return this.create(new Element(), "use", attr);
  }

  rect(attr?: Attr, callback?: (this: TransElement) => void): TransElement {
    return this.create(new TransElement(), "rect", attr, callback);
  }

  line(attr?: Attr, callback?: (this: TransElement) => void): TransElement {
    return this.create(new TransElement(), "line", attr, callback);
  }

  circle(attr?: Attr, callback?: (this: TransElement) => void): TransElement {
    return this.create(new TransElement(), "circle", attr, callback);
  }

  /**
   * `text(attr)`, `text(attr, callback)`, or `text(attr, "literal text")` - dispatches on
   * `arguments.length` (2 args at all, even `undefined`) then on whether the 2nd arg is a
   * function, exactly like the original.
   */
  text(attr?: Attr, textOrCallback?: ((this: TransElement) => void) | string): TransElement {
    if (arguments.length === 2) {
      if (typeof textOrCallback === "function") {
        return this.create(new TransElement(), "text", attr, textOrCallback);
      }

      return this.create(new TransElement(), "text", attr).text(textOrCallback as string);
    }

    return this.create(new TransElement(), "text", attr);
  }

  textPath(attr?: Attr, text?: string): Element {
    if (typeof text === "string") {
      return this.create(new Element(), "textPath", attr).text(text);
    }

    return this.create(new Element(), "textPath", attr);
  }

  tref(attr?: Attr, text?: string): Element {
    if (typeof text === "string") {
      return this.create(new Element(), "tref", attr).text(text);
    }

    return this.create(new Element(), "tref", attr);
  }

  tspan(attr?: Attr, text?: string): Element {
    if (typeof text === "string") {
      return this.create(new Element(), "tspan", attr).text(text);
    }

    return this.create(new Element(), "tspan", attr);
  }

  ellipse(attr?: Attr, callback?: (this: TransElement) => void): TransElement {
    return this.create(new TransElement(), "ellipse", attr, callback);
  }

  image(attr?: Attr, callback?: (this: TransElement) => void): TransElement {
    return this.create(new TransElement(), "image", attr, callback);
  }

  path(attr?: Attr, callback?: (this: PathElement) => void): PathElement {
    return this.create(new PathElement(), "path", attr, callback);
  }

  pathSymbol(attr?: Attr, callback?: (this: PathSymbolElement) => void): PathSymbolElement {
    return this.create(new PathSymbolElement(), "path", attr, callback);
  }

  pathRect(attr?: Attr, callback?: (this: PathRectElement) => void): PathRectElement {
    return this.create(new PathRectElement(), "path", attr, callback);
  }

  polyline(attr?: Attr, callback?: (this: PolyElement) => void): PolyElement {
    return this.create(new PolyElement(), "polyline", attr, callback);
  }

  polygon(attr?: Attr, callback?: (this: PolyElement) => void): PolyElement {
    return this.create(new PolyElement(), "polygon", attr, callback);
  }

  pattern(attr?: Attr, callback?: (this: Element) => void): Element {
    return this.create(new Element(), "pattern", attr, callback);
  }

  mask(attr?: Attr, callback?: (this: Element) => void): Element {
    return this.create(new Element(), "mask", attr, callback);
  }

  clipPath(attr?: Attr, callback?: (this: Element) => void): Element {
    return this.create(new Element(), "clipPath", attr, callback);
  }

  linearGradient(attr?: Attr, callback?: (this: Element) => void): Element {
    return this.create(new Element(), "linearGradient", attr, callback);
  }

  radialGradient(attr?: Attr, callback?: (this: Element) => void): Element {
    return this.create(new Element(), "radialGradient", attr, callback);
  }

  filter(attr?: Attr, callback?: (this: Element) => void): Element {
    return this.create(new Element(), "filter", attr, callback);
  }

  foreignObject(attr?: Attr, callback?: (this: TransElement) => void): TransElement {
    return this.create(new TransElement(), "foreignObject", attr, callback);
  }

  // Gradient stop element.

  stop(attr?: Attr): Element {
    return this.createChild(new Element(), "stop", attr);
  }

  // Animation elements.

  animate(attr?: Attr): Element {
    return this.createChild(new Element(), "animate", attr);
  }

  animateColor(attr?: Attr): Element {
    return this.createChild(new Element(), "animateColor", attr);
  }

  animateMotion(attr?: Attr): Element {
    return this.createChild(new Element(), "animateMotion", attr);
  }

  animateTransform(attr?: Attr): Element {
    return this.createChild(new Element(), "animateTransform", attr);
  }

  mpath(attr?: Attr): Element {
    return this.createChild(new Element(), "mpath", attr);
  }

  set(attr?: Attr): Element {
    return this.createChild(new Element(), "set", attr);
  }

  // Filter primitive elements.

  feBlend(attr?: Attr): Element {
    return this.createChild(new Element(), "feBlend", attr);
  }

  feColorMatrix(attr?: Attr): Element {
    return this.createChild(new Element(), "feColorMatrix", attr);
  }

  feComponentTransfer(attr?: Attr): Element {
    return this.createChild(new Element(), "feComponentTransfer", attr);
  }

  feComposite(attr?: Attr): Element {
    return this.createChild(new Element(), "feComposite", attr);
  }

  feConvolveMatrix(attr?: Attr): Element {
    return this.createChild(new Element(), "feConvolveMatrix", attr);
  }

  feDiffuseLighting(attr?: Attr): Element {
    return this.createChild(new Element(), "feDiffuseLighting", attr);
  }

  feDisplacementMap(attr?: Attr): Element {
    return this.createChild(new Element(), "feDisplacementMap", attr);
  }

  feFlood(attr?: Attr): Element {
    return this.createChild(new Element(), "feFlood", attr);
  }

  feGaussianBlur(attr?: Attr): Element {
    return this.createChild(new Element(), "feGaussianBlur", attr);
  }

  feImage(attr?: Attr): Element {
    return this.createChild(new Element(), "feImage", attr);
  }

  feMerge(attr?: Attr, callback?: (this: Element) => void): Element {
    return this.createChild(new Element(), "feMerge", attr, callback);
  }

  feMergeNode(attr?: Attr): Element {
    return this.createChild(new Element(), "feMergeNode", attr);
  }

  feMorphology(attr?: Attr): Element {
    return this.createChild(new Element(), "feMorphology", attr);
  }

  feOffset(attr?: Attr): Element {
    return this.createChild(new Element(), "feOffset", attr);
  }

  feSpecularLighting(attr?: Attr): Element {
    return this.createChild(new Element(), "feSpecularLighting", attr);
  }

  feTile(attr?: Attr): Element {
    return this.createChild(new Element(), "feTile", attr);
  }

  feTurbulence(attr?: Attr): Element {
    return this.createChild(new Element(), "feTurbulence", attr);
  }

  /** Lazily-created module-singleton entry point, mirroring the original's `SVGBase.create()` static. */
  static create(name: string, attr?: Attr, callback?: (this: Element) => void): Element {
    if (SVGBase.globalObj == null) {
      SVGBase.globalObj = new SVGBase();
    }

    return SVGBase.globalObj.custom(name, attr, callback);
  }
}
