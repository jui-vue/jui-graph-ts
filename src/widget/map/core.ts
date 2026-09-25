// Port of juijs-graph's `src/widget/map/core.js` ("chart.widget.map.core",
// extend: "chart.widget.core").
//
// ============================================================================================
// REAL SURFACE - the whole original file, verbatim:
//
//   export default {
//       name: "chart.widget.map.core",
//       extend: "chart.widget.core",
//       component: function () {
//           var MapCoreWidget = function(chart, axis, widget) {
//           }
//
//           MapCoreWidget.setup = function() {
//               return {
//                   axis: 0
//               }
//           }
//
//           return MapCoreWidget;
//       }
//   }
//
// ============================================================================================
// CROSS-CHECK AGAINST jui-chart-vue's `PORT_STATUS.md` FINDING FOR THIS FILE (this task's own
// specific verification assignment) - jui-chart-vue documented `widget/map/core.js` as "an empty
// extension-point stub with zero concrete subclasses anywhere public, same category as
// `brush/map/core.js`". **CONFIRMED, against the real source read in full above - not a
// correction, with one precision added below.**
//
// - **Zero concrete subclasses anywhere public**: confirmed via `grep -rn "widget.map.core"`
//   across the ENTIRE `/home/search5/cl/jui-graph/src` tree - the only hit besides this file's own
//   `name:` field is `main.js`'s registration import. No `chart.widget.map.*` leaf class (the
//   `chart.widget.polygon.*` family's `rotate3d.js` counterpart) exists anywhere in the real
//   engine's source. Same as `brush/map/core.ts`'s already-documented finding for the sibling
//   `chart.brush.map.core` stub.
// - **"Empty extension-point stub" - true, but with a real precision this task's own assignment
//   asked for**: unlike `widget/canvas/core.js`/`widget/polygon/core.js` (both a genuine
//   `drawAfter` override, even if empty-bodied - see those two files), `MapCoreWidget` overrides
//   **NOTHING** from `CoreWidget` except the static `setup()` factory. It doesn't even redeclare
//   `drawAfter` - a hypothetical `chart.widget.map.*` leaf subclass would inherit `CoreWidget`'s
//   REAL `drawAfter` (the `widget-<type>` CSS class stamp), unlike a hypothetical canvas/polygon
//   leaf subclass, which would inherit the no-op instead. So "empty stub" is accurate for the
//   CONSTRUCTOR (see below) but not for the class's overall behavior surface, which is actually
//   MORE inherited-from-`CoreWidget` than the canvas/polygon siblings are.
//
// ============================================================================================
// THE CONSTRUCTOR - genuinely different shape from `CanvasCoreWidget`/`PolygonCoreWidget`, and
// from `CoreWidget` itself, precisely determined from source (not assumed to match the siblings)
//
// `MapCoreWidget`'s constructor function declares THREE parameters (`chart, axis, widget`) -
// unlike `CoreWidget`'s own ZERO-parameter constructor, and unlike `CanvasCoreWidget`/
// `PolygonCoreWidget`'s (also zero-parameter, inherited implicitly since neither redeclares a
// constructor). But the constructor BODY is completely empty - none of the three parameters are
// ever read or assigned anywhere in it. This is genuinely vestigial: exactly like every other
// `Draw`-family base/subclass in this port (`CoreGrid`/`CoreWidget`/`CoreBrush`, all confirmed via
// their own header comments), `base/builder.ts`'s `drawWidget()` wires `chart`/`axis`/`widget`/
// `svg`/`canvas` onto the instance EXTERNALLY, AFTER construction (`draw.chart = this; draw.axis =
// this._axis[0]; draw.widget = draws[i]; ...`) - so even though the original author bothered to
// write out a 3-parameter constructor signature here, the real engine never actually depends on
// those parameters being passed OR used; a bare `new MapCoreWidget()` behaves identically to
// `new MapCoreWidget(chart, axis, widget)` in the original, and identically to `new CoreWidget()`
// itself. Kept 1:1 anyway per Phase 0 rule 2 ("keep constructor parameter order/names... 1:1 with
// the original so the mapping stays auditable") rather than silently dropping the unused
// parameters - each explicitly marked unused below rather than omitted, for that same auditability.
//
// ============================================================================================
// THE `static setup()` OVERRIDE - the one real thing this file adds
//
// `MapCoreWidget.setup()` returns `{ axis: 0 }` - MERGED with (not replacing) `CoreWidget.setup()`'s
// own `{ render: false, index: 0 }` and `Draw.setup()`'s `{ type: null, animate: false }`:
// `base/builder.ts`'s `defineOptions()` walks a registered widget's ENTIRE `extend` chain
// leaf-first (this class's own `setup()` first, then each ancestor's, real JS static-side
// prototype walk), matching what the original engine's `jui.defineOptions`/`getOptions()` does -
// a fix landed after this file's own port (see `builder.ts`'s `defineOptions()` doc comment for
// the fix itself). `axis: 0` mirrors `Axis`'s own zero-based indexing convention (`base/axis.ts`) -
// a default "which configured axis index this map-family widget applies to" config value,
// consistent in spirit with `CoreWidget.getIndexArray()`'s own "operate on axis 0 unless told
// otherwise" default.
// ============================================================================================

import { CoreWidget } from "../core";

/**
 * Port of `chart.widget.map.core`'s `MapCoreWidget` constructor function as a real ES class, per
 * Phase 0 rule 2. Constructor parameters kept 1:1 with the original (`chart, axis, widget`) even
 * though none are read in the body (see header comment) - real wiring happens externally, via
 * `base/builder.ts`'s `drawWidget()`, exactly like every other `chart.widget.*`/`chart.brush.*`/
 * `chart.grid.*` base class in this port.
 */
export class MapCoreWidget extends CoreWidget {
  constructor(_chart?: unknown, _axis?: unknown, _widget?: unknown) {
    super();
  }

  /**
   * @method setup
   * 1:1 port of `MapCoreWidget.setup()`'s static defaults factory - `{ axis: 0 }`, now MERGED with
   * (not replacing) `CoreWidget.setup()`/`Draw.setup()`'s own defaults via `defineOptions()`'s
   * full-chain walk (see header comment).
   */
  static setup(): Record<string, unknown> {
    return {
      /** @cfg {Number} [axis=0] Index of the configured axis this map-family widget applies to. */
      axis: 0,
    };
  }
}
