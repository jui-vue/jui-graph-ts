// Port of juijs-graph's `src/brush/map/core.js` (`chart.brush.map.core`, `extend:
// "chart.brush.core"`).
//
// ============================================================================================
// EXTEND CHAIN - CONFIRMED FROM SOURCE: `brush/map/core.js` line 3, `extend: "chart.brush.core"`
// -> `src/brush/core.ts`'s `CoreBrush` (`extends Draw`). Real chain: `MapCoreBrush extends
// CoreBrush extends Draw` - the third and last `chart.brush.core`-derived base this task ports,
// alongside `brush/canvas/core.ts`'s `CanvasCoreBrush` and `brush/polygon/core.ts`'s
// `PolygonCoreBrush`.
//
// ============================================================================================
// VERIFIED AGAINST jui-chart-vue's own `PORT_STATUS.md` claim (this task's own assignment: "jui-
// chart-vue's PORT_STATUS.md documented this as an empty extension-point stub with zero concrete
// subclasses anywhere public. Verify this is still true in the real source (should be trivial,
// ~10 lines)") - CONFIRMED, exactly right, re-read from the real source directly rather than
// trusting the prior claim: the ENTIRE file is 10 lines. `component: function() { var
// MapCoreBrush = function() {}; return MapCoreBrush; }` - a constructor function with a
// COMPLETELY EMPTY BODY. It adds ZERO methods, ZERO fields, ZERO `static setup()` over `CoreBrush`
// - genuinely nothing at all beyond the bare `extend` chain declaration itself. Grepped this
// project's own full clone of `juijs-graph`'s source tree (`/home/search5/cl/jui-graph/src`) for
// any file with `extend: "chart.brush.map.core"`: zero matches anywhere - no concrete
// `chart.brush.map.*` leaf class exists in the upstream source at all, matching jui-chart-vue's
// own "zero concrete subclasses anywhere public" finding exactly (that finding was presumably
// reached the same way, by grepping the same absence, not by having read this file's own trivial
// body - both are now independently confirmed).
//
// This is a pure "extension point" placeholder, same architectural role `base/map.js`
// (`chart.map`, ported separately per Phase 0 rule 8 - out of THIS task's scope) plays for
// `base/axis.ts`'s own `drawMapType()`/`MapConstructor` machinery: a base class that exists so a
// THIRD-PARTY or future consumer can `extends MapCoreBrush` to build a map-overlay brush (e.g.
// drawing markers/regions onto a `chart.map`-rendered geographic backdrop) while inheriting all of
// `CoreBrush`'s real machinery (`eachData`/`getValue`/`getXY`/`getStackXY`/`addEvent`/`color`/
// `offset`/`curvePoints`/`drawTooltip`/`static setup()`'s 6-key defaults, etc.) for free - it does
// not itself add any map-specific behavior, unlike `chart.brush.canvas.core`'s real
// `addPolygon()`/`drawAfter()` addition or `chart.brush.polygon.core`'s real `createPolygon()`
// addition (both ported alongside this file - see their own header comments).
// ============================================================================================

import { CoreBrush } from "../core";

/**
 * Port of `chart.brush.map.core`'s `MapCoreBrush` constructor function as a real ES class, per
 * Phase 0 rule 2. Constructor kept 1:1 (zero parameters, same externally-wired-after-construction
 * shape `CoreBrush`/`CanvasCoreBrush`/`PolygonCoreBrush` already established) - and, unlike every
 * sibling `chart.brush.*.core` base in this engine, adds LITERALLY NOTHING beyond that: no
 * methods, no fields, no `static setup()` override. A pure, empty extension point - see header
 * comment for the confirmed-empty real source and the confirmed-zero-subclasses grep.
 */
export class MapCoreBrush extends CoreBrush {}
