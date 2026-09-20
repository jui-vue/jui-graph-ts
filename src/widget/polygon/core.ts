// Port of juijs-graph's `src/widget/polygon/core.js` ("chart.widget.polygon.core",
// extend: "chart.widget.core").
//
// ============================================================================================
// REAL SURFACE - the whole original file, verbatim:
//
//   export default {
//       name: "chart.widget.polygon.core",
//       extend: "chart.widget.core",
//       component: function () {
//           var PolygonCoreWidget = function() {
//               this.drawAfter = function(obj) {
//               }
//           }
//           return PolygonCoreWidget;
//       }
//   }
//
// Byte-identical in shape to `widget/canvas/core.js` (confirmed via `diff` against the real
// source - only the two names differ: `chart.widget.polygon.core`/`PolygonCoreWidget` vs.
// `chart.widget.canvas.core`/`CanvasCoreWidget`). A two-line pass-through over `CoreWidget`
// (`widget/core.ts`): a ZERO-parameter constructor (same externally-wired-after-construction
// shape every `Draw`-family base in this port already established) that overrides `drawAfter(obj)`
// with a COMPLETELY EMPTY body.
//
// ============================================================================================
// CROSS-CHECK AGAINST jui-chart-vue's `widget/polygon/rotate3d.js`/`useRotate3d.ts` PHASE E
// WRITEUP - this task's own specific verification assignment
//
// jui-chart-vue's Phase E writeup for `rotate3d.js` (already quoted in full in `widget/core.ts`'s
// own header comment, reproduced here for this file's specific claim) states:
//
//   "chart.widget.polygon.rotate3d extends chart.widget.polygon.core (a two-line pass-through -
//   empty drawAfter() override, nothing else) extends chart.widget.core ..."
//
// **CONFIRMED CORRECT, verbatim, against the real source read in full above** - not a
// correction. `widget/polygon/core.js` is EXACTLY a two-line pass-through: one constructor
// (zero params), one method (`drawAfter`, completely empty body), nothing else - no additional
// fields, no additional methods, no static `setup()` override (unlike `widget/map/core.ts`,
// which DOES add a `setup()` override - see that file). jui-chart-vue's description could not be
// more precise; there is nothing to add or correct.
//
// ============================================================================================
// THE `drawAfter(obj) {}` OVERRIDE - genuine, preserved behavior change vs. `CoreWidget`
// (same finding as `widget/canvas/core.ts`, documented independently here since the two files are
// NOT related by inheritance to each other - they're SIBLING extensions of `CoreWidget`, not one
// extending the other, despite the identical shape)
//
// `CoreWidget.drawAfter` (`widget/core.ts`) stamps `obj.attr({ class: "widget-" + this.widget.type
// })` on every render (`base/draw.ts`'s `render()` always calls whatever `this.drawAfter`
// resolves to after `draw()`, unconditionally once the function reference exists).
// `PolygonCoreWidget.drawAfter` SHADOWS that with a no-op - a real, concrete subclass of THIS
// file, `widget/polygon/rotate3d.ts` (unported here, jui-chart-vue's `rotate3d.js`/
// `useRotate3d.ts` cross-check target), inherits the no-op unless it defines its own further
// override - so any polygon-family widget loses the `widget-<type>` CSS class stamp unless it
// re-adds one itself. Preserved exactly (not "fixed"), tested in `core.spec.ts`.
// ============================================================================================

import { CoreWidget } from "../core";
import type { TransElement } from "../../util/svg/element.transform";

/**
 * Port of `chart.widget.polygon.core`'s `PolygonCoreWidget` constructor function as a real ES
 * class, per Phase 0 rule 2. Constructor kept 1:1 (zero parameters, same externally-wired shape
 * `CoreWidget` itself already established - see header comment).
 */
export class PolygonCoreWidget extends CoreWidget {
  /**
   * @method drawAfter
   * 1:1 port of `PolygonCoreWidget`'s own `this.drawAfter` override - a completely empty body,
   * shadowing `CoreWidget.drawAfter`'s CSS-class-stamping behavior entirely (see header comment).
   * Declared as an arrow-function CLASS FIELD, matching `CoreWidget.drawAfter`'s own field
   * declaration (a TS2425 override-kind-matching necessity).
   */
  drawAfter = (_obj: TransElement): void => {};
}
