// Port of juijs-graph's `src/widget/canvas/core.js` ("chart.widget.canvas.core",
// extend: "chart.widget.core").
//
// ============================================================================================
// REAL SURFACE - the whole original file, verbatim:
//
//   export default {
//       name: "chart.widget.canvas.core",
//       extend: "chart.widget.core",
//       component: function () {
//           var CanvasCoreWidget = function() {
//               this.drawAfter = function(obj) {
//               }
//           }
//           return CanvasCoreWidget;
//       }
//   }
//
// A two-line pass-through over `CoreWidget` (`widget/core.ts`): a ZERO-parameter constructor
// (same externally-wired-after-construction shape every `Draw`-family base in this port already
// established - `base/builder.ts`'s `drawWidget()` sets `chart`/`axis`/`widget`/`svg`/`canvas`
// onto the instance AFTER `new Obj(...)`, never reads constructor arguments) that overrides
// `drawAfter(obj)` with a COMPLETELY EMPTY body - no CSS class stamp, no anything.
//
// ============================================================================================
// NO EXISTING jui-chart-vue REFERENCE FOR THIS SPECIFIC FILE (per this task's own framing)
//
// jui-chart-vue's canvas-widget behavior (`usePickerWidget.ts` and friends) was built as opt-in
// COMPOSABLE behavior layered onto host components, not as a separate widget-base-class subclass
// mirroring this file's `chart.widget.canvas.core` - so there is no writeup to cross-check
// against here, unlike `widget/polygon/core.ts` (which DOES have one, see that file). This is a
// first, independent read of the real source.
//
// What this file actually ADDS over `CoreWidget`, precisely (not "likely canvas-specific
// hit-testing or context access" as this task's own initial framing speculated - the real source
// settles it): **nothing except erasing `CoreWidget.drawAfter`'s CSS-class-stamping behavior.**
// No canvas-context access, no hit-testing, no new methods, no new fields. `CanvasCoreWidget`
// itself is (like `CoreWidget`) never instantiated by any concrete class anywhere in the real
// `juijs-graph` source tree (confirmed via `grep -rn "widget.canvas.core"` across the whole
// `/home/search5/cl/jui-graph/src` tree: only `main.js`'s own registration import references it
// at all) - it exists purely as an unused extension point for a hypothetical canvas-rendered
// widget family that was never actually built out in this engine (canvas rendering in the real
// `juijs-graph` engine lives almost entirely under `brush/canvas/*` instead, a SEPARATE
// `chart.brush.*` family, not `chart.widget.*` - `brush/canvas/core.js` is a different,
// still-pending Phase E task).
//
// ============================================================================================
// THE `drawAfter(obj) {}` OVERRIDE - a genuine, preserved behavior change vs. `CoreWidget`
//
// `CoreWidget.drawAfter` (`widget/core.ts`) stamps `obj.attr({ class: "widget-" + this.widget.type
// })` on every render. `CanvasCoreWidget.drawAfter` SHADOWS that with a no-op - any concrete
// canvas-family widget subclass (hypothetically extending this class, none exist) would silently
// lose the `widget-<type>` CSS class stamp `base/draw.ts`'s `render()` calls unconditionally
// after `draw()` (`if (typeCheck("function", this.drawAfter)) { this.drawAfter(obj); }` - the
// function reference always resolves, since `CanvasCoreWidget`'s own override replaces it, so the
// call always happens, it's just a no-op). Preserved exactly (not "fixed" to still stamp the
// class), tested in `core.spec.ts`.
// ============================================================================================

import { CoreWidget } from "../core";
import type { TransElement } from "../../util/svg/element.transform";

/**
 * Port of `chart.widget.canvas.core`'s `CanvasCoreWidget` constructor function as a real ES
 * class, per Phase 0 rule 2. Constructor kept 1:1 (zero parameters, same externally-wired shape
 * `CoreWidget` itself already established - see header comment).
 */
export class CanvasCoreWidget extends CoreWidget {
  /**
   * @method drawAfter
   * 1:1 port of `CanvasCoreWidget`'s own `this.drawAfter` override - a completely empty body,
   * shadowing `CoreWidget.drawAfter`'s CSS-class-stamping behavior entirely (see header comment).
   * Declared as an arrow-function CLASS FIELD, matching `CoreWidget.drawAfter`'s own field
   * declaration (a TS2425 override-kind-matching necessity - overriding a base class's arrow
   * function class field with a prototype method is a type error).
   */
  drawAfter = (_obj: TransElement): void => {};
}
