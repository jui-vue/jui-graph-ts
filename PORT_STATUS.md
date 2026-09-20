# jui-graph-ts — port status

`jui-graph-ts` is a framework-agnostic TypeScript port of [`juijs-graph`](https://github.com/juijs/jui-graph)
(cloned locally at `/home/search5/cl/jui-graph`, MIT, `seogi1004`/JenniferSoft) — the low-level SVG/canvas chart
*engine* that `jui-chart` (and therefore `jui-chart-vue`) is built on top of.

**Goal**: a complete, faithful TS port of every file in `juijs-graph`'s `src/` tree — including the parts
`jui-chart`/`jui-chart-vue` never used (map, radar grid, log scale, time scale, date grid) — published as its
own npm package, with **`jui-chart-vue` migrated to depend on it at runtime**, replacing the hand-ported
composables it built during its own Phase A–F effort (see `/home/search5/cl/jui-chart-vue/PORT_STATUS.md`).

This reverses jui-chart-vue's original "zero runtime dependency on juijs-graph" principle *by design* — that
principle was right for a from-scratch MVP port with one consumer; now that the plan is to publish multiple
`jui-*` packages to npm, a shared, independently-versioned TS engine is the better shape. See the two projects'
chat history for the full reasoning if it needs to be re-derived later.

### Deferred follow-up: `jui-core-ts`

There is a real, unstarted `jui-core` project too (`github.com/juijs/jui-core`, npm name `juijs`, cloned at
`/home/search5/cl/jui-core`) — the actual shared foundation of the whole JUI family. `jui-grid`/`jui-ui`
genuinely depend on it at runtime (`juijs: ^2.3.0`); `juijs-graph` (this project's source) does **not** depend
on it, but its own `base/base.js`/`util/math.js`/`util/color.js`/`util/dom.js` are near-byte-identical forked
copies of jui-core's own files (confirmed via `diff` — only quote-style differs, plus jui-core's `base/base.js`
has extra `sort`/`template`/`globalOpts` methods jui-graph's fork dropped). So porting `jui-core-ts` would have
broader reach (jui-grid-vue + jui-ui-vue + this project, vs. this project alone) and is much smaller (13 files
vs. juijs-graph's ~55) — a plausible candidate to do first or in parallel next time this kind of work starts.

**Decision (deliberate, not an oversight)**: deferred, not started now. jui-graph-ts's Phase A util/ files
(`math.ts`/`color.ts`/`dom.ts`) are already being built as full independent ports per this file's existing
plan — that work is not wasted if `jui-core-ts` happens later; it just becomes an opportunity to reconcile the
two into one shared implementation retroactively (similar in spirit to jui-chart-vue's Phase F treemap-squared
consolidation). Do not start `jui-core-ts` proactively — wait for it to be explicitly requested.

## Phase 0 — Architecture decisions (read this before porting any file)

These apply to every phase below. Do not re-litigate them per file; if a file seems to need an exception,
document the exception explicitly rather than silently deviating.

1. **No runtime module registry.** The original's `jui.use([...])` / `jui.include("name")` global,
   string-keyed registry is dropped entirely. Every `{name, extend, component}` descriptor becomes a real
   TypeScript file with real `import`/`export`. Internal call sites that did `jui.include("util.math")`
   become plain named imports of the corresponding ported module.
2. **`extend` chains become real `class ... extends ...`.** Where the original's `component()` returns a
   constructor function designed to be subclassed via a string-keyed `extend:` field (everything under
   `base/`, `grid/`, `polygon/`, `brush/*/core.js`, `widget/*/core.js`), port it as a real ES class. Keep
   constructor parameter order/names and method names 1:1 with the original so the mapping stays auditable
   (e.g. a method called `calculatePanel()` in the original stays `calculatePanel()` here, not renamed to
   something "more idiomatic" — fidelity over taste).
3. **Pure utility namespaces stay plain function modules, not classes.** `util/math.js`, `util/color.js`,
   `util/time.js`, `util/transform.js`, `util/dom.js` etc. are not part of any `extend` chain in the original
   either — they're grab-bags of exported functions. Port them the same way jui-chart-vue's own composables
   already do: named exported functions, no forced class wrapper.
4. **Drop `util/base.js`'s bespoke `inherit()`/`extend()`/`typeCheck()` machinery and its browser-sniffing
   properties (`browser.webkit`/`.mozilla`/`.msie`, `isTouch`).** These existed to fake OOP/type-checking in
   ES5; TypeScript's real `class`/`extends`/type system replaces them outright. Verify per-file before
   dropping a reference to one of these — don't assume every call site is dead, some `isTouch` checks may be
   real product behavior worth preserving as a plain `navigator.userAgent` check.
5. **Cross-check against jui-chart-vue's existing hand-ports wherever one already exists.** jui-chart-vue's
   Phase A–F already hand-ported and hand-traced-tested a meaningful subset of this same engine as plain TS
   functions (not classes) — e.g. `mathUtil.ts` ↔ `util/math.js`'s `nice`/`fixed`/`div`/`radian`/`rotate`;
   `useScale.ts` ↔ `util/scale.js` + `util/scale/{linear,ordinal}.js`; `usePolygon3d.ts` ↔
   `polygon/{core,point,line,cube}.js`; `useColorScale.ts`/`useAxis.ts` were audited against `util/color.js`/
   `base/axis.js` without a 1:1 port. Read the relevant jui-chart-vue composable AND spec file first — its
   existing hand-traced test cases are a ready-made verification oracle (same expected numeric outputs), and
   its writeup in jui-chart-vue's `PORT_STATUS.md` Phase F section often already documents preserved bugs/
   quirks worth carrying over here too. Don't blindly copy its *shape* (it's Vue-composable-shaped, this is
   class-shaped) — just reuse its verification values and documented quirks.
6. **Preserve original bugs/quirks byte-faithfully, documented, same discipline as jui-chart-vue's Phase A–F.**
   Don't "fix" anything found along the way; note it in this file's per-item writeup instead.
7. **File layout**: one TS file per original source file, same relative path
   (`juijs-graph/src/util/math.js` → `jui-graph-ts/src/util/math.ts`), so the mapping is always obvious.
   Hand-traced unit tests co-located as `*.spec.ts`, following jui-chart-vue's vitest conventions
   (`npm run test`, jsdom environment — most of this engine touches real DOM/SVG/Canvas APIs).
8. **Full scope, not just what jui-chart uses.** Unlike jui-chart-vue's port, this includes `base/map.js`,
   `grid/radar.js`, `grid/log.js`, `grid/date.js`+`grid/dateblock.js`, `util/scale/{log,time,circle}.js`,
   `brush/map/core.js`, `widget/map/core.js` — none of these have an existing jui-chart-vue reference to
   cross-check against, so they need full independent verification (hand-computed expected values, or a
   small headless-DOM/jsdom integration check where pure unit math isn't enough, e.g. `base/map.js`'s SVG
   path loading).

## Phase A — Utility layer (`util/`)

Foundational, no dependencies on `base/`/`grid/`/`polygon/`. Port these first.

### Progress log — `util/math.js`, `util/color.js`, `util/scale.js`+`scale/{linear,ordinal}.js` (first Phase A batch)

All 5 files ported to `src/util/math.ts`, `src/util/color.ts`, `src/util/scale.ts`,
`src/util/scale/linear.ts`, `src/util/scale/ordinal.ts`, with co-located `*.spec.ts` files (92
tests: 31 math, 25 color, 12 scale, 14 scale/linear, 10 scale/ordinal). The repo's full suite is
178 tests across 8 spec files - the other 86 (`dom.spec.ts`/`time.spec.ts`/`transform.spec.ts`)
belong to `util/dom.js`/`util/time.js`/`util/transform.js`, ported concurrently in a separate
iteration of this same Phase A pass (not this batch's work, but reconciled with below: `scale.ts`'s
`time()` now imports the real `add()` from the concurrently-landed `./time.ts` instead of a
private stand-in - see deviation 2 below). `npm run typecheck`, `npm run test`, and `npm run
build:lib` all pass across the full combined tree. `src/index.ts` now
re-exports all 5 as namespaces (`mathUtil`/`colorUtil`/`scaleUtil`/`linearScaleUtil`/
`ordinalScaleUtil`) — namespaced rather than flat `export *` because `util/scale.ts` and
`util/scale/linear.ts` (and `.../ordinal.ts`) independently define same-named symbols
(`linear`/`LinearScale`, `ordinal`/`OrdinalScale`) — two real, separately-registered modules in
the original with logically-identical but distinct implementations (see below). This convention
should carry forward to later phases, which will hit the same collision problem with `core`/etc.

**`util/math.ts`**: full file ported (matrix helpers included, not just the subset jui-chart-vue
needed). Cross-checked against `jui-chart-vue/src/composables/mathUtil.ts` + its spec: `nice`
(non-`isNice` path)/`getFixed`/`fixed`/`div`/`radian`/`rotate`/`scaleValue` all match jui-chart-vue's
already-hand-traced values exactly (reused several of its expected values directly, e.g.
`plus(0.1,0.2)===0.3`). Quirks/bugs found and preserved byte-faithfully (Node-cross-checked against
literal transcriptions of the real upstream source, not just read-and-assumed):
  - **`nice(min, max, ticks, true)` (the `isNice` branch) always throws `ReferenceError:
    niceFraction is not defined`, in every distributed form of the real library** — not a
    port-introduced issue. `niceNum()`'s result variable is assigned via the undeclared
    identifier `niceFraction` (a typo — a *different*, unused `nickFraction` is the one actually
    `var`-declared). Confirmed empirically: `dist/jui-graph.js`/`.cjs.js`/`.esm.js` all start with
    `'use strict'` (real ES-module output), and a literal Node transcription of `niceNum()` throws
    exactly this error. **This is reachable in real usage, not just dead code**: `grid/range.js`
    (Phase C) threads its own `nice` grid-config option straight into this call as `isNice` — so
    any consumer that sets `nice: true` on a range grid gets a hard crash in the original engine.
    jui-chart-vue's `mathUtil.ts` silently "fixed" this by necessity (TypeScript requires
    declaring `niceFraction`, so its port can't reproduce an implicit-global ReferenceError) — this
    port instead makes `niceNum()` literally `throw new ReferenceError('niceFraction is not
    defined')`, preserving the exact crash/type/message. Tested in `math.spec.ts`.
  - **`fixed(x).div(a, b)` throws `TypeError` at runtime** — `.div` calls `this.getFixed(...)`,
    assuming `this` is the top-level `util.math` namespace (true for the standalone `math.div()`,
    which also calls `this.getFixed` and works fine), but `this` is actually the `fixed()`
    instance it's attached to, which has no `getFixed` property. `.plus`/`.minus`/`.multi`/
    `.remain` all work (none reference `this`). Confirmed dead in practice (grep: only `.plus`/
    `.minus` on a `fixed()` instance are ever called, by `scale.js`/`linear.js`/`grid/range.js`'s
    tick-stepping loops). Tested.
  - **`inverseMatrix3d()` has two independent, previously-undocumented bugs**, both Node-cross-
    checked against a literal transcription of the real algorithm (not assumed from reading code):
    (a) two cofactor assignments target `te[3][4]` instead of `te[3][3]` (transcription typo) —
    `te` is a 4-element `Float32Array` per row, so this is a silent out-of-range no-op write, and
    `te[3][3]` (the bottom-right element) is left at its default `0` forever. Verified:
    `inverseMatrix3d(identity4x4)` returns `[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,0]]` — **not**
    the identity matrix a correct inverse-of-identity should be (bottom-right should be `1`).
    (b) the singular-matrix fallback (`if (det === 0) {...identity...}`) can never actually
    trigger for a genuinely singular matrix: `det` is computed as `1 / sum`, so a singular
    matrix (`sum === 0`) produces `det === Infinity`, not `0`. A singular input falls through to
    the `else` branch and gets multiplied by `Infinity` instead of falling back to identity. Both
    preserved (not fixed), documented in `math.ts`'s header comment, tested in `math.spec.ts`.

**`util/color.ts`**: full 1:1 port (first ever — jui-chart-vue's `useColorScale.ts` only AUDITED
this file's functions for a possible source match and found none worth reusing, per its own
Phase F writeup; `useColorScale.ts` itself stays independent/unported-from). Ported `format`/
`scale`/`map` (+ `.parula`/`.jet`/`.hsv`/`.hot`/`.pink`/`.bone`/`.copper` presets)/`rgb`/
`HSVtoRGB`/`RGBtoHSV`/`trim`/`lighten`/`darken`/`parse`/`parseGradient`/`parseStop`/`parseAttr`/
`colorHash`. Node-cross-checked hand-traced values for every function (e.g.
`HSVtoRGB(0,1,1)={r:255,g:0,b:0}`, `RGBtoHSV(0,0,255)={h:240,s:1,v:1}`,
`colorHash("abc")={r:247,g:32,b:8}`). Quirks preserved:
  - `rgb()` and `parseGradient()` both pass their input straight through UNCHANGED when it's
    either the wrong type or doesn't match the expected pattern (no error, no parsing) — not a
    bug exactly, just untyped JS looseness, typed here as a union return.
  - The original's own `scale()` doc comment claims `c(0.5) === '#808000'` for a red→green scale
    — **wrong**: the real (Node-verified, and this port's) value is `'#7F7F00'` (`parseInt`
    truncates the 127.5 midpoint down to 127 = `0x7F`, it doesn't round to 128 = `0x80`). Noted in
    this port's own `scale()` test rather than silently "fixing" the comment's claimed value.
  - **`parseStop()`'s offset-interpolation pass is essentially non-functional, a genuine bug
    beyond what a first read suggests** — found and confirmed via Node cross-check, not obvious
    from reading the code once. The first pass builds each stop's parsed offset into
    `stop.attr.offset` (e.g. `"50%"` on a `"50% yellow"` stop). The SECOND pass (which is
    supposed to interpolate offsets for stops that didn't specify one, between two that did)
    reads/writes a completely different, top-level `stop.offset` field — never `stop.attr.offset`
    — so it's blind to every real, explicitly-specified percentage offset; only the force-set
    first (`0`) and last (`1`) stops ever get a top-level `.offset` at all. Worse: even in the one
    case where the pass DOES find two candidates to interpolate between (both top-level-undefined
    by accident, e.g. all-bare-color stops), the fill loop's range (`for (i = start+1; i < end;
    i++)`) is empty whenever the two candidates are adjacent (`end - start === 1`), so it
    interpolates zero of them. Net effect, hand-verified against 3 different inputs in
    `color.spec.ts`: explicit percentage offsets on middle stops are always ignored, and the
    "auto-interpolate" fallback only ever actually assigns anything to the very first/last stop.
    Preserved exactly (including the stray top-level `.offset` field showing up on returned stop
    objects, separate from `.attr`), documented in `color.ts` and `color.spec.ts`.

**`util/scale.js` + `util/scale/linear.js` + `util/scale/ordinal.js`**: ported to `scale.ts` +
`scale/linear.ts` + `scale/ordinal.ts`. `linear()`'s core interpolation/tick algorithm
cross-checked against jui-chart-vue's `useScale.ts`'s `createLinearScale` — all of its
hand-traced `useScale.spec.ts` values (interpolation, extrapolation, clamp, reversed range,
invert, `ticks(5,false)`, `ticks(5,true)` "nice" rounding, zero-domain, reversed-domain) reused
directly and pass unmodified against this port. jui-chart-vue's `createLinearScale` only
implements `reverse: false` (its own doc comment: "the non-reversed code path... only used by
unported 3d/z-axis code") — **this port adds full 1:1 coverage of `ticks()`'s `reverse: true`
branch** (Node-cross-checked hand-traced values, including a genuine float-drift case:
`Math.abs(x - max)` on `fixed()`-stepped values can reintroduce binary floating-point error even
though the stepping itself was decimal-safe — e.g. domain `[0,9]` produces
`1.7999999999999998`, not `1.8`, verified against a literal transcription, not assumed).

**`ordinal()` `rangePoints`-invert discrepancy — resolved precisely, per this batch's specific
assignment to verify it**: jui-chart-vue's Phase F audit (`useScale.ts` writeup) found that
`createOrdinalScale`'s `invert()` (the fuller, `_isRangePoints`-aware branch: `min -= _rangeBand/2`
when in `rangePoints` mode, clamp, `Math.floor`) did NOT match the simpler `ordinal().invert()`
embedded in `node_modules/juijs-graph/src/util/scale.js` (`Math.ceil(x/_rangeBand)`, no
`rangePoints` branch) — and concluded the fuller version must live only in `jui-chart/dist/
jui-chart.js`'s *compiled* bundle, "built from a newer `util.scale.js` than the `node_modules`
copy on disk". **Having now read this project's own full clone
(`/home/search5/cl/jui-graph`, confirmed same `1.1.4` package version as jui-chart-vue's
`node_modules/juijs-graph` copy, and `util/scale/ordinal.js` confirmed BYTE-IDENTICAL between the
two copies via `diff`), the real explanation is simpler and more precise than "must be a newer
version somewhere"**: **both the simple and fuller `ordinal()` implementations already coexist in
the SAME checked-in source tree jui-chart-vue had access to all along** — just in two different
files. `util/scale.js`'s embedded `ordinal()` has the simple invert (matches what jui-chart-vue
found when it checked `util/scale.js` specifically); the separate, standalone `util/scale/
ordinal.js` module has the fuller `_isRangePoints`-aware invert (matches `dist/jui-chart.js`'s
compiled behavior exactly). jui-chart-vue's audit simply hadn't cross-checked against this second
file — there is no actual source-vs-compiled-dist discrepancy, just two different source files
that needed checking. Confirmed live/real, not incidental: `grid/date.js`/`grid/dateblock.js`
consume `util.scale.js`'s embedded `time()`, and `grid/log.js` consumes its embedded `log()` (via
`jui.include("util.scale")`) — but grepping all of `grid/*.js`, **nothing in the engine's own
source ever calls `jui.include("util.scale.ordinal")`** (the standalone module) — it exists
only as public API surface for external consumers like `jui-chart`, which is presumably exactly
how `dist/jui-chart.js` ends up using the fuller version. Which of the two `grid/block.js`/
`grid/fullblock.js` (which DO use `util.scale.js`'s embedded, simple-invert `ordinal()`) actually
needs for correct behavior is a question for this project's own Phase C. Both versions are now
ported byte-faithfully as separate files/exports (`scale.ts`'s `ordinal()` = simple,
`scale/ordinal.ts`'s `ordinal()` = fuller), with a test in `scale.spec.ts` demonstrating the two
give different answers for the identical `rangePoints()` setup (`invert(50)` → `1` vs. the fuller
version's `0`). `scale/ordinal.ts`'s fuller version was cross-checked against jui-chart-vue's
`useScale.ts`'s `createOrdinalScale`/`OrdinalScale.invert` — all hand-traced `useScale.spec.ts`
ordinal cases (evenly-spaced placement, integer-index resolution, `rangeBand`, invert round-trip,
invert clamp-to-0, and the `NaN`-for-1-item-domain preserved quirk) reused directly and pass.
`rangeBands()` (intentionally NOT ported by jui-chart-vue) IS ported here per Phase 0 rule 8/
full-scope goal.

A second, independent small divergence between the two `ordinal()` implementations was also found
(not previously known/documented anywhere): the standalone `util/scale/ordinal.js`'s numeric-index
resolution branch has `_domain[t] = t;` commented out with an explicit upstream `FIXME` ("이건
나중에 따로 연산해야할 듯" — "this probably needs to be calculated separately later"); the embedded
`util/scale.js` version has the SAME line **not** commented out — it actually runs, silently
mutating the `_domain` array (overwriting a label with a raw numeric index) whenever the scale is
called with a numeric argument. Verified via Node cross-check and preserved in both files
respectively; tested in `scale.spec.ts`.

**Deviations required by real, unresolvable-within-scope dependency gaps** (both in `scale.ts`
only, both documented in its header comment, not "fixes" — no observable behavior change from the
original where it could actually run):
  1. `log()`'s `$.extend(newFunc, func)` assumes a global jQuery (`$`) that is never imported
     anywhere in the whole `juijs-graph` source tree — **a genuine, pre-existing bug/gap in the
     upstream engine itself**, confirmed live (`grid/log.js` calls `UtilScale.log(...)`, i.e. this
     exact function, so a log-scale grid in the real original engine cannot function without a
     jQuery global happening to be present on the page — not something this port introduced).
     `$.extend(target, source)` with exactly these two plain-object arguments is a simple shallow
     property copy, behaviorally identical to `Object.assign`, used here instead.
  2. `time()` needs `util/time.js`'s `add()` + time-unit constants; `util/time.js` is its own
     not-yet-ported Phase A item (full independent port, including its `_.dateFormat`-dependent
     `format()` — out of scope here). Since every call site in `scale.ts` only ever calls `add()`
     with a single `(unit, amount)` pair (never the general multi-pair variadic form), a private,
     non-exported `addTime()` faithfully reimplements just that single-pair behavior. **Not** a
     stand-in for `util/time.ts` — when that file is ported for real, this local duplicate should
     be reconciled/removed (tracked here as a follow-up).

**A real bug this port's own verification process caught and fixed in itself** (documented for
transparency, not a preserved-upstream-bug): the first draft of `linear()`'s `domain`/`range`
methods (in `circle()`/`ordinal()`/`linear()`, both files) used arrow functions closing over the
lexical `func` and returning it directly, instead of the original's `function (values) {...;
return this;}` pattern. This is invisible for direct use (`linear().domain(...).range(...)`) but
silently breaks `log()`'s `Object.assign(newFunc, func)` reuse: `newFunc.range(...)` needs `this`
to dynamically resolve to `newFunc` when called as a method on it (exactly what the original's
`return this` provides) — an arrow function can't do that, so it returned the wrong (inner,
untransformed) scale object instead, and `log(10).domain([0,1e6]).range([0,300])` silently
returned the *inner linear scale* rather than the log-transforming wrapper, breaking the whole
chain (`scale(1000000)` came out as `50000000.00000001` instead of `300`). Caught by
`scale.spec.ts`'s `log` tests failing on first run; fixed by switching `domain`/`range` to plain
`function`/`return this` in `circle()`/`ordinal()`/`linear()` across `scale.ts`, `scale/linear.ts`,
and `scale/ordinal.ts` (applied consistently even where not yet exercised by a failing test, for
fidelity/future-proofing against Phase A's still-to-come `log.ts`/`time.ts` standalone modules,
which reuse `scale/linear.ts`'s `linear()` the same way).

**Verification**: this batch's own 92 tests (`math.spec.ts` 31, `color.spec.ts` 25, `scale.spec.ts`
12, `scale/linear.spec.ts` 14, `scale/ordinal.spec.ts` 10), all passing alongside the other 86 from
the concurrently-ported `dom.spec.ts`/`time.spec.ts`/`transform.spec.ts` (178 total, 8 spec files,
0 failures). `npm run typecheck`, `npm run test`, and `npm run build:lib` all pass clean against
the full combined tree. `src/index.ts` updated to re-export all 5 of this batch's modules
(namespaced — see above) alongside whatever the concurrent `dom`/`time`/`transform` iteration
added.

### Progress log — `util/svg.js` + `util/svg/*.js` (full subtree, all 9 files) + `util/canvas/{base,hidpi}.js`

Both remaining Phase A checklist bullets are now fully complete: all 9 `util/svg*` files (`svg.js`
+ `svg/{base,base3d,element,element.path,element.path.rect,element.path.symbol,element.poly,
element.transform}.js`) and both `util/canvas/{base,hidpi}.js` files, ported to `src/util/svg.ts` +
`src/util/svg/*.ts` (same 8 sub-files, `element.path.js` → `element.path.ts` etc., matching the
original's exact relative layout) + `src/util/canvas/{base,hidpi}.ts`, with co-located
`*.spec.ts` files (98 new tests: element 19, element.transform 10, element.path 6,
element.path.rect 2, element.path.symbol 4, element.poly 4, base 14, base3d 2, svg 18,
canvas/base 14, canvas/hidpi 5). Full repo suite: 320 tests across 22 spec files, 0 failures.
`npm run typecheck`, `npm run test`, and `npm run build:lib` all pass clean against the full
combined tree (including the concurrently-landed `util/scale/{log,time,circle}.ts` batch above).
`src/index.ts` updated with 10 new namespace exports (`svgElementUtil`/`svgTransformElementUtil`/
`svgPathElementUtil`/`svgPathRectElementUtil`/`svgPathSymbolElementUtil`/`svgPolyElementUtil`/
`svgBaseUtil`/`svgBase3dUtil`/`svgUtil`/`canvasBaseUtil`/`canvasHidpiUtil`).

**No jui-chart-vue reference exists for the `util/svg*` tree** (jui-chart-vue uses Vue SFC
templates instead of an imperative element-builder tree entirely) — full independent port, per
this batch's own assignment. `util/canvas/base.ts` WAS cross-checked against jui-chart-vue's
`src/composables/canvasPrimitives.ts`: that file is a small, independently-designed set of
primitives jui-chart-vue wrote for its own needs (differently-shaped/ordered parameters, no
`drawBullet`/`drawPage`/Catmull-Rom curve renderer at all) rather than a port of this file, so
there was no shared test-oracle values to reuse — this is genuinely the first 1:1 port of it,
verified independently by hand-tracing each method's `context` calls against a recording mock
context (jsdom has no real `CanvasRenderingContext2D` without the optional `canvas` npm package,
which this project doesn't depend on — same reasoning as jui-chart-vue's own canvas test setup).

**Architecture decision applied per Phase 0 rule 2**: the whole `element.js` → `element
.transform.js` → `element.path.js` → `element.path.rect.js`/`element.path.symbol.js` chain (and
`element.transform.js` → `element.poly.js`, and `svg/base.js` → `svg/base3d.js` → `svg.js`) is
ported as real `class ... extends ...` chains, not the original's closure-based
`this.method = function(){...}` constructors. This mattered more than usual here because of a
significant finding (documented in full in `element.ts`'s header comment): the original's own
`inherit()` helper (`base/base.js`) builds each subclass's prototype via `ctor.prototype = new
superCtor()` — called exactly ONCE, at module-registration time, not once per instance. Any
inherited method a subclass doesn't itself redefine (e.g. `PathRectElement`/`PathSymbolElement`
inheriting `moveTo`/`arc`/`join` from `PathElement` unshadowed, or every subclass inheriting
`on`/`off`/`hover` from `Element` unshadowed) ends up, in the real original library, sharing ONE
single prototype-seed instance's private closure state (e.g. `PathElement`'s `orders` array,
`Element`'s `events` array) across every instance of every subclass that doesn't override it —
a severe, real, and previously-undocumented cross-instance state-sharing bug rooted entirely in
the old registry's prototype-seeding mechanism. Per Phase 0 rules 1/2/4 (which already authorize
dropping that whole registry/inherit()/typeCheck() machinery outright, the same category of
"structural artifact, not real product logic" as e.g. `util/base.js`'s browser-sniffing), this
specific bug is **not** preserved — real ES `class extends` doesn't have it by construction, and
reproducing it would mean reintroducing the very mechanism Phase 0 says to drop. Documented rather
than silently deviated from, per Phase 0's own instruction.

**Distinct from the above, and genuinely preserved**: `element.path.symbol.ts`'s `join()`
override bug. `PathSymbolElement` declares its OWN accumulator (`ordersString`, populated only via
`.add()`) and its own `join()` that only ever flushes that accumulator — but `.triangle()`/
`.rect()`/`.cross()`/`.circle()` build their path data by calling the INHERITED `MoveTo`/`moveTo`/
`lineTo`/`arc` methods, which push onto `PathElement`'s own separate, private `orders` array. That
array's only reader is `PathElement.join()` — completely shadowed by `PathSymbolElement`'s
override. Net effect: calling e.g. `symbolElem.triangle(...)` then `.join()` writes NOTHING to the
`d` attribute; only path data added via `.add()` ever survives. Unlike the registry-sharing bug
above, this one is self-contained within a single class's design (independent of any module-
system mechanics — it would happen identically under correct, bug-free prototypal or class
inheritance too), so it IS preserved and covered directly in `element.path.symbol.spec.ts`.

**Other preserved bugs/quirks found and documented (each with its own doc comment at the exact
call site, Node/hand-verified, not merely inferred from a single read)**:
  - `element.ts`'s `remove()`: computes the removed element's index within its parent's
    `children` array but never uses it to splice just that entry — instead rebuilds `children`
    from only the entries strictly BEFORE the match, silently dropping every LATER sibling too
    (`[A,B,C]`, `B.remove()` → `[A]`, not `[A,C]`). Tested in `element.spec.ts`.
  - `element.ts`'s `text()`: iterates `element.childNodes` (a live `NodeList`) while removing from
    it without adjusting the loop index — only every other pre-existing child node actually gets
    removed when there are 2+. Harmless in the overwhelmingly common case (a freshly-created
    element with 0 existing children). Tested.
  - `element.ts`'s `is()`: references a bare, never-imported `jui` registry global — always threw
    `ReferenceError: jui is not defined` in the real upstream library, independent of any module
    system this port makes elsewhere. Same discipline as `math.ts`'s `niceFraction`: reproduced as
    a literal throw. Tested.
  - `element.ts`'s `attr(key)` getter: returns the raw stored value from the internal
    `.attributes` cache (whatever type was originally passed — e.g. a `number`) when truthy,
    falling back to `element.getAttribute()` (always a `string`) only when the cached value is
    itself falsy — so `.attr("r")` after `.attr({r: 5})` returns the number `5`, not `"5"`. Also:
    a falsy `attr` argument (including `""`) returns `undefined` immediately, without even
    attempting the string-getter branch. Tested.
  - `element.transform.ts`'s `rotate()`: the documented forms are 1-arg (`rotate(angle)`) or
    3-arg (`rotate(angle,x,y)`); any other argument count (e.g. 2 args) leaves the interpolated
    value `undefined`, producing the literal string `"rotate(undefined)"`. Tested.
  - `element.transform.ts`'s `data()`: each regex (e.g. `translate: /[^translate()]+/g`) is a
    negated CHARACTER CLASS built from the individual letters of its own name plus parens — not a
    token-stripping pattern at all. Against `"translate(1,2)"` it actually extracts `"1,2"`
    (Node-cross-checked), not a stripped-down transform string. Tested.
  - `svg.ts`'s `createChild()`: the "child requires a real parent" guard checks `obj.parent` BEFORE
    calling `this.create()` — the only place `.parent` is ever assigned — so every caller (always
    a freshly-`new`'d element) has `.parent === undefined` at check time, and the guard's
    `"JUI_CRITICAL_ERR: Parents are required elements"` error can never actually fire. Tested.
  - `svg.ts`'s `render()`: always calls `this.clear()` with NO argument, never forwarding its own
    `isAll` — so `render(true)` still only clears stale nodes out of `main`, never `sub`; only the
    `appendAll(root)` vs. `appendAll(main)` choice is `isAll`-sensitive. Documented, not
    separately unit-tested beyond the existing render/clear coverage (subtle enough to not have an
    externally-observable single-assertion signature beyond what's already covered).
  - `svg3d.ts`'s `rect3d()`/`cylinder3d()`: build their real content (paths/ellipses/gradient)
    inside a `this.group({}, callback)` call — but `SVGBase.create()` (the version these methods
    see when called on a bare `SVGBase`/`SVG3d` instance) completely ignores `callback`. Calling
    `rect3d()`/`cylinder3d()` on anything other than a full `SVG` instance (whose `create()`
    override DOES invoke callbacks synchronously) produces an empty `<g>` with zero children —
    exactly matching the original, which only ever worked because real callers always went
    through the full `SVG` class. Tested in both `base3d.spec.ts` (empty-group case) and
    `svg.spec.ts` (real 3-child case via a full `SVG` instance).
  - `canvas/base.ts`'s `drawPage()`: calls a bare `drawFreeRect(...)` identifier — NOT
    `this.drawFreeRect(...)` — which was never declared as a local variable anywhere in the
    original file (only ever assigned as `this.drawFreeRect`). Every real invocation throws
    `ReferenceError: drawFreeRect is not defined` before drawing anything (and even setting that
    aside, the call also passes an extra leading `context` argument that doesn't match
    `drawFreeRect`'s real 10-parameter signature). Same discipline as `math.ts`'s `niceFraction`:
    reproduced as a literal throw. Tested.
  - `canvas/hidpi.ts`'s `ratioArgs`: `isPointinPath`/`isPointinStroke` are typo'd (should be
    `isPointInPath`/`isPointInStroke`) — the patch loop silently creates two dead, never-callable
    own-properties under the typo'd names while leaving the REAL methods completely un-scaled by
    the DPR polyfill, a genuine coverage gap (not just dead code). Documented in the header
    comment and `hidpi.spec.ts` (verified against a stub context, since jsdom's `pixelRatio` is
    always exactly `1` — see below — which prevents observing the patch loop actually run against
    the real global prototype).

**Deliberate, Phase-0-sanctioned non-1:1 renames** (behavior-preserving, purely to avoid TS
compile errors that don't correspond to any original design intent): `TransElement`'s private
`orders` field (the `{translate,scale,rotate,skew,matrix}` record) renamed to `transformOrders` —
TypeScript's structural class-field-override checking rejects a subclass (`PathElement`/
`PolyElement`) redeclaring an inherited field name with an incompatible type, which doesn't apply
to the original's per-`new`-call-fresh-closure design at all (a real code-shape corollary of the
class-ification decision above, not a behavior change — verified no test depends on the field's
internal name, only its externally-observable `transform=` attribute output).

**jsdom testability notes** (each documented at its exact source, same treatment as prior
batches' untestable-under-jsdom cases):
  - `element.path.ts`'s `length()`: jsdom doesn't implement `SVGGeometryElement
    .getTotalLength()` at all (not even a stub returning `0`) — throws `TypeError`, tested as
    such; the DOM setup/teardown around it (temporary `<svg><path>`, attach/detach from
    `document.body`) is otherwise exercised correctly.
  - `canvas/hidpi.ts`'s scaling math: jsdom's `getContext('2d')` returns `null` (no `canvas` npm
    package dependency) and `window.devicePixelRatio` is `1`, so this module's own `pixelRatio`
    always computes to exactly `1` under test — which trips `polyfillForCanvasRenderingContext2D`'s
    `pixelRatio===1` early-return guard on every call, so the actual argument-multiplication logic
    can only be hand-traced/documented, not runtime-asserted. Separately: jsdom doesn't even
    define a global `CanvasRenderingContext2D` class without that same optional package, so
    `polyfills()` (which references `CanvasRenderingContext2D.prototype` directly, like the
    original) throws a `ReferenceError` under jsdom — a real environment limitation, tested as
    such; `apply()` (which takes a context object directly) is unaffected and is what's used to
    verify the patch-loop's guard/typo behavior against a stub.

**`util/canvas/hidpi.ts`'s SSR/global-monkeypatching context** (per this batch's specific
assignment to note it): jui-chart-vue explicitly evaluated and declined this exact approach for
its own canvas chart composable (`useCanvasChart.ts`) — its own `PORT_STATUS.md` Phase E entry
documents why: mutating `CanvasRenderingContext2D.prototype`/`HTMLCanvasElement.prototype`
directly is a process-wide, irreversible side effect (patches every canvas context on the page,
not just the chart's own) and is SSR-incompatible (no `document`/canvas globals exist at module-
evaluation time on a server — this port's own `pixelRatio` computation, which runs eagerly at
import time exactly like the original, reproduces that same hazard faithfully rather than
guarding/deferring it). Ported here anyway per Phase 0 rule 8's full-scope goal — jui-chart-vue's
own DPR handling should NOT be migrated to depend on this file; that non-migration decision
stands unchanged, this port doesn't reopen it.

- [x] `util/math.js` → `src/util/math.ts` — cross-check against jui-chart-vue's `mathUtil.ts` (already covers
      `nice`/`fixed`/`div`/`radian`/`rotate`/`scaleValue`; all already audited as hand-port, no external-library
      match, in jui-chart-vue's Phase F).
- [x] `util/color.js` → `src/util/color.ts` — cross-check against jui-chart-vue's `useColorScale.ts` (audited,
      not 1:1 ported there — this will be the first real 1:1 port of this file, including `colorHash`/
      `HSVtoRGB`/`RGBtoHSV`/`scale().ticks()` which jui-chart-vue explicitly never needed/ported).
- [x] `util/time.js` → `src/util/time.ts` — Ported all time utility functions: constants (MILLISECOND through WEEK), diff/add/format methods. `format()` uses full inline dateFormat implementation (no external library). Preserved original behavior including minute/hour/day/second/millisecond constants. 28 tests covering diff calculation, add operations, and format patterns.
- [x] `util/transform.js` → `src/util/transform.ts` — Ported Transform class with 2D and 3D matrix transformations: move/scale/rotate for 2D, move3d/scale3d/rotate3dz/rotate3dx/rotate3dy for 3D. Inlined radian() and matrix multiplication functions (matrix/deepMatrix/matrix3d/deepMatrix3d). Custom merge and merge2 methods for combining transformations. Preserves matrix-based computation order (right-to-left for combined transformations). 21 tests covering 2D/3D ops, matrices, and chaining.
- [x] `util/dom.js` → `src/util/dom.ts` — Ported DOM utilities: find/each/attr/remove/offset. Inlined typeCheck function (replaces util.base dependency) supporting string/array/object/function/date types. Handles both selector strings and element arrays/NodeLists. offset() includes fallbacks for missing getBoundingClientRect and timezone calculations. 32 tests covering selectors, iteration, attributes, and element measurements.
- [x] `util/scale.js` + `util/scale/linear.js` + `util/scale/ordinal.js` → `src/util/scale.ts` +
      `src/util/scale/{linear,ordinal}.ts` — cross-check against jui-chart-vue's `useScale.ts`
      (`createLinearScale`/`createOrdinalScale` already audited/hand-traced there). See the full
      "Progress log" writeup at the top of this section for the detailed cross-check results, the
      resolved `ordinal()` `rangePoints`-invert discrepancy finding, preserved bugs/deviations, and
      the real `this`-vs-arrow-function bug this port's own tests caught and fixed in itself.
- [x] `util/scale/log.js` → `src/util/scale/log.ts` — Full 1:1 port of log-scale factory. Wraps `linear()` with log/pow domain transformations. Preserved checkMax()/getNextMax() domain-boundary adjustment quirks exactly. Replaced upstream's `$.extend(newFunc, func)` (jQuery shallow copy) with `Object.assign()`, which is behaviorally identical for plain objects and preserves dynamic `this` dispatch in method chains. Log scale tests verify pow/log transformations work correctly, chaining via Object.assign succeeds, and both positive/negative domains are supported. 13 tests covering interpolation, invert, ticks, base changes, and domain adjustments.
- [x] `util/scale/time.js` → `src/util/scale/time.ts` — Full 1:1 port of time-scale factory. Wraps `linear()` with Date/timestamp domain handling. Reuses `util/time.ts`'s already-ported `add()` function and time-unit constants (`years`, `months`, `days`, `hours`, `minutes`, `seconds`, `milliseconds`, `weeks`) instead of a local duplicate - matches the reconciliation pattern established in Phase A batch 1's `scale.ts`. Implements both `ticks()` (evenly-spaced intervals) and `realTicks()` (calendar-aligned boundaries). Preserved original behavior including `realTicks()`'s multi-branch type checking for each unit. 16 tests covering Date object/timestamp domains, interpolation, tick generation with different units, calendar alignment, rangeBand computation, and invert round-trips.
- [x] `util/scale/circle.js` → `src/util/scale/circle.ts` — Simpler factory compared to ordinal/log/time, implements only domain/range/rangePoints/rangeBands/rangeBand (no callable function or numeric-index resolution). Preserved the original's no-op `function func(t) {}` and the unused-in-original `padding`/`outerPadding` parameters for `rangeBands()`. No quirks or bugs to preserve (design is straightforward). 13 tests covering domain/range storage, rangePoints/rangeBands positioning with and without padding, rangeBand reporting, and method chaining.
- [x] `util/svg.js` + `util/svg/{base,base3d,element,element.path,element.path.rect,element.path.symbol,element.poly,element.transform}.js`
      → `src/util/svg.ts` + `src/util/svg/*.ts` — no existing reference (jui-chart-vue uses Vue SFC templates
      instead of an imperative SVG element builder); full independent port. See the "Progress log" writeup
      above for the full class-chain design, the registry-sharing-bug finding (not preserved, per Phase 0
      rules 1/2/4) vs. the genuinely-preserved `element.path.symbol.ts` `join()`-shadowing bug, and every
      other preserved quirk/bug with its test.
- [x] `util/canvas/base.js` → `src/util/canvas/base.ts` — cross-check against jui-chart-vue's
      `canvasPrimitives.ts` (jui-chart-vue deliberately wrote its own minimal primitives rather than porting
      this whole file — see jui-chart-vue's Phase E policy notes; this is the first real 1:1 port of it, no
      shared test-oracle values existed to reuse — verified independently via a recording mock context. See
      the "Progress log" writeup above for the preserved `drawPage()` `ReferenceError` bug).
- [x] `util/canvas/hidpi.js` → `src/util/canvas/hidpi.ts` — jui-chart-vue explicitly evaluated and declined to
      use this (global-prototype-monkeypatching approach judged unsafe for a component library / SSR-
      incompatible; see jui-chart-vue's Phase E entry for `useCanvasChart.ts`). Ported faithfully anyway
      (full-scope goal), but jui-chart-vue's own DPR handling should NOT be migrated to depend on it — that
      decision stands, documented as a deliberate non-migration in the "Progress log" writeup above (which
      also covers the preserved `isPointinPath`/`isPointinStroke` typo bug and jsdom testability limits).

## Phase B — Base engine layer (`base/`)

Depends on Phase A. `base/base.js`'s registry-only parts are dropped per Phase 0 rule 1/4; its `util.base`
non-registry members (if any turn out to be real product logic, not just OOP scaffolding) get preserved.

### Progress log — `base/axis.js`

Ported to `src/base/axis.ts` as a real `class Axis`, constructor kept 1:1 (`chart, originAxis,
cloneAxis`) and every public method name kept 1:1 (`getValue`/`reload`/`area`/`padding`/`get`/
`set`/`updateGrid`/`update`/`screen`/`next`/`prev`/`zoom`/`isFull3D`, plus the static
`Axis.setup()` defaults factory). Co-located `axis.spec.ts`, 33 tests, all passing.

**Class structure**: every private closure in the original (`drawGridType`/`drawMapType`/
`setScreen`/`setZoom`/`createClipPath`/`checkAxisPoint`/`setAxisMouseEvent`/`drawAxisBackground`/
`init`) became a private class method closing over `this` instead of `self`/constructor-scope
vars. Two exceptions, hoisted to module-scope exported functions instead: `getRate()` (genuinely
pure - only ever touches its own two params) and, initially, `calculatePanel()` - **this port's
own re-verification caught and reverted that second hoist**: `calculatePanel()` actually calls
`chart.area('width')`/`chart.area('height')` directly (not `a.width`/`a.height`) to resolve every
one of `a.x`/`a.y`/`a.width`/`a.height`'s possible percentage strings, so it genuinely closes over
the constructor's `chart` parameter and stayed a private method for fidelity; only `getRate()`
ended up hoisted (deviation documented in its own doc comment - unlike every other private helper,
it never referenced instance state even in the original).

**The grid/map dependency-boundary decision** (this task's central design call): the original
resolves a concrete `Grid`/`Map` constructor via the dropped string-keyed registry
(`jui.include("chart.grid." + type)` / `jui.include("chart.map")`). Neither `grid/*.js` (Phase C)
nor `base/map.js` (excluded from this task, ported separately) exist as TS modules yet, so real
`import`s aren't possible without a premature/circular dependency, and Phase 0 rule 1 rules out
reproducing the string registry as-is. Resolution: `drawGridType()`/`drawMapType()`'s own logic
(merge `GridConstructor.setup()` defaults via `extend(cfg, ctor.setup(), true)`, construct, wire
`chart`/`axis`/`grid`/`svg` onto the instance, call `.render()`, position the returned root via
`translate()`, stamp `.type`/`.root` onto the returned scale) is fully implemented, unchanged from
the original - only the "which concrete class for this type string" lookup is abstracted behind
two small structural interfaces this file exports: `GridConstructor`/`GridInstance` (keyed by
grid-type string via a new `AxisChart.gridTypes: Record<string, GridConstructor>` field) and
`MapConstructor`/`MapInstance` (a single `AxisChart.mapType?` slot, mirroring the original's one
unconditional `jui.include("chart.map")`). **Phase C's `grid/*.ts` files and the separately-ported
`base/map.ts` need to satisfy `GridConstructor`/`MapConstructor`** (constructible as `new
Ctor(chart, axis, options)`, exposing mutable `chart`/`axis`/`grid` (or `map`)/`svg` fields, and a
`render()` method returning `{ root: TransElement; scale: GridRenderedScale }`) - not blocked on
either being done first; whatever assembles the real chart later builds the `gridTypes` map out of
real `import`s (`import { BlockGrid } from '../grid/block'`, etc.), not a runtime registry.

**The chart dependency**: `chart` (this file's other structural unknown, since `base/builder.ts`
is being ported concurrently by a different task) is likewise typed as a minimal `AxisChart`
interface covering only what `axis.js` itself calls (`area()`, `svg`, `index`, `appendDefs()`,
`theme()`, `isRender()`/`render()`, `on()`/`emit()`, plus `gridTypes`/`mapType` above) - not the
full `base/builder.js` surface. `chart.svg` is typed as the REAL, already-ported `util/svg.ts`
`SVG` class (Phase A), not an interface, since `chart.svg.rect(...)`/`.clipPath(...)`'s actual
`TransElement`/`Element` return types are needed directly.

**Cross-check against jui-chart-vue's `useAxis.ts`/`useChartLayout.ts`**: confirmed match, no
discrepancy. `useChartLayout.ts`'s `area` computed was already Phase-F-audited against this exact
file's `calculatePanel()` (`x:left, y:top, x2:width-right, y2:height-bottom`, width/height
re-derived from the padded box) - reused its own hand-traced test case directly: a 400×300 chart
with padding `{top:20,right:24,bottom:32,left:48}` produces `{x:48,y:20,x2:376,y2:268,width:328,
height:248}` in both `useChartLayout.spec.ts` and this port's `axis.spec.ts`. `useAxis.ts`'s
`resolveAxisOrient()` (x→top/bottom default bottom, y→left/right default left) matches
`drawGridType()`'s orient-coercion exactly, confirmed by this port's own orient-defaulting tests.
No discrepancy found in either direction.

**Quirks/bugs found and preserved** (Node/hand-traced, not "fixed" per Phase 0 rule 6):
  - **`init()`/`reload()` paging desync**: `init()` calls `setScreen(self.page)` (or `setZoom`),
    computing REAL `start`/`end`/`page`/`data` - but immediately afterward, unconditionally calls
    `self.reload(cloneAxis)`, whose own last lines do `this.start = options.start; this.end =
    options.end; this.page = options.page;`. Since `cloneAxis` is never updated by `setScreen`/
    `setZoom` (which only mutate the live instance), those three fields snap back to their raw,
    pre-paging config values (typically `0`/`0`/`1`) right after construction, while `this.data`
    (never touched by `reload()`) is left holding the real, already-paged slice - so immediately
    after `new Axis(...)`, `axis.data` and `axis.start`/`axis.end`/`axis.page` are silently out of
    sync with each other until the next explicit `screen()`/`next()`/`prev()`/`zoom()` call. A
    genuine, previously-undocumented finding (not obvious from a single read - required tracing
    the exact call order in `init()` against `reload()`'s own field-overwrite tail). Tested.
  - **`this.x`/`.y`/`.z`/`.c` are two-phase-shaped**: mid-`reload()`, `_.extend(this, {x:
    options.x, ...})` aliases `this.x` to the SAME object as `cloneAxis.x` (or `originAxis.x`, if
    that's what's threaded through) - `drawGridType()` then mutates that shared object in place
    (defaulting `.orient`/`.type`, merging `Grid.setup()`'s defaults) - but by the time `reload()`
    returns, `this.x` has been REASSIGNED to that grid's rendered scale (`elem.scale`, stamped
    with `.type`/`.root`), a completely different shape than the config object it started as.
    `axis.get("x")` (which reads `cloneAxis[type]`, untouched by the reassignment) is what still
    returns the config - now defaulted/merged in place, since it's the same mutated object -
    while `axis.x` itself holds the rendered scale. Typed `unknown` in this port (rather than
    picking one shape and lying about the other) with a doc comment explaining both phases. Not a
    bug exactly (this is how the original's own API genuinely behaves), but a real, non-obvious
    two-shape trap for any later Phase C/E code reading `axis.x` vs `axis.get("x")`. Tested (both
    the config-object-mutated-in-place case and the rendered-scale-typed case).
  - **`Element.attr(key)`'s already-documented Phase A quirk** (falsy cached values, e.g. `0`,
    fall through to `getAttribute()`, which always returns a string) surfaces concretely here too:
    `drawAxisBackground()`'s rect `x`/`y` (`area.x - padding.left`, often exactly `0`) read back
    as the string `"0"`, not the number `0`, via `.attr("x")`. Confirmed in `axis.spec.ts`, not a
    new bug (inherited from `util/svg/element.ts`'s Phase A finding, just newly exercised here).
  - `getValue()`, `checkAxisPoint()` (strict `>`/`<` boundary comparisons - a point exactly on the
    axis edge is NOT considered inside), and `set()`'s `isReset`-vs-merge branching (deep-clone-
    and-replace vs. recursive `extend()`) all ported verbatim with no behavior changes found.

**`util.base` dependency**: `extend`/`deepClone`/`typeCheck` are genuine product logic here (config
merging/cloning in `reload()`/`set()`/`update()`/`init()`, not OOP scaffolding), so - per Phase 0
rule 4's "verify before dropping" instruction - all three got their own private, unexported
Node-cross-checked ports inside `axis.ts` (same convention `util/dom.ts`/`util/math.ts`/
`util/svg/element.ts` already established for their own private `typeCheck` copies, extended here
to `extend`/`deepClone` too since this file actually needs them). `axis.js` itself never calls
`util.scale`/`util.math` directly (only `grid/*.js` does, per the original) - Phase A's scale/math
modules aren't imported by this file at all, despite being available.

**Verification**: `axis.spec.ts`, 33 hand-traced/Node-cross-checked tests covering `getRate()` in
isolation, `calculatePanel()` via `area()` (including the reused jui-chart-vue value above, an
integer-`padding` case, and two percentage-resolution cases), grid wiring (`drawGridType()`'s
orient defaults + config mutation-in-place + `GridConstructor.setup()` merge + root positioning
via a `translate()` assertion), `drawMapType()`'s null-when-unconfigured path, full pagination
(`setScreen`/`setZoom`/`screen`/`next`/`prev`/`zoom`/`update`, including boundary-clamping and the
`chart.isRender()`-gated re-render calls), `get`/`set`/`updateGrid` (merge vs. reset-replace
semantics), `isFull3D()`/`getValue()`, the full mouse-event dispatch surface (`chart.on`/`emit`
wiring for mouseover/mouseout/mousemove/mousedown/mouseup/click/dblclick/rclick/mousewheel, plus
the strict-boundary-exclusion case), and `drawAxisBackground()`/`createClipPath()`'s attribute/id
generation. `npm run typecheck`, `npm run test` (389 tests across 25 spec files, 0 failures - the
56 beyond this batch's own 33 belong to Phase A plus the concurrently-landed `base/vector.ts`/
`base/draw.ts`), and `npm run build:lib` all pass clean. **Note**: `src/base/draw.spec.ts` has a
pre-existing `npm run typecheck` failure (`Property 'perspective' does not exist...`, 2 errors) -
this belongs to the concurrent agent's in-progress `base/draw.ts`/`base/vector.ts`/`base/plane.ts`/
`base/builder.ts` work (none of which this task touched, per its own instructions), not this
batch; `npm run build:lib` itself still passes clean since it only type-checks `src/index.ts`'s
own transitive import graph (which doesn't yet include `draw.ts`), and `npm run test` passes in
full regardless (`tsc` errors don't block `vitest`). `src/index.ts` updated with `export { Axis,
getRate }` plus the `AxisChart`/`AxisOptions`/`AxisPadding`/`AreaBox`/`AreaInput`/
`GridConstructor`/`GridInstance`/`GridRenderedScale`/`MapConstructor`/`MapInstance` interfaces (as
named exports per this task's own suggested form, not a namespace - no collision risk with any
Phase A symbol).

### Progress log — `base/vector.js`, `base/draw.js`, `base/plane.js`, `base/builder.js`

Ported to `src/base/vector.ts`, `src/base/draw.ts`, `src/base/builder.ts`, `src/base/plane.ts`.
Co-located spec files: `vector.spec.ts` (17 tests), `draw.spec.ts` (19 tests), `builder.spec.ts`
(37 tests), `plane.spec.ts` (14 tests) — 87 new tests. Full repo suite: 440 tests across 27 spec
files, 0 failures (this batch's 87 alongside the concurrently-landed `axis.spec.ts` batch and all
prior Phase A work). `npm run typecheck`, `npm run test`, and `npm run build:lib` all pass clean
against the full combined tree (29 modules now bundled into `dist-lib`, up from 25 before
`src/index.ts` was updated with this batch's exports).

**Real dependency order (different from the file-list order assumed by the checklist)**:
`vector.js` (`extend: null`) has zero dependencies on anything, including `util/base.js` — the
simplest file in the whole `base/` tree, ported first. `draw.js` (`extend: null`) only needs
`util.base`'s `typeCheck`/`startsWith` (inlined per-file, same treatment `util/dom.ts` already
established) — no dependency on `vector.js`, `axis.js`, or `builder.js`, so it was ported second,
independent of the other three. **`builder.js` and `plane.js` are NOT independent of each other
the way the checklist's ordering implies**: `plane.js` is a preset "3D scatter chart" UI built
*entirely on top of* `chart.builder` (never touches SVG/axis/brush classes itself — it only
assembles a declarative `{axis, brush, widget}` config object and hands it to `Builder`), so
`builder.ts` had to be ported before `plane.ts`, not after. Both `builder.js` and `plane.js` also
have a **real, structural dependency on `base/core.js`** (`extend: "core"` on both — excluded from
this iteration, future Phase B item) and `builder.js` additionally on `base/axis.js` (`import axis
from "./axis.js"`, concurrently owned by a different agent this same iteration) — see the
dedicated subsection below for how this was resolved.

**Extend chains**: `Vector`/`Draw` are standalone (`extend: null` in the original — not part of
any chain themselves, though `Draw` is *designed to be extended* by every future `chart.brush.*`/
`chart.widget.*`/`grid.*` class, none of which are ported yet: Phase C/E of this project).
`Builder`/`Plane` both have `extend: "core"`. Per Phase 0 rule 2 all four are ported as real
classes with constructor params/method names kept 1:1 with the original (e.g. `Draw.calculate3d`,
`Builder.drawBrush`, `Plane.commit` — same names, same params).

**RECONCILIATION ADDENDUM (`base/core.js` has since landed)**: point 1 below (the "Core stand-in")
has been resolved exactly as its own "Intended reconciliation" note predicted — `Builder`/`Plane`
now really `extends Core` (`src/base/core.ts`), and the stand-in fields/`mount()` duplicated on each
class were deleted in favor of real inheritance. See the "Progress log — base/core.js (+
builder.ts/plane.ts reconciliation)" writeup (further down this section) for the full detail,
including the one real (additive, not cosmetic) behavior change this uncovered: `options.event`
binding and `Core.setup()`'s `{event: {}}` default now genuinely apply, which the pre-`Core`
stand-in had no way to reproduce. Points 2 (`Axis`/`registerAxis()`) and 3
(`brush`/`widget`/`theme`/`icon` registration functions) below are UNCHANGED by this reconciliation
- still open, unrelated follow-ups.

**The `base/core.js` / `base/axis.js` structural gap (the main engineering decision this batch had
to make) — full detail lives in `builder.ts`'s own header comment, summarized here**: `Builder`'s
real public construction contract (`jui.include("chart.builder")` resolving to
`Core.init({type, class: Builder})` — a bound factory that allocates the instance, wires
`root`/`options`/`event`/`index`, merges `options` against `Builder.setup()`, and only then calls
the `init()` lifecycle hook this file defines) lives entirely in `base/core.js`, not in
`builder.js` itself. Since `base/core.js` is excluded from this iteration (future Phase B item)
and `base/axis.js` was being concurrently ported by a different agent (also excluded here), three
things were resolved as documented, temporary stand-ins rather than silently skipped or invented
as full ports:
  1. **Core-provided fields/lifecycle** (`root`/`options`/`event`/`index`/`emit`/`off`, the
     `options`-vs-`setup()` merge, invoking `init()`): reproduced directly as fields/methods on
     `Builder`/`Plane` themselves — explicitly NOT a port of `base/core.js`'s actual logic, just
     enough surface for these files' own real, 1:1-ported methods to type-check and run in
     isolation. A `mount(root, options)` method on each class (NOT part of the original 1:1
     method-name mapping — clearly not misrepresented as such) stands in for what Core's factory
     does today. Intended reconciliation once `base/core.ts` lands: `class Builder extends Core` /
     `class Plane extends Core`, delete `mount()`.
  2. **`Axis`** (`JUI.include("chart.axis")` in `drawAxis()`): resolved through an exported
     `registerAxis(ctor)` function + `AxisLike`/`AxisConstructor` interfaces (capturing only the
     shape `Builder` actually calls: `new Axis(chart, rawOptions, mergedOptions)`, `.data`,
     `.reload(options)`) instead of a static `import { Axis } from './axis'`, since `axis.ts`
     doesn't exist in the working tree at the time this batch ran. `drawAxis()` throws a clear,
     named error if nothing has called `registerAxis()` yet, rather than a silent registry-miss.
     Intended reconciliation once `axis.ts` lands: a real import, deleting the registry
     indirection entirely.
  3. **`chart.brush.*`/`chart.widget.*`/`chart.theme.*`/`chart.icon.*`** (all `JUI.include(...)`
     string lookups in the original): this is `Builder`'s own real, declarative-API product
     behavior (resolving a config array's `type: "..."` strings to constructors at render time IS
     the entire point of the "chart.builder" feature) — not OOP `inherit()`/`typeCheck()`
     scaffolding, so Phase 0 rules 1/4 don't call for dropping it outright. But the *concrete*
     things it resolves don't exist as TS modules: `chart.brush.*`/`chart.widget.*` are Phase C-E
     of this project (unstarted); `chart.theme.*`/`chart.icon.*` aren't even part of
     `juijs-graph`'s own source tree at all (confirmed: `ls src/theme src/icon` on the original
     repo — neither directory exists; both are supplied by the downstream `jui-chart` consumer
     package). Resolved via small explicit, typed registration functions
     (`registerBrush`/`registerWidget`/`registerTheme`/`registerIcon`, each backed by a `Map`)
     instead of reproducing the original's implicit global string-keyed registry. Nothing calls
     them yet; any chart config referencing an unregistered type throws a clear, named error at
     that exact call site (verified in `builder.spec.ts`) instead of a registry lookup silently
     returning `undefined` and crashing later with a confusing message.

The original's module-level `_.resize(function(){ ... JUI.get("chart.builder") ... }, 1000)` (a
single global debounced `window.resize` listener walking the OLD registry's "chart.builder"
instance list, calling `.resize()` on each) was **dropped outright, not stood in for**: `Builder`
itself never defines an instance `.resize()` method anywhere in `builder.js`, so this dispatcher
is inert dead machinery even in the original, independent of the registry it rode on — same
"registry artifact, not reachable product logic" category Phase 0 rules 1/2/4 already authorize
dropping (per this project's own Phase A precedent for the `inherit()` prototype-sharing bug).
`Builder.index` (originally `JUI.size()`, a global registry count) is replaced with a private
per-module incrementing counter — preserves the observable "unique incrementing per-instance id"
behavior without the registry it rode on.

**`calculate3d()` cross-check (jui-chart-vue's Phase E `dot3d.js`/`usePolygon3d.ts` writeup) —
CONFIRMED, carried forward exactly**: re-read jui-chart-vue's `PORT_STATUS.md` (~L5620-5633) and
the original `draw.js` source side by side. Both agree precisely: `calculate3d()`'s
`list[i].rotate(Math.max(w, h, d), r, x + w/2, y + h/2, d/2)` call passes `Math.max(plotWidth,
plotHeight, axis.depth)` as the `depth` argument — **not** `axis.depth` directly — while the
rotation center's `z` is `axis.depth / 2`, a genuinely *different* value in general (only equal
when `axis.depth` already happens to be the max of the three). `draw.spec.ts` has a dedicated test
proving the two values diverge (`w=1000, h=200, d=40` → depth param `1000`, center z `20`), plus a
case where they coincide, plus the non-integer `degree.x/y/z` → `0` defaulting and the
`.perspective` stamping on every rotated object.

**Other quirks/bugs found and preserved byte-faithfully (documented at their exact call site,
Node/hand-verified against the literal original)**:
  - `vector.ts`'s `dotProduct(vector)`: despite the name, does **not** return the dot product —
    it returns `Math.acos(dot / (|a||b|))`, the ANGLE in radians between the two vectors (e.g.
    `new Vector(1,0,0).dotProduct(new Vector(0,1,0))` is `Math.PI/2`, not `0`). A genuine
    misnomer, kept exactly including the name. Tested.
  - `vector.ts`'s `normalize()`: mutates `this` in place and returns `undefined` — unlike
    `add`/`subtract`/`multiply`/`crossProduct`, not chainable, and produces `NaN` components for
    the zero vector (no magnitude-zero guard). Tested.
  - `builder.ts`'s `isFullSize()`: the `if` branch's own condition (`width == "100%" || height ==
    "100%"`) is dead — **both** branches `return true`, so this method always returns `true`
    regardless of the configured width/height. Node/hand-verified against the literal original,
    tested with both a fixed-pixel and an actual-100% config to prove the bug is unconditional.
  - `plane.ts`'s `push(data)`: silently no-ops (no error, no state change) for any non-array
    `data` argument (`if(!_.typeCheck("array", data)) return;`). Tested.
  - `plane.ts`'s `render()` **double-render quirk**: in the original, `builder(this.root, {...})`
    (Core's factory) already triggers one full render as part of construction, and `plane.js`
    then calls `chart.render()` again explicitly right after — an existing, harmless-but-real
    double initial render, preserved automatically here (`Builder.mount()` → `init()` → one
    `render()` call, then `Plane.render()`'s own explicit `chart.render()` call at the end,
    exactly mirroring the original's two calls).
  - `builder.ts`'s `theme(key, value, value2)`'s 3-argument form and `color(key, colors)`'s
    out-of-range integer-index clamp-to-last (no wraparound) are both preserved exactly and
    tested.

**jsdom testability note**: `Plane.render()` always builds its `Builder` chart with `canvas: true`
(hardcoded in the original) — jsdom's `HTMLCanvasElement.getContext('2d')` returns `null` without
the optional `canvas` npm package this project doesn't depend on (same documented limitation as
this project's existing `canvas/hidpi.spec.ts`/`canvas/base.spec.ts`). `plane.spec.ts` stubs
`HTMLCanvasElement.prototype.getContext` with a minimal fake context (`restore`/`save`/
`clearRect`/`translate`/`drawImage` no-ops) so `Builder`'s canvas setup/reset/double-buffer-draw
calls have something to call methods on; `HidpiUtil.apply()` itself is a no-op against real or
fake contexts alike under jsdom regardless, since `pixelRatio` computes to exactly `1` there,
which trips `apply()`'s own early-return guard (see `hidpi.ts`).

### Progress log — `base/animation.js` (ported) + `base/collection.js`/`base/manager.js` (evaluated, not ported)

**`base/animation.js` → `src/base/animation.ts`**: ported as a real `Animation` class, constructor
kept 1:1 in spirit (`selector, options`) and every public method name kept 1:1
(`init`/`run`/`stop`/`set`/`update`/`render`, plus the static `Animation.setup()` defaults
factory). Co-located `animation.spec.ts`, 21 tests, all passing standalone
(`npx vitest run src/base/animation.spec.ts`).

**The `extend: "core"` structural gap**: same category as `builder.ts`'s own documented "Core
stand-in" gap (this file was ported before the concurrently-landed `base/core.ts` existed).
Checked what `animation.js`'s own methods actually use from Core: **nothing** — Core's real
surface (`emit`/`on`/`off`/`setOption`/`destroy`, `this.event`) is never referenced anywhere in
this file's own `init`/`run`/`stop`/`set`/`update`/`render` bodies, and even `this.options`/
`this.selector` aren't defined by Core's own constructor either (those are wired externally by the
dropped registry's `jui.createUIObject`, confirmed by reading `base/base.js`'s implementation).
So `selector`/`options` became real constructor parameters instead, and the unused Core event-bus
surface was not reproduced. Now that `base/core.ts` has landed (concurrently, after this file was
written), `class Animation extends Core` could be revisited for real, but nothing behavioral
changes by doing so — confirmed above that this file never needed any Core member. Left as a
follow-up note rather than reopened in this same pass, since it wasn't this task's file to touch.

**The `builder(selector, opts)` dependency**: resolved via a real `import { Builder } from
"./builder"` (already ported, concurrently, by a different task this same iteration) rather than a
structural stand-in interface — `Builder` was complete and usable by the time this file needed it.
`resolveBuilderTarget()` reproduces `base/core.js`'s `UICore.build` element-resolution exactly
(string selector via `find()`, a literal DOM object passed through as-is, or a freshly-created
`<div>` fallback for anything else — mounting one `Builder` per matched element).

**A genuine, previously-undocumented finding**: `animation.js`'s own methods (`run`/`set`/
`update`/`render`) all call `this.builder.<method>(...)` as if `this.builder` is always a single
chart instance — but `UICore.build` actually returns `null` when the selector matches zero
elements, or a **raw JS array** when it matches more than one (the array only gets wrapped for the
registry's own bookkeeping, not reshaped into something `animation.js` could actually use). Both
cases were already broken in the original: calling `.setCache`/`.axis`/`.render` on `null` or a
plain array throws a `TypeError` on first use, not a port-introduced bug. This port reproduces
both faithfully (`Animation.builder` is typed as `Builder` for the intended/working case, but is
honestly documented as potentially holding `null`/`Builder[]` at runtime) rather than silently
narrowing to only the single-match happy path. Tested (zero-match and multi-match cases both
assert the resulting `TypeError` on `render()`/`set()`/`update()`).

**`tpf===1` skip-first-frame guard** (the reason jui-chart-vue's `dot3d.js` Phase E writeup flagged
this file): `run()` computes `tpf = (currentTime - prevTime) / 1000` and clamps it to `1` whenever
more than a second has elapsed since the last *rendered* frame (not the last `run()` call — a
nonzero `interval` can skip render cycles without resetting `prevTime`). Ported verbatim, tested
with both an under-1s and an over-1s gap, and with a nonzero `interval` to confirm the render
branch (and therefore `prevTime`/`tpf`/`fps`/the callback) is skipped while the RAF loop itself
keeps scheduling regardless. No obligation to retrofit jui-chart-vue's `useAnimationFrameLoop.ts`
to use this — that non-migration decision stands, this is a Phase F question once there's a real
migration target to evaluate against.

**`Animation.setup()`**: Node-cross-checked the private `extend(origin, add, skip)` port's exact
semantics against the real `util/base.js` source (not assumed): `skip === true` means "fill a key
on `origin` only when `origin` doesn't already define it" — so `extend({render:false, canvas:true,
interval:0}, Builder.setup(), true)` lets Animation's own three overrides win over Builder's
`render:true`/`canvas:false` defaults (since `origin` already defines those keys), while every
other Builder default (`width`/`height`/`padding`/`theme`/`axis`/`brush`/`widget`/etc., which
Animation's own base object doesn't define) gets merged in. Tested directly against this exact
merge.

**jsdom testability note**: Animation's real default is `canvas: true` (preserved from the
original) — mounting a `Builder` with `canvas: true` under jsdom throws a `TypeError` inside
`Builder.init()`'s canvas double-buffer setup, because jsdom's `getContext("2d")` returns `null`
(no `canvas` npm package dependency; same documented limitation as `util/canvas/hidpi.ts` and
`plane.ts`'s own testability note above). Unlike `plane.spec.ts` (which stubs
`HTMLCanvasElement.prototype.getContext`), most of `animation.spec.ts` passes `canvas: false`
explicitly to keep its own tests focused on `Animation`'s logic rather than re-exercising
`Builder`'s already-covered canvas machinery — but one dedicated test exercises the real `canvas:
true` default once, asserting the `TypeError`, so the limitation is documented rather than quietly
avoided everywhere.

**Verification**: `npm run typecheck` and `npm run build:lib` both pass clean against the full
combined tree (32 modules now bundled into `dist-lib`). `npm run test` shows 41 failures at time of
writing, entirely in `builder.spec.ts`/`plane.spec.ts` — a transient consequence of `base/core.ts`
landing concurrently mid-task and `builder.ts` being actively rewired onto it (confirmed via file
mtimes and stack traces pointing into `builder.ts`/`core.ts`, not `animation.ts`/`animation.spec.ts`
anywhere) — not this batch's concern per this task's own instructions, and confirmed not caused by
this file: `npx vitest run src/base/animation.spec.ts` passes 21/21 standalone regardless. `src/
index.ts` updated with `export { Animation }` and `export type { AnimationOptions }`.

**`base/collection.js` — evaluated, concluded to be a pure registry artifact, NOT ported (no
`src/base/collection.ts` created)**. Evidence:
  - The whole file is 20 lines: `UICollection(type, selector, options, list)` stores three
    metadata fields (`type`/`selector`/`options`), `Object.create(Array.prototype)`-subclasses
    `Array` (the pre-ES6 way to make an array-like subclass), pushes every entry of `list` onto
    itself in the constructor, and defines one method, `destroy()`, which just fans out to each
    wrapped item's own `.destroy()`.
  - Grepped the *entire* `juijs-graph/src` tree for every reference to `collection.js`: the only
    consumer, anywhere, is `base/core.js`'s `UICore.build` — `UIManager.add(new
    UICollection(UI.type, selector, options, list))` — where `list` is exactly the array of chart
    instances `UICore.build` just constructed for one `selector` match (one instance per matched
    DOM element). `UICollection`'s entire purpose is to group "every chart instance created from
    one `new Chart(selector, options)`-equivalent call" into a single object so `base/manager.js`'s
    global registry (`UIManager.instances`) can later look them up together by shared
    `.selector`/`.type` (`manager.get(key)`/`manager.emit(key, ...)`).
  - No chart-specific business logic exists anywhere in the file — no computation, no rendering, no
    state transitions specific to charts. It is pure registry bookkeeping, and it is meaningless
    without `base/manager.js`'s registry (itself meaningless without the whole `jui.use()`/
    `jui.include()`/`jui.createUIObject()` machinery Phase 0 rule 1 already authorizes dropping
    wholesale) and `base/core.js`'s dropped `UICore.build`/`UICore.init` static factories (which
    `base/core.ts`'s own header comment, landed concurrently this same iteration, independently
    reaches the identical conclusion about — see its "WHAT'S REAL 1:1 PRODUCT LOGIC vs. REGISTRY
    GLUE" section, which explicitly calls out `base/manager.js`/`base/collection.js` as registry
    glue too).
  - In the real-import model, "hold a reference to the chart instance(s) my selector produced" is
    just... holding the reference the constructor call already returned — there is no more "look
    them up later by selector string from anywhere in the app" need `UICollection` existed to
    support. Nothing worth salvaging as a reusable type.
  - Same treatment as `util/base.js`'s `inherit()`/browser-sniffing scaffolding in Phase A (never
    got its own `util/base.ts` file either): documented and dropped, not ported.

**`base/manager.js` — evaluated, concluded to be a pure registry artifact, NOT ported (no
`src/base/manager.ts` created). This is the more consequential judgment call of the two.**
Evidence:
  - **The original's own author encoded it as a global singleton, not a reusable class**: `var
    UIManager = new function() { var instances = [], classes = []; ... }` — an immediately-invoked
    anonymous constructor, assigned once to a module-level `var`. Unlike every other `base/*.js`
    file in this project (all `function UI() {...}`, designed to be `new`'d once per chart
    instance), `manager.js` is architecturally a singleton *in the original source itself* — strong
    independent evidence that "per-chart-instance" was never the design intent here.
  - **Every method is generic array CRUD over two registry-populated lists** (`instances`/
    `classes`), with zero chart-domain logic: `add`/`addClass` push; `get`/`getClass`/`getAll`/
    `getClassAll` read by index or string match; `remove`/`shift`/`pop` splice/shift/pop; `size`
    counts. None of it is reachable without something populating `instances`/`classes` first — and
    the only caller that ever does, anywhere in the whole source tree (grepped and confirmed), is
    `base/core.js`'s dropped `UICore.build`/`UICore.init`.
  - **`create(type, selector, options)` is the string-keyed dynamic-instantiation pattern Phase 0
    rule 1 explicitly names as the thing being dropped**: it looks up a previously-`addClass`'d
    constructor by a `type` string and calls it — exactly the `jui.include("some.string")`
    indirection real ES `import`s replace outright (`import { BlockGrid } from '../grid/block'`
    instead of `manager.create("chart.grid.block", ...)`).
  - **`emit(key, type, args)` is a *global, selector-or-type-string-keyed dispatcher* that
    delegates to each matching instance's own, already-real, already-independently-useful
    `.emit(type, args)`** — it does not implement any event-bus logic itself, it just finds which
    previously-registered instances match a string key and forwards to them. The genuinely useful
    per-instance event bus (`this.event` array, `on`/`off`/`emit` scoped to one chart instance) is
    NOT in this file — it lives entirely in `base/core.js`'s `UICore` (confirmed by reading
    `core.js`: its `emit`/`on`/`off` never reference `base/manager.js` or `base/collection.js` at
    all), a *different*, separate file that's explicitly out of this task's scope (a concurrent
    agent's assignment this same iteration, which reached the same conclusion independently in its
    own header comment). So the task prompt's suggested alternative — "a per-Chart-instance event
    bus rather than a global one" — already exists, as `Core.emit`/`.on`/`.off` in `src/base/
    core.ts`, and always did; there is nothing of that shape to extract from `manager.js` itself,
    because `manager.js` never contained it in the first place. This distinction (global
    selector-dispatcher in `manager.js` vs. real per-instance bus in `core.js`) is the crux of this
    judgment call and is worth keeping precise for future readers.
  - **`main.js` confirms `manager.js` WAS the library's real, documented, public global API
    surface**, not an internal implementation detail that merely resembles a registry:
    `_.extend(jui, manager, true)` merges every `UIManager` method directly onto the default-
    exported `jui` object, so consumers call `jui.get("#chart")`, `jui.emit("#chart", "click",
    [...])`, `jui.create("chart.column", ...)`, etc. from application code. This is precisely the
    "global, string-keyed registry" Phase 0 rule 1 says to drop entirely, not an edge case worth
    hedging on.
  - Net conclusion: nothing in `manager.js` is real per-chart-instance product logic distinct from
    the registry pattern already authorized for removal. The one thing worth keeping under a
    similar name (a per-instance event bus) already exists elsewhere, unrelated to this file.

### Progress log — `base/core.js` (+ `builder.ts`/`plane.ts` reconciliation)

Ported to `src/base/core.ts` as a real `class Core<TOptions extends CoreOptions>`, the base every
`extend: "core"` class ultimately extends. Co-located `core.spec.ts`, 20 tests, all passing.

**What's real 1:1 product logic vs. registry glue (the central call this file had to make)**:
`core.js`'s `component()` factory returns two very different things, bundled together only because
of how the old registry worked. (1) `UICore` the constructor's own closures — `this.emit`/`.on`/
`.off`/`.setOption`/`.destroy` — a genuine, self-contained, per-instance event bus (`this.event`,
an array on the instance) with zero reference to `base/manager.js`'s global registry or
`base/collection.js` (confirmed: `core.js` imports neither) — ported 1:1 as real `Core` instance
methods. (2) `UICore.build(UI)`/`UICore.init(UI)` — static factory helpers used ONLY by the
registry's `jui.redefineUI()` to turn a `{name, class}` descriptor into the public
`jui.include("chart.builder")` factory (`chart.builder(selector, options)`: DOM-selector-based
multi-element instantiation via `base/base.js`'s `createUIObject`, wired into `base/manager.js`'s
global instance list via `UIManager.add`/`addClass` and `base/collection.js`'s `UICollection`).
Tracing what these two methods actually do confirms they're 100% registry glue — the same
"registry artifact, not reachable product logic" category Phase 0 rules 1/2/4 already authorize
dropping (same precedent as `util/svg/element.ts`'s `inherit()` prototype-sharing bug and
`builder.ts`'s dropped module-level `_.resize()` dispatcher) — reinforced here by the concurrent
`manager.js`/`collection.js` evaluation reaching the identical conclusion independently (both
writeups above cross-reference each other). `UICore.build`/`UICore.init` are therefore NOT ported;
`base/base.js` itself (home of `createUIObject`, the registry engine) is not and will never be a
ported file at all per Phase 0 rule 1.

**The construction/lifecycle gap this creates, and how it's resolved**: `createUIObject` wires
`root`/`options` (merged against the WHOLE `extend` chain's `setup()`s, leaf-first)/`event`/
`index`/`timestamp` onto each instance, and binds every `options.event` entry via `.on()`, BEFORE
the registry ever calls into `UICore`'s own constructor — real, necessary per-instance setup that
has to happen somewhere. Since that "somewhere" no longer exists (`base.js`/`manager.js`/
`collection.js` all out of scope), `Core` itself takes over via `mount(root, options)` — NOT a
method on the original `UICore` (documented, not misrepresented as 1:1), but the same bridging-
device name `builder.ts`/`plane.ts` had already independently invented as their own temporary
stand-in before this file existed. Promoting it onto `Core` (rather than duplicating it per
subclass, and per future Phase E `brush/core.js`/`widget/core.js`) is this file's central design
decision. `mount()`:
  1. wires `root`,
  2. merges `options` via `mergeOptions()` — a chain-length-agnostic walk of `this.constructor`'s
     real prototype chain (leaf subclass's own `static setup()` first, then each ancestor's up to
     and including `Core`, each applied with `skip: true` fill-missing-only semantics) — a faithful
     port of `base/base.js`'s recursive `getOptions()` walk, minus that function's registry-only
     "unknown option key throws" validation (relies on the old registry's own `Module.parent`
     bookkeeping, not reconstructible without `base.js`),
  3. binds every `options.event` entry via `on()` (real `createUIObject` behavior — the exact
     reason `Core.setup()`'s own default is `{event: {}}`),
  4. calls the subclass's `init()`.

**`destroy()` — preserved STRUCTURE, not preserved EFFECT (the other `inherit()`-registry-artifact
finding this file produced)**: literal transcription of `if(this.__proto__) { for (key in
this.__proto__) delete this.__proto__[key]; } }`. In the original, this is a severe bug rooted
entirely in the old registry's one-time prototype-seeding (`ctor.prototype = new superCtor()`,
called ONCE at module-registration time): since `UICore`'s constructor assigns `emit`/`on`/`off`/
`setOption`/`destroy` as OWN properties of `this` (not prototype methods), and `inherit()` makes
every `extend: "core"` subclass's ENTIRE prototype literally BE that one seed `UICore` instance,
`this.__proto__` for a real `Builder`/`Plane` instance IS that shared seed object — so calling
`.destroy()` on ANY one instance permanently deletes `emit`/`on`/`off`/`setOption`/`destroy` off
the object every instance of that class shares, breaking event handling for every other existing
AND future instance the moment any one instance is destroyed. Per Phase 0's explicit instruction
("this... registry artifact - don't reproduce it, just document if encountered"), NOT reproduced:
with a real `class Core`, methods are non-enumerable properties on `Core.prototype` (a language
guarantee for class-body method syntax), so `for...in Object.getPrototypeOf(this)` enumerates
nothing — the literal transcription is a verified, intentional no-op under real class semantics.
Tested in `core.spec.ts` (`destroy()` neither throws nor removes any method, on the same instance
or a sibling one — proving no cross-instance corruption).

**`off()`'s preserved quirk**: passing anything other than a `string` (remove-by-type) or a
`function` (remove-by-callback-identity) matches neither branch of the original's `if` for every
entry, so `this.event` collapses to `[]` — `off()`/`off(undefined)` unconditionally wipes ALL
registered events, not a no-op. Node/hand-verified against the literal original, tested.

**`emit()`'s preserved quirk**: every matching handler runs (not just the first), and the LAST
matching handler's return value wins (later handlers silently overwrite `result`) — tested.

**A real, self-caught bug during this file's own writing**: the first draft's inlined `typeCheck()`
helper (the same per-file convention `util/dom.ts`/`base/builder.ts`/etc. already use) omitted the
`"undefined"` case entirely. Since `extend()`'s `skip: true` branch relies on `typeCheck("undefined",
origin[key])` to detect "this key isn't set yet, fill it in", the omission silently broke `Core`'s
whole options-merge: `mergeOptions()` walked the full `setup()` chain correctly but never actually
wrote any key onto the result object, so every `Core`-mounted instance ended up with `options = {}`
regardless of what any `setup()` returned. Caught immediately by `core.spec.ts`'s own
`mount()`/`mergeOptions()` tests failing (`options.event` came back `undefined` instead of `{}`) and
by `plane.spec.ts`'s pre-existing `render()` tests failing with `TypeError: Cannot read properties
of undefined (reading 'path')` (`Builder.init()`'s `setVectorFontIcons()` reading `this._options.icon.path`
off an `icon` that no longer existed once `Builder.setup()`'s defaults stopped merging in). Fixed by
adding the missing `"undefined"` case; full suite re-verified green afterward. Documented here for
transparency, not a preserved-upstream-bug (this bug never existed in the original — `util.base`'s
real `typeCheck` always had the `"undefined"` case; this was a port-introduced regression, caught
before landing).

**`builder.ts`/`plane.ts` reconciliation**: both now genuinely `class ... extends Core<...>`,
replacing the documented temporary "Core stand-in" blocks (duplicate `root`/`options`/`event`/
`index` fields plus a local `mount()`) with real inheritance. `BuilderOptions`/`PlaneOptions` now
`extends CoreOptions`. `Builder` keeps its own `on(type, callback, resetType)` override (the
original DOES redefine `this.on`, confirmed by grep, to add `_handler.render`/`_handler.renderAll`
bookkeeping) but no longer duplicates `emit`/`off` (the original never redefines either — confirmed
by grep — so both are now genuinely inherited, unmodified, from `Core`). `Plane` overrides nothing
(the original only ever defines its own `init()`) — pure `extends Core<PlaneOptions>`. **One real
(not cosmetic) behavior change, precisely why**: the pre-`Core` stand-ins' local `mount()` methods
never bound `options.event` entries via `on()` (that logic only existed in the original's
`createUIObject`, unreachable before `core.ts` existed) and never picked up `Core.setup()`'s own
`{event: {}}` default (nothing to walk up to). Both are now genuinely reproduced. Verified
additive-only: no existing `builder.spec.ts`/`plane.spec.ts` test passes an `options.event` map, and
both spec suites (37 + 14 = 51 tests) pass unmodified against the reconciled classes with zero
changes to their own test bodies — only the production code changed.

**Verification**: `core.spec.ts`'s 20 tests cover `emit`/`on` (case-insensitive type match, non-array
`args` wrapping, multi-handler/last-result-wins, string/function-type early-return guards),
`off` (by-type, by-callback, the wipe-all-on-neither quirk), `setOption` (single key, object-merge),
`destroy` (verified no-op, no cross-instance corruption), `mount` (root/options/timestamp wiring,
`init()` invocation, subclass-`setup()` defaults, `Core.setup()`'s `event` default reaching a leaf
subclass's options, `options.event` auto-binding, `index` defaulting to `0`), and `Core.setup()`
itself. `npm run typecheck` (clean), `npm run test` (**478 tests across 29 spec files, 0
failures** — this batch's 20 plus the reconciled `builder.spec.ts`/`plane.spec.ts` (37+14,
unmodified) plus every prior batch, confirming the reconciliation changed no observable behavior
any existing test could detect), and `npm run build:lib` (clean, 31 modules bundled) all pass
against the full combined tree. `src/index.ts` updated with `export { Core }` +
`export type { CoreEvent, CoreOptions }`.

### Progress log — `base/map.js` (Phase B's last item — Phase B is now complete)

Ported to `src/base/map.ts` as a real `class Map` (constructor kept 1:1-in-spirit — see the
constructor-arity finding below), `scale`/`draw`/`drawAfter`/static `setup()` kept 1:1. No
jui-chart-vue reference exists (confirmed: never ported there — no concrete `brush.map`/
`widget.map` implementation is public anywhere in `juijs-graph`/`jui-chart`), so this is a full
independent port with full independent verification — 40 new hand-traced/jsdom-rendered/Node-
cross-checked tests in `map.spec.ts` (`npm run test`: **518 tests across 30 spec files, 0
failures**, up from 440 at the last Phase B checkpoint — this batch's 40 plus 38 more from the
concurrently-landed `base/core.ts`/`base/animation.ts` batch). `npm run typecheck` and
`npm run build:lib` (32 modules bundled, up from 31) both pass clean.

**The headline finding — `chart.map`'s `render()` lifecycle is broken in the real, shipped
library, not a port-introduced bug**: `base/axis.js`'s `drawMapType()` (already-landed `axis.ts`)
constructs a map instance and immediately calls `map.render()`. But `base/map.js`'s `Map`
constructor function only ever assigns `this.scale`, `this.draw`, and `this.drawAfter` — **no
`this.render` is assigned anywhere in the file**, and `Map`'s module descriptor is `extend: null`
(confirmed both in `node_modules/juijs-graph/src/base/map.js` and independently in the compiled
`dist/jui-graph.esm.js` bundle — not a stale source copy), so it doesn't inherit a `render()` from
`chart.draw`'s `Draw` class either (which DOES provide a `render()` that calls `this.draw()` then
`this.drawAfter()` — precisely the lifecycle shape `Map`'s own two methods were clearly designed
to plug into, going by their names, but `Map` never declares `extend: "draw"` to actually get it).
Net effect, Node/hand-verified against both the literal source and its own compiled dist output:
**any real chart that configures a `map` axis option throws `TypeError: map.render is not a
function` the instant it tries to render — `chart.map`'s entire declared purpose is unreachable
dead code in the real, distributed `juijs-graph`/`jui-chart` library.** This plausibly explains
this project's own Phase 0/prior-conversation note that no concrete map brush/widget exists
publicly anywhere — the base engine underneath them has apparently never actually worked. Preserved
exactly here (Phase 0 rule 6): `Map` below still defines only `draw()`/`drawAfter()`, no `render()`
— tested directly (`(map as any).render` is `undefined`). Direct consequence: `Map` does NOT
implement `axis.ts`'s own `MapConstructor`/`MapInstance` structural contract (which requires a
`render()`, modeled on what `drawMapType()` calls) and is therefore not wired in anywhere as
`AxisChart.mapType` — a future Phase E adapter bridging `render()` to `draw()`+`drawAfter()` would
be needed to actually use this class, deliberately NOT added here since doing so would silently
fix the very defect this port exists to preserve and document.

**A second, independent, genuinely new finding, caught by this batch's own tests (not assumed from
reading the code once)**: `util/base.js`'s `_.trim()` — ported here as a private `trim()` helper
since `getStyleObj()`'s inline-`style="..."` parsing is real product logic — has its own real bug,
unrelated to the `render()` finding: whenever the input has ANY trailing whitespace, `trim()` also
eats the one real (non-whitespace) character immediately before it. `trim("0.5 ")` → `"0."`, not
`"0.5"`; `trim("blue ")` → `"blu"`; `trim("ab  ")` → `"a"` (eats across a multi-space run);
`trim("a ")` → `""` entirely. Leading whitespace strips correctly with no loss, and a string with
NO trailing whitespace at all is untouched. Root cause: the trailing half of the original's own
regex (`((?:^|[^\\])(?:\\.)*)` + whitespace + `"$"`, apparently meant to avoid trimming an
escaped trailing space) captures one extra real character as part of what it matches, and
`.replace(rtrim, "")` deletes the WHOLE match, group included. Real, practical consequence for
this file specifically: `getStyleObj()` (map-path inline `style="..."` parsing) silently truncates
the last character of any key/value written with a space before its `:`/`;` delimiter — e.g.
`"fill: red ; stroke: blue"` parses to `{fill: "re", stroke: "blue"}` (only the first value, which
has a trailing space before its `;`, is affected). Preserved exactly (not fixed), documented in
`trim()`'s and `getStyleObj()`'s own doc comments, with dedicated regression tests in
`map.spec.ts` proving both the normal (unaffected) case and the truncating case.

**Other structural notes**:
  - **Constructor arity is a red herring**: `axis.js`'s call site passes 3 args
    (`new Map(chart, axis, axis[k])`, matching `axis.ts`'s `MapConstructor` shape) but the
    ORIGINAL `Map` constructor function takes **zero parameters** and never reads `arguments`
    either — all real wiring (`chart`/`axis`/`map`/`svg`) happens exclusively via the four direct
    property assignments `axis.js` performs immediately after `new Map(...)`, never via the
    constructor. Preserved exactly: this class's constructor also takes zero parameters and
    ignores anything passed to it (TypeScript's structural function-type compatibility allows a
    0-parameter constructor to satisfy a 3-parameter constructor type, so this remains fine even
    for `MapConstructor`'s declared shape — moot anyway given the `render()` finding above).
    `chart`/`axis`/`map`/`svg` are typed with definite-assignment assertions (`!`), the same idiom
    `util/svg/element.ts`'s `Element` already established for "populated by an external wiring
    step, not the constructor." Tested (constructing with 3 args, verifying all four stay
    `undefined`).
  - **`chart` needs more than `axis.ts`'s `AxisChart` declares**: `addEvent()`'s internal
    `setMouseEvent()` reads `chart.root` (the real DOM mount element) and
    `chart.padding("left"/"top")` — neither is part of `axis.ts`'s `AxisChart` interface
    (`base/axis.js` itself never calls either; only real `Builder` instances happen to have them —
    `base/builder.ts`'s `root: HTMLElement`/`padding(key)`). `map.ts` exports its own `MapChart`
    type: `AxisChart & {root: HTMLElement; padding(key): number}`, a strict superset any real
    `AxisChart`-satisfying `Builder` instance already satisfies.
  - **Theme styling clobbers same-named inline `style=` properties**: `loadArray()`'s
    `elem.attr(_.extend(style, {fill: chart.theme(...), ...}))` merges the 5 theme-driven keys
    (`fill`/`fill-opacity`/`stroke`/`stroke-width`/`stroke-opacity`) INTO the parsed inline style as
    the `_.extend` "add" side — since `theme()` always returns a real value, these 5 keys are
    unconditionally overwritten, clobbering any same-named inline `style` property; any OTHER style
    property (e.g. `stroke-dasharray`) survives untouched. Not a bug — this is exactly what
    `_.extend(style, themeProps)` does in the original — but non-obvious and worth flagging. Tested.
  - **`getPathList()`'s dead-code guard**: `if(!_.typeCheck("string", root.id)) return;` can NEVER
    trip for a real `Element` — `Element.prototype.id` is always a string (`""` when unset, never
    `undefined`), so the negated check is always `false`. A genuinely new finding (not obvious from
    a single read) — every real call recurses/collects normally regardless of whether `root` has an
    `id` attribute. Tested with an id-less `<g>` root.
  - **`getScaleXY()`'s TODO-preserved footgun**: carries the original's own `// 차후에 공통
    함수로 변경해야 함` ("should later be a common function") comment. Computes pan/zoom offset
    from `this.map.width`/`.height` (the MAP OPTION values, not anything measured from the live
    DOM) — since `Map.setup()` defaults both to `-1` ("unset"), a consumer that never explicitly
    configures `map.width`/`map.height` gets `pathScale`-dependent pan math computed against `-1`.
    Not a bug (documented original default), just a real footgun. Tested (both the explicit-size
    and the `-1`-default cases, plus the `scale===1` always-zero-offset case).
  - **`scale.scale(0)` quirk**: `if(!scale || scale < 0) return pathScale;` excludes `0` too, not
    just negative values — `scale.scale(0)` is silently ignored exactly like `scale.scale(-1)`.
    Tested.
  - **Loose `==` equality preserved** in `getDataById()` (numeric `id` fields in `axis.data` match
    a string DOM-attribute id) and in `draw()`'s `this.map.scale != 1` check. Tested.
  - **`ajax()`** (`util/base.js`'s network helper) is real product logic here — the actual
    synchronous XHR fetch for a remote map SVG file — so it gets its own private, unexported port,
    same convention as this project's other inlined `util.base` helpers. Only the subset
    `loadPath()` actually ever passes (`url`/`async`/`success`/`fail`) is exercised, but the full
    original shape (including the legacy `ActiveXObject` IE-fallback loop) is kept for fidelity.
    Two of `loadPath()`'s own preserved quirks are tested directly: a malformed response (not
    exactly one root `<svg>`) leaves `pathData[uri]` permanently `[]`, which reads as "already
    cached" on every subsequent call (no retry, no error — verified via a fake-XHR call counter);
    and `xhr.responseXML === null` would throw uncaught inside the `success` callback (no
    defensive guard, matching the original — not separately unit-tested since it's a direct,
    obvious consequence of the no-guard code already visible at the call site).
  - **Class named `Map`, deliberately, per Phase 0 rule 2's naming-fidelity requirement** — this
    does shadow the global `Map`/`Map<K,V>` generic within consumers that `import { Map }` from
    this package; the file itself never needs the built-in (all dictionaries here are
    `Record<string, ...>`), so it compiles cleanly. Flagged here for anyone integrating this
    package, not treated as a naming collision requiring a rename (unlike `element.transform.ts`'s
    `orders`→`transformOrders`, which was renamed only because it caused an actual TS compile
    error — this doesn't).

**Verification**: `map.spec.ts`, 40 hand-traced/jsdom-rendered/Node-cross-checked tests covering
`Map.setup()` defaults; the no-`render()` regression; the zero-parameter-constructor quirk;
`loadArray()`/`getStyleObj()` (element-type selection, theme clobbering, the `trim()` truncation
bug in both its unaffected and affected forms, non-object-entry skipping); `isLoadAttribute`/
`replaceXYValue` directly; `getPathList()` (the dead-guard quirk via jsdom-parsed real SVG
subtrees, `<g>` recursion with correct per-level `group` tagging, attribute whitelisting,
`getDataById()` merge with loose-equality matching); `loadPath()` (cached-branch reuse with zero
XHR calls, the fetched branch via a fake synchronous `XMLHttpRequest` double parsing a real SVG
document and appending `<style>` tags into the chart's live root, the malformed-response
permanent-empty-cache quirk, and the fail-callback throw); `getScaleXY()` (hand-traced offset math
across three cases); `makePathGroup()`; the `scale(id)` callable (invalid/non-string id, hand-traced
x/y resolution including `dx`/`dy`); `scale.each/.size/.scale/.view` (the `this`-bound-to-`scale`-
itself shape, the `scale(0)` quirk, real `TransElement` transform-attribute assertions for both
`.scale()` and `.view()`); `draw()` (root/pathGroup wiring, `hide`, initial scale/view application);
`drawAfter()` (clip-path attribute, and the real 1ms-`setTimeout`-gated event wiring verified via
fake timers + a real dispatched `MouseEvent` with hand-computed `bgX`/`bgY`/`chartX`/`chartY`); and
`addEvent()` directly (all 8 wired DOM event types, including `contextmenu`'s `preventDefault()`).
`src/index.ts` updated with `export { Map } from './base/map'` and
`export type { MapPathDatum, MapOptions, MapChart, MapScale, MapScaleResult } from './base/map'`.

**Phase B is now complete**: every checklist item below is checked off (`base/collection.js`/
`base/manager.js` deliberately NOT ported, per their own evidence-backed writeups above — a real,
considered completion state, not an oversight). Phase C (`grid/`) can now proceed with a fully
landed `base/axis.ts`/`base/core.ts`/`base/builder.ts` to build against.

- [x] `base/vector.js` → `src/base/vector.ts` — see the "Progress log — base/vector.js, base/draw.js,
      base/plane.js, base/builder.js" writeup above this checklist for full detail.
- [x] `base/draw.js` → `src/base/draw.ts` — includes `calculate3d()`, cross-checked against jui-chart-vue's
      `usePolygon3d.ts`/dot3d.js Phase E writeup (confirmed the `Math.max(plotWidth, plotHeight,
      axis.depth)` vs `axis.depth/2` distinction exactly — see writeup above).
- [x] `base/axis.js` → `src/base/axis.ts` — see the "Progress log" writeup immediately above this
      checklist for the full class-structure/grid-boundary/cross-check/quirks detail.
- [x] `base/plane.js` → `src/base/plane.ts` — see the "Progress log — base/vector.js, base/draw.js,
      base/plane.js, base/builder.js" writeup above this checklist for full detail.
- [x] `base/builder.js` → `src/base/builder.ts` — see the "Progress log — base/vector.js, base/draw.js,
      base/plane.js, base/builder.js" writeup above this checklist for full detail (includes the
      real dependency-order finding and the documented `base/core.js`/`base/axis.js` forward-reference
      gap).
- [x] `base/animation.js` → `src/base/animation.ts` — see the "Progress log — base/animation.js
      (ported) + base/collection.js/base/manager.js (evaluated, not ported)" writeup above this
      checklist for full detail (`Animation` class, `resolveBuilderTarget()`'s preserved
      null/multi-match `TypeError` bugs, the `tpf===1` skip-first-frame guard, `Animation.setup()`'s
      `extend()` merge semantics, and jsdom canvas-context testability notes).
- [x] `base/core.js` → `src/base/core.ts` — see the "Progress log — base/core.js (+ builder.ts/
      plane.ts reconciliation)" writeup above this checklist for full detail (event-bus/`mount()`/
      `destroy()`-inertness design, the preserved `off()`/`emit()` quirks, the self-caught
      `typeCheck` regression, and the `builder.ts`/`plane.ts` reconciliation with its one real
      behavior addition).
- [x] `base/collection.js` → NOT ported (no `src/base/collection.ts` created) — evaluated and
      concluded to be a pure global-registry artifact (an `Array`-subclassing wrapper used only by
      `base/core.js`'s dropped `UICore.build` to group per-selector chart instances for
      `base/manager.js`'s registry). See the "Progress log" writeup above this checklist for the
      full evidence.
- [x] `base/manager.js` → NOT ported (no `src/base/manager.ts` created) — evaluated and concluded to
      be a pure global-registry artifact (a singleton in the original source itself, not a
      per-instance class; every method is registry-populated-list CRUD or string-keyed dynamic
      instantiation; `main.js`'s `_.extend(jui, manager, true)` confirms it was the library's real
      public global API surface, exactly the pattern Phase 0 rule 1 drops). The genuinely useful
      per-instance event bus this file's `emit()` merely dispatches *to* lives entirely in
      `base/core.js`'s `Core` class instead (a different, separate file) — not extracted from here
      because it was never here to begin with. See the "Progress log" writeup above this checklist
      for the full evidence-backed judgment call.
- [x] `base/map.js` → `src/base/map.ts` — see the "Progress log — base/map.js (Phase B's last item —
      Phase B is now complete)" writeup above this checklist for full detail: the headline finding
      that `chart.map`'s `render()` lifecycle is broken in the real shipped library (preserved, not
      fixed), the independently-discovered `util/base.js` `_.trim()` truncation bug, the
      zero-parameter-constructor quirk, the `MapChart` structural-contract extension, and every
      other preserved quirk with its own test in `map.spec.ts` (40 tests).

## Phase C — Grid layer (`grid/`)

Depends on Phase A/B (`base/axis.js` particularly).

**Phase C status: complete.** All 15 `grid/*.js` files ported and checked off (`core`, the 10 direct
`CoreGrid` subclasses `block`/`range`/`date`/`radar`/`rule`/`panel`/`table`/`overlap`/`fullblock`/
`grid3d`, the 2 non-direct-`CoreGrid` subclasses `dateblock` (`extends DateGrid`)/`log` (`extends
RangeGrid`), and the 2 `chart.draw`-sibling draw mixins `draw2d`/`draw3d`), grep-verified against
this section's own checklist (zero remaining `- [ ]` items). `grid/draw3d.js` was the last item,
landing only after Phase D (`polygon/{core,point,line,cube,grid}.js`) supplied its hard dependency.
Final count: **282 tests across 15 spec files** (`core.spec.ts` 45, `block.spec.ts` 16,
`range.spec.ts` 23, `fullblock.spec.ts` 13, `date.spec.ts` 24, `radar.spec.ts` 15, `grid3d.spec.ts`
12, `dateblock.spec.ts` 20, `log.spec.ts` 10, `rule.spec.ts` 26, `panel.spec.ts` 4, `table.spec.ts`
8, `overlap.spec.ts` 6, `draw2d.spec.ts` 25, `draw3d.spec.ts` 34), part of the full repo suite's
**841 tests across 50 spec files, 0 failures** (Phase A/B/D's own tests make up the rest). `npm run
typecheck`, `npm run test`, and `npm run build:lib` (52 modules bundled) all pass clean. See each
file's own "Progress log" writeup below for full detail (dependency map, class-shape findings,
preserved bugs/quirks, cross-check results). Recommended next: Phase E (`brush/`/`widget/` base
classes).

### Progress log — `grid/core.js` (+ real dependency map for the remaining 14 `grid/*.js` files)

Ported to `src/grid/core.ts` as a real `class CoreGrid`, constructor kept 1:1 (the original's own
`CoreGrid` constructor takes ZERO parameters — `chart`/`axis`/`grid`/`svg` are wired onto the
instance externally by `base/axis.ts`'s `drawGridType()`, not via construction), every public
method name kept 1:1 (`wrapper`/`line`/`color`/`data`/`getGridSize`/`getDefaultOffset`/
`getTextRotate`/`getLineOption`/`checkDrawLineY`/`checkDrawLineX`/`drawTop`/`drawBottom`/
`drawLeft`/`drawRight`/`drawGrid`/`drawAfter`, plus the static `CoreGrid.setup()` defaults
factory). Co-located `core.spec.ts`, 45 tests, all passing.

**Real extend target: `base/draw.ts`'s `Draw`, NOT `base/core.ts`'s `Core`** — this task's own
central verification job, confirmed by literally grepping `extend:` across `grid/core.js` AND all
14 remaining `grid/*.js` files (see the dependency map below): `grid/core.js`'s own field reads
`extend: "chart.draw"`. `Core` (per-instance event bus / option-merge, `Builder`/`Plane`'s base)
and `Draw` (render-lifecycle mixin base — `render()`/`format()`/`calculate3d()`/`on()`, populated
externally with `chart`/`axis`/`grid`/`svg`) are two entirely separate inheritance families in the
original engine; every `grid.*` class needs the latter. `class CoreGrid extends Draw` below.

**`CoreGrid` is genuinely abstract, in the original too** — it never assigns `this.draw` (the one
field `Draw.render()` requires, or it throws `"JUI_CRITICAL_ERR: 'draw' method must be
implemented"`), and `drawGrid()`'s own `this[this.grid.orient]` lookup (`this.top`/`.bottom`/
`.left`/`.right`/`.center`/`.custom`) resolves to nothing `CoreGrid` itself defines either — both
are always supplied by a concrete leaf subclass (confirmed by reading `grid/block.js`: `BlockGrid`
defines `this.draw = function(){ return this.drawGrid("block"); }` plus `this.top`/`.bottom`/
`.left`/`.right`/`.center`, each calling back into `CoreGrid`'s own `drawTop`/`drawBottom`/
`drawLeft`/`drawRight`). Calling `new CoreGrid().render()` throws the same `Error` the original
would too — tested, not a port-introduced restriction.

**The `draw2d.js`/`draw3d.js` runtime method-mixin — a real, load-bearing mechanism, preserved via
an explicit registration hook, not a registry artifact to drop**: `drawGrid()`'s own body does
`var draw = (this.axis.isFull3D()) ? Draw3D : Draw2D; ... draw.call(this);` where `Draw2D`/`Draw3D`
are the `Draw2DGrid`/`Draw3DGrid` CONSTRUCTOR FUNCTIONS themselves (via `jui.include(...)`), and
calling `Draw2DGrid.call(this)` with `this` bound to the grid instance MIXES that whole 2D-or-3D
method set (`createGridX`/`createGridY`/`drawPattern`/`drawBaseLine`/`drawAxisLine`/
`drawValueLine`/`drawValueText`/`drawImage`, plus 3D-only `drawCenter`/`drawValueLineCenter`/
`drawValueTextCenter`) onto the instance, monkeypatching over whichever set a prior render pass
mixed in. This is genuine per-render-call product behavior (dynamically switching between 2D/3D
drawing implementations based on `axis.isFull3D()`), not the string-keyed lookup Phase 0 rules 1/4
drop — only the STRING RESOLUTION of `Draw2D`/`Draw3D` is the registry artifact. Since
`grid/draw2d.ts`/`grid/draw3d.ts` aren't ported yet (this task's OWN assignment was to map them,
not port them — see the dependency map below), resolved via an explicit, typed registration hook
(`registerGridDraw2D`/`registerGridDraw3D`, exported from `grid/core.ts`) — the same established
pattern `base/builder.ts` already used for its own not-yet-ported `Axis`/`chart.brush.*`/
`chart.widget.*` sibling dependencies (`registerAxis`/`registerBrush`/`registerWidget`).
`drawGrid()` throws a clear, named error if neither mixin has been registered by the time a
concrete grid subclass needs one — matching the original's own behavior for an unresolved
`jui.include(...)` (a hard failure, not a silent no-op) — and preserves the original's exact
structural quirk that the mixin is applied ONLY inside the `if(_.typeCheck("function", func))`
guard (never invoked at all if `this.grid.orient` doesn't resolve to a defined orient-method).
Tested (registered-2D, registered-3D, unregistered-throws, and orient-doesn't-resolve-skips-mixin
cases).

**`GridConstructor`/`GridInstance` (`base/axis.ts`) reconciliation — precisely what needed
adjusting, and why `axis.ts` itself was left untouched**: `axis.ts`'s `GridConstructor`/
`GridInstance` were written as a minimal placeholder before any `grid/*.ts` file existed. Two real
gaps surfaced, both resolved WITHOUT modifying `axis.ts` (kept out of this task's blast radius —
`axis.js` itself never calls the extra members below, so `AxisChart` correctly never declared
them):
  1. `GridConstructor`'s `new (chart, axis, gridOptions) => GridInstance` shape assumes a
     3-parameter constructor — but the real `CoreGrid` (and, per `grid/block.js`, every subclass
     but `grid/table.js`'s `TableGrid(chart, axis, grid)`, a genuine documented exception — see
     the dependency map below) takes ZERO. No interface change was needed: TypeScript already lets
     a fewer-parameter constructor satisfy a more-parameter constructor type (confirmed via a
     compile-time-only check, `gridConstructorTypeCheck`, in `grid/core.ts` itself — not just
     asserted in prose).
  2. `GridInstance.chart: AxisChart` is too narrow for what `CoreGrid`'s real `Draw` base needs
     (`Draw.on()`'s `self.chart.axis(self.axis.index)`, `Draw.format()`'s `this.chart.format`
     fallback) and what `CoreGrid.color()` needs (`this.chart.color(colorConfig)`, and a 3-argument
     `this.chart.theme(isActive, activeKey, inactiveKey)` form used by `grid/draw2d.js`'s
     `this.color(isActive, "gridActiveBorderColor", "gridXAxisBorderColor")` calls). Resolved via a
     local `GridChart` type (`AxisChart` intersected with exactly these extra members) used only as
     `grid/core.ts`'s own `chart` field override — confirmed these are real, already-present
     `Builder` surface, not invented: `src/base/builder.ts` already has `axis(key?: number): any`,
     `color(key?: any, colors?: any[]): string`, and `theme(key?: any, value?: any, value2?: any):
     any` (already loosely 3-arg-capable) — a real `Builder` instance satisfies `GridChart` today
     with zero changes needed there.

**One small, honest reconciliation this DID require in an already-landed file**: `base/draw.ts`'s
`static setup()` return type was widened from the inferred literal `{ type: string | null; animate:
boolean }` to `Record<string, unknown>` — `grid/core.ts`'s `CoreGrid` is the first real
`extends Draw` subclass, and TypeScript's static-side covariant-override check rejected
`CoreGrid.setup()`'s own (1:1, byte-faithful) return shape otherwise. Confirmed zero runtime/
behavior change: `Draw.setup()` itself is never called anywhere in the current tree (grepped).
Also required: `CoreGrid.drawAfter` is declared as an arrow-function CLASS FIELD, not method
syntax — `Draw` declares `drawAfter` as an optional instance PROPERTY (matching the original's own
per-instance `this.drawAfter = function(obj){...}` closure assignment, never a prototype method
there), and TypeScript's `TS2425` override check requires matching property-vs-method "kind"
between base and subclass. Both are pure class-ification type-system consequences (see Phase A's
own precedent for this category of finding), not behavior changes.

**Preserved bugs/quirks found and documented (each Node/hand-verified against the literal
original, not merely inferred from a single read)**:
  - **`getGridSize()`: `depth > 0 || degree > 0` and `math.radian(360 - degree)` both compare/
    subtract `this.axis.degree` — an OBJECT (`{x,y,z}`) — directly against/with a number.** JS's
    abstract relational/arithmetic coercion converts the object via `ToPrimitive`/`ToNumber` (no
    custom `valueOf`, falls through to `toString()` → `"[object Object]"` → `NaN`), so
    `degree > 0` is ALWAYS `false` (the condition silently reduces to just `depth > 0`), and if
    that branch DOES run (because `depth > 0`), `360 - degree` is `NaN`, poisoning `x2`/`y2` and
    therefore `result.start`/`.size`/`.end` with `NaN` for any 2D (non-full-3D) grid configured
    with a nonzero `axis.depth` — a real, reachable configuration, not a contrived edge case. A
    genuine, previously-undocumented finding. Tested (both the NaN-producing case and the
    depth-is-zero common case).
  - **`getLineOption()`: `!line.type == "string"` is dead code.** Parses as `(!line.type) ==
    "string"` (`!` binds tighter than `==`) — `!line.type` is always a `boolean`, and
    `boolean == "string"` is always `false` (`ToNumber("string")` is `NaN`). So `line.type` is
    NEVER actually split into an array, despite the evident intent (splitting a multi-word type
    string like `"dashed rect"` into `["dashed","rect"]`). Harmless in practice — every real reader
    of `line.type` (`grid/draw2d.js`'s `.indexOf("gradient")`/`.indexOf("rect")`/
    `.indexOf("dashed")`) does substring search, which still matches correctly against the un-split
    string. Tested.
  - `data(index, field)`'s `this.axis.data[index][field] || this.axis.data[index]` fallback (a
    falsy field value, e.g. `0`, falls back to the WHOLE row, not the field's own falsy value) and
    the always-truthy-array `this.axis.data &&` check (an empty array is still truthy in JS, so
    this reduces to just the `[index]` lookup) both ported verbatim, no fix. Tested.
  - `color()`'s `arguments.length === 3` branch (kept as a real `arguments`-reading method, not a
    rest-param signature, for 1:1 fidelity with how `grid/draw2d.js` actually calls it) and its
    `grid.color`-set short-circuit (both the 1-arg and 3-arg forms prefer `chart.color(grid.color)`
    over `chart.theme(...)` whenever a grid explicitly configures a `color`) ported verbatim.
    Tested.

**Verification**: `core.spec.ts`, 45 hand-traced/Node-cross-checked tests covering every method
above (including the two preserved-bug cases), plus `drawGrid()`'s mixin-registration mechanism
(registered-2D/registered-3D/unregistered-throws/orient-unresolved-skips-mixin), `wrapper()`
being called with the right args, `drawAfter()`'s class/translate wiring, `render()`'s inherited
abstract-throw, and `static setup()`'s exact default shape. `npm run typecheck` (clean), `npm run
test` (**563 tests across 31 spec files, 0 failures** — this batch's 45 plus all 518 from Phase
A/B), and `npm run build:lib` (clean, 33 modules bundled, up from 32) all pass against the full
combined tree. `src/index.ts` updated with `export { CoreGrid, registerGridDraw2D,
registerGridDraw3D }` and `export type { GridChart, GridDrawMixinApplier }`.

#### Real dependency map for the remaining 14 `grid/*.js` files (mapped, not ported, this iteration)

Built by grepping each file's real `extend:` field and top-of-file `import`/`jui.include(...)`
lines directly (not assumed from the flat original checklist below, which — per this same lesson
already learned once for `base/builder.js`/`base/plane.js` — turned out NOT to all be simple
`chart.grid.core` siblings):

**Extend `chart.grid.core` (i.e. `CoreGrid`) directly — 10 files, safe to parallelize freely
against each other, each only additionally needs the Phase A utilities listed:**

| File | Extra Phase A deps (beyond `grid/core.ts`) | Cross-check opportunity |
|---|---|---|
| `grid/block.js` | `util/scale.ts` (`ordinal()`) | jui-chart-vue's `useAxis.ts`/`useChartLayout.ts` Phase F writeup: the "range-axis-reverses/block-axis-never-does" orientation asymmetry (`base/axis.ts`'s own header comment already cross-references this) |
| `grid/range.js` | `util/math.ts`, `util/scale.ts` (`linear()`) | same as above — the other half of the reverses/never-reverses asymmetry; also `math.ts`'s documented `nice()` `isNice` `ReferenceError` bug (Phase A finding) is reachable here per `math.ts`'s own header note (`range.js` threads its own `nice` config straight into that call) |
| `grid/date.js` | `util/scale.ts` (`time()`), `util/time.ts` | no existing jui-chart-vue reference; full independent port/verification |
| `grid/radar.js` | `util/math.ts` | no existing jui-chart-vue reference |
| `grid/rule.js` | `util/scale.ts` | no existing jui-chart-vue reference |
| `grid/panel.js` | none beyond `util.base` (inlined per-file, no extra Phase A import) | no existing jui-chart-vue reference; also the `axis.ts`/`drawGridType()` default (`gridCfg.type = gridCfg.type || "panel"` for the `c`/z-color axis) — worth reading `axis.ts`'s `drawGridType()` again alongside this file |
| `grid/table.js` | none beyond `util.base` | **constructor-signature exception**: `TableGrid(chart, axis, grid)` takes 3 params, unlike every other real subclass's 0-param constructor (confirmed by reading the file directly — worth double-checking whether this is dead/vestigial or genuinely reachable via `drawGridType()`'s `new GridCtor(this.chart, this, gridCfg)` call before porting); cross-check against jui-chart-vue's `useGridLayout.ts` (Phase F, audited as a generic hand-port, not confirmed 1:1 against this specific file) |
| `grid/overlap.js` | none beyond `util.base` | no existing jui-chart-vue reference |
| `grid/fullblock.js` | `util/scale.ts` (`ordinal()`) | likely close to `grid/block.js` structurally (same scale) — port together/compare for shared logic once both are underway |
| `grid/grid3d.js` | `util/math.ts` | jui-chart-vue's `usePolygon3d.ts` z-axis handling (`dot3d.js`/`column3d.js`/`line3d.js` entries document a SIMPLIFIED linear/ordinal z rather than a full ported grid — this file is the real thing being simplified away there) |

**Do NOT extend `chart.grid.core` directly — 2 files with a real dependency on ANOTHER grid file,
must be ported AFTER their target, not in parallel with the batch above:**

| File | Real `extend:` target | Note |
|---|---|---|
| `grid/dateblock.js` | `chart.grid.date` (i.e. `grid/date.js`'s class) | needs `grid/date.ts` ported first; also imports `util/scale.ts`/`util/time.ts` directly itself |
| `grid/log.js` | `chart.grid.range` (i.e. `grid/range.js`'s class) | needs `grid/range.ts` ported first; only imports `util/scale.ts` (no direct `util/math.ts` import, unlike `range.js`) |

**Sibling to `grid/core.ts` itself, NOT extending it — 2 files, both `extend: "chart.draw"` (same
as `grid/core.ts`), needed BY `grid/core.ts`'s `registerGridDraw2D`/`registerGridDraw3D` hook (see
progress log above) but not dependent on it structurally:**

| File | Extra deps | Note |
|---|---|---|
| `grid/draw2d.js` | `base/draw.ts` only | mixin providing `createGridX`/`createGridY`/`fillRectObject`/`drawAxisLine`/`drawPattern`/`drawBaseLine`/`drawValueLine`/`drawValueText`/`drawImage` |
| `grid/draw3d.js` | `base/draw.ts` + **`polygon/{grid,line,point}.js` (Phase D, NOT YET PORTED)** | a real, hard cross-phase dependency — `grid/draw3d.ts` cannot be ported until `polygon/grid.ts`/`polygon/line.ts`/`polygon/point.ts` land (Phase D); mixin providing `createGridX`/`createGridY`/`drawCenter`/`drawBaseLine`/`drawAxisLine`/`drawValueLine`/`drawValueLineCenter`/`drawValueText`/`drawValueTextCenter` (+ no-op `drawPattern`/`drawImage`) |

**Recommended batching for the next 2–3 iterations**, given the graph above: (1) the 10
`chart.grid.core`-direct files can be split across parallel iterations freely (e.g. 3–4 files per
batch, grouped by shared Phase A dependency — `block`+`range`+`fullblock` share `util/scale.ts`'s
`ordinal()`/`linear()`; `radar`+`grid3d` share `util/math.ts`; `panel`+`overlap`+`table` need
nothing beyond `util.base`); (2) `grid/date.ts` should land before or alongside whichever batch
includes `grid/dateblock.ts`, and `grid/range.ts` before/alongside `grid/log.ts`; (3)
`grid/draw2d.ts` can be ported any time (only needs `base/draw.ts`), but `grid/draw3d.ts` is
blocked on Phase D (`polygon/`) — either pull `polygon/core.js`+`polygon/point.js`+`polygon/line.js`
+`polygon/grid.js` forward out of order, or leave `grid/draw3d.ts` (and therefore full 3D-grid
rendering via `registerGridDraw3D`) as the last item of this phase.

### Progress log — `grid/block.js`, `grid/range.js`, `grid/fullblock.js`

Ported to `src/grid/block.ts` (`class BlockGrid extends CoreGrid`), `src/grid/range.ts` (`class
RangeGrid extends CoreGrid`), `src/grid/fullblock.ts` (`class FullBlockGrid extends CoreGrid`).
Every method name kept 1:1 (`center`/`top`/`bottom`/`left`/`right`/`initDomain`/`wrapper`/
`drawBefore`/`draw`, plus each class's own `static setup()`). Co-located `block.spec.ts` (16
tests), `range.spec.ts` (23 tests), `fullblock.spec.ts` (13 tests) — 52 new tests. Full repo suite:
**657 tests, 38 spec files, 0 failures** (this batch's 52 alongside all prior work plus the
concurrently-landed `radar`/`date`/`grid3d`/`panel`/`overlap`/`table`/`draw2d` batch from sibling
agents in this same round). `npm run typecheck`, `npm run test`, and `npm run build:lib` all pass
clean (36 modules bundled, up from 33).

**Extend chains confirmed by grepping `extend:` directly, not assumed**: all three are
`extend: "chart.grid.core"` — direct `CoreGrid` subclasses, siblings of each other. In particular,
**`FullBlockGrid` does NOT extend `BlockGrid`** despite the name/structural similarity (byte-
diffing the two original files: `initDomain()` is identical between them, but `drawBefore()`/
`wrapper()`/the orient methods diverge — see below) — ported as a fully independent class per this
task's own instructions, duplicating `initDomain()` rather than sharing it via inheritance, matching
the original's own lack of a real `extends BlockGrid` relationship.

`drawBefore`/`draw` are declared as arrow-function class fields (not method syntax), same
`TS2425`-driven convention `grid/core.ts`'s own `drawAfter` already established (`Draw` declares
both as optional instance *properties*, matching the original's per-instance closure assignment).
`draw()` in all three drops the original's `this.drawGrid("block"/"range"/"fullblock")` string
argument — confirmed dead code in the original too (`CoreGrid.drawGrid()` never reads any
parameter) — dropped only to satisfy TS's 0-arg signature, documented not silently deviated.
`drawPattern`/`drawBaseLine`/`drawCenter` (mixin methods from the not-yet-ported `grid/draw2d.ts`/
`grid/draw3d.ts`) are declared as definite-assignment fields directly on each subclass, same
convention `grid/core.ts` uses for `createGridX`/`createGridY`/`drawImage` — `CoreGrid` itself only
declares what its own methods need, so callers declare their own additional mixin slots.

**Cross-check against jui-chart-vue's `useAxis.ts`/`useChartLayout.ts` Phase F writeup — the
"range-axis-reverses/block-axis-never-does" orientation asymmetry**: confirmed exactly, both
directions, re-read directly against these two files' own `drawBefore()` (not just reused by
reference). `range.ts`'s `drawBefore()` swaps to `[obj.end, obj.start]` for `orient=="left"/"right"`
and reverses the final `ticks` array; `block.ts`'s `drawBefore()` always uses `[obj.start, obj.end]`
with no orient check at all — matching jui-chart-vue's finding (`PORT_STATUS.md` ~L6433-6438)
precisely. No discrepancy found. `fullblock.ts` shares `block.ts`'s never-reverses side (same
`[obj.start, obj.end]` shape). `useAxis.ts` itself has no ordinal/block-scale equivalent to
cross-check against (jui-chart-vue only ever builds linear axis scales) — `block.ts`'s/
`fullblock.ts`'s ordinal-specific logic is a full independent port, verified via hand-traced/
Node-cross-checked tests instead.

**Quirks/bugs found and preserved** (Node-cross-checked against literal transcriptions, not merely
inferred from a single read):
  - **`initDomain()`'s `grid.reverse` flag is a genuine NO-OP for the STRING-domain branch
    specifically, in both `block.ts` and `fullblock.ts`** — a real, previously-undocumented finding.
    When `reverse` is true, the per-item loop already iterates `data` backward to build `domain`;
    the trailing unconditional `domain.reverse()` then reverses that same array a SECOND time,
    exactly cancelling the first reversal. Node-verified: `initDomain()` with a string
    `grid.domain` produces the identical final array regardless of `grid.reverse`. The
    function-domain and array-domain branches (built in natural forward order, no internal
    reversal) are genuinely reversed by that same trailing call, as intended — this cancel-out is
    unique to the string-domain path. Tested in both `block.spec.ts` and `fullblock.spec.ts`.
  - **`wrapper()`'s reverse-index branch is effectively dead code for every realistic caller** — in
    both `block.ts` and `fullblock.ts`: `wrapper()` only returns the closure containing the
    reverse-handling `else` branch when `key` is truthy, and that closure's own first condition
    (`typeof i == 'number' && key`) always wins whenever `i` is a real number (the universal call
    shape — every caller in this engine passes a numeric loop/row index) — so the reverse branch
    only executes for a non-numeric `i`, never how any real consumer calls it. Preserved and
    exercised via direct unit invocation (same "preserved dead code, tested directly" convention as
    `grid/core.ts`'s `getLineOption()` bug), not via a `drawGrid()` integration path that would
    never actually reach it.
  - **`fullblock.ts`'s `wrapper()` off-by-one vs. `block.ts`'s**, discovered by diffing the two
    files directly: `BlockGrid`'s reverse arithmetic is `len - i - 1` (correct 0-based reversal);
    `FullBlockGrid`'s is `len - i` (one past the last valid index). Node-verified side by side with
    a concrete non-NaN case (`len=4, i="0"` via `-`'s numeric coercion): `BlockGrid` → `3`,
    `FullBlockGrid` → `4`. Tested in `fullblock.spec.ts`.
  - **`range.ts`'s `initDomain()`, string-domain branch: two further, previously-undocumented bugs
    distinct from the reverse quirk above** — (1) its per-row array handling calls `Math.max(value)`/
    `Math.min(value)` directly on the array (no `.apply`/spread), unlike the sibling function-domain
    branch's correct `Math.max.apply(Math, value)` — coerces via `ToNumber`, silently producing `NaN`
    for any array with more than one element (confirmed: `Math.max([1,2,3])` is `NaN`, but
    `Math.max([5])` "accidentally" works, since a 1-element array coerces to its sole element).
    Node-traced full example: a single multi-element-array row poisons `unit` into `NaN`, but the
    `while` loops' `<`/`>` comparisons against `NaN` are always `false`, so `domain` itself lands on
    `[0, 0]` while `domain.step` is the `NaN` that actually surfaces the bug (not obvious without
    tracing the full loop). (2) the string-domain branch pushes an extra `0` onto `value_list` for
    EVERY non-array row (unconditional), while the function-domain branch pushes `0` only once
    (`isCheck`-guarded) — harmless for the final min/max (extra `0`s don't change it) but a real,
    previously-undocumented asymmetry in the two branches' `value_list` construction. Both
    Node-verified with exact expected arrays/steps, tested in `range.spec.ts`.
  - **`range.ts`'s reachable `math.ts` `nice()` `ReferenceError`, confirmed live from this file**:
    `drawBefore()`'s `this.scale.ticks(this.step, this.nice)` reaches `linear().ticks()`'s
    `isNice`-true branch whenever a real caller sets `grid.nice: true` — throws
    `ReferenceError: niceFraction is not defined`, matching `math.ts`'s own documented Phase A
    finding exactly. Tested directly (`drawBefore()` with `nice: true` throws).
  - `range.ts`'s `unit`-rounding step (`math.div(Math.ceil(math.multi(unit, 10)), 10)`) uses the
    real, already-ported `multi()` (decimal-safe multiplication), not a plain `unit * 10` — kept
    faithful rather than substituted, since raw floating-point multiplication can drift from the
    fixed-point original in edge cases `math.multi()` exists specifically to avoid.

**Verification**: hand-traced/Node-cross-checked expected values for `ordinal().rangePoints()`/
`.rangeBands()` (e.g. domain of 4 items over `[0,400]` → points `[50,150,250,350]`/band `100` for
`rangePoints`, `[0,133.33,266.67,400]`/band `133.33` for `rangeBands`), `linear().ticks(10,false)`
over domain `[0,10]` (11 ticks, `0..10`), and `RangeGrid.initDomain()`'s fixed-point unit/domain
snapping (e.g. array domain `[3,27]`, step `10` → unit `2.4` ceiled to `3` → domain `[3,27]`,
`.step: 8`) — all reproduced via literal Node transcriptions of the exact algorithms before writing
assertions, not assumed from reading the TS once. `src/index.ts` updated with `export { BlockGrid }`
/ `export type { BlockGridOptions }`, `export { RangeGrid }` / `export type { RangeGridOptions }`,
`export { FullBlockGrid }` / `export type { FullBlockGridOptions }`.

**Next item**: per `grid/core.ts`'s dependency map, any of the remaining `chart.grid.core`-direct
files not already claimed by a concurrent agent this round (this task did not touch
`date`/`radar`/`grid3d`/`panel`/`overlap`/`table`/`draw2d`, per its own instructions — see their own
checklist lines for status), or `grid/log.ts`/`grid/dateblock.ts` once their respective
`range.ts`/`date.ts` dependencies are confirmed landed.

### Progress log — `grid/panel.js`, `grid/overlap.js`, `grid/table.js`, `grid/draw2d.js`

Ported to `src/grid/panel.ts`, `src/grid/overlap.ts`, `src/grid/table.ts`, `src/grid/draw2d.ts`.
Co-located spec files: `panel.spec.ts` (4 tests), `overlap.spec.ts` (6 tests), `table.spec.ts`
(8 tests), `draw2d.spec.ts` (25 tests) — 43 new tests. Full repo suite: **697 tests across 40 spec
files, 0 failures** (this batch's 43 alongside all prior Phase A/B/C work, including the
concurrently-landed `block`/`range`/`fullblock` and `date`/`radar`/`grid3d`/etc. batches). `npm run
typecheck` clean for this batch's own 4 files (one pre-existing, unrelated `TS2322` error remains
in `src/grid/radar.spec.ts` — a concurrent agent's own in-progress work, not touched by this task;
confirmed via `git status` that `radar.ts`/`radar.spec.ts` are outside this batch's scope). `npm
run test` (697/697) and `npm run build:lib` (clean, 40 modules bundled, up from 36) both pass
against the full combined tree.

**`grid/panel.ts`/`grid/overlap.ts`**: both extend `CoreGrid` directly, confirmed "nothing extra"
beyond `util.base`'s `extend()` (inlined per-file, same convention as every other Phase C file —
no shared helper module exists in this port). `draw()`/`drawBefore()` are arrow-function CLASS
FIELDS, not method syntax — same TS2425-avoidance reasoning `grid/core.ts`'s own `CoreGrid
.drawAfter` doc comment already established (`Draw` declares `draw?`/`drawBefore?` as PROPERTIES,
not methods, so a plain-method-syntax override is rejected by TypeScript's override-kind check);
`custom()` isn't declared anywhere in the `Draw`/`CoreGrid` chain (only ever resolved dynamically
via `drawGrid()`'s `this[this.grid.orient]` lookup), so it stays a normal method in both files.
Both `draw()`s unconditionally force `this.grid.hide = true` before delegating to `this.drawGrid()`
— a real, permanent-mutation-of-shared-config quirk already documented for `axis.ts`'s two-phase
`this.x`/`.y`/`.z`/`.c` shape. The original's own `this.drawGrid("panel")`/`this.drawGrid("overlap")`
call passes a string argument that `grid/core.js`'s real `drawGrid` (despite its own misleading
JSDoc listing `chart`/`orient`/`cls`/`grid` params) was **already silently discarding** — confirmed
by reading the original directly: `this.drawGrid = function() {...}` takes zero parameters. Calling
`this.drawGrid()` here (dropping the now-uncompilable extra argument) changes nothing observable.

**`PanelGrid` preserved quirks** (Node/hand-traced, tested): `custom(g)` always resolves
`this.scale(0)` (index hardcoded, though moot here since `drawBefore()`'s own scale ignores its `i`
argument entirely); `obj.x -= axis.area("x")` / `obj.y -= axis.area("y")` always nets to exactly
`0` for both (subtracting right back out what `scale()` just added), so the rendered rect's `x`/`y`
are always `0`, not axis-area-relative as reading the subtraction in isolation might suggest.

**`OverlapGrid` — genuine, previously-undocumented bug (not merely dead code — the geometry loop
IS reachable)**: the original declares `this.custom = function() {...}` with **zero** parameters —
unlike `panel.js`'s `custom(g)`. `drawGrid()` always calls `func.call(this, root)`, passing `root`
as the first argument; since `custom()` never declares a parameter to receive it, `root` is simply
discarded at the call boundary. The loop genuinely runs (`this.axis.data.length` is real), and
`this.chart.svg.rect(...)` really is constructed each iteration — but is never appended anywhere
(no `g.append(...)`/`root.append(...)` call exists in the original body at all). Net effect: a real
overlap grid renders a completely empty `<g>` in every real invocation, despite genuinely computing
per-row geometry and constructing real, live, immediately-orphaned SVG elements. Preserved
byte-faithfully (the parameter is genuinely omitted here too, not merely unused). Tested: spies on
`chart.svg.rect` to prove it *is* called `axis.data.length` times, while the group passed in (as
`drawGrid()`'s `root` would be) stays at zero children.

**`grid/table.ts` — the 3-parameter-constructor investigation, resolved precisely**: the original
`var TableGrid = function(chart, axis, grid) {...}` does take 3 declared parameters, unlike every
other real `CoreGrid` subclass. Investigated both halves of the question rather than assuming:
(1) **is `new Grid(...)` actually called with 3 real arguments?** Yes — confirmed via
`/home/search5/cl/jui-graph/src/base/axis.js`'s real `drawGridType()`:
`var obj = new Grid(chart, axis, axis[k]);` is called UNCONDITIONALLY for every grid type on every
axis slot, not something table-specific — `PanelGrid`/`OverlapGrid` (and per `grid/core.ts`'s
dependency map, every other direct `chart.grid.core` subclass) receive the exact same 3 real
arguments at this exact call site; they simply never declared formal parameters to catch them (JS
silently discards uncaptured extra arguments). (2) **are `chart`/`axis`/`grid` ever actually used
inside the constructor body as those closure-captured parameters?** No — grepped every reference:
`custom()`/`drawBefore()`/`draw()` exclusively use `this.chart`/`this.axis`/`this.grid` (the
externally-wired instance properties every subclass uses), never the bare `chart`/`axis`/`grid`
identifiers the constructor declared. **Conclusion: not a real behavioral difference — vestigial/
dead, not reachable in any behaviorally meaningful sense.** Ported with the same 0-arg (implicit,
inherited) constructor every other `CoreGrid` subclass uses; re-verified via this file's own
compile-time-only `tableGridConstructorTypeCheck` (mirroring `grid/core.ts`'s own
`gridConstructorTypeCheck`) and a runtime test that a 3-arg construction call (mirroring
`drawGridType()`'s real call site exactly) still succeeds.

**`grid/table.ts` — a separate, genuinely new finding surfaced while tracing the above**:
`custom()`'s entire loop body is unreachable dead code, due to a real `var`-scoping bug independent
of the constructor-param question. `drawBefore()` declares its OWN local `row`/`column` (`var row
= this.grid.rows;` — a plain local variable of `drawBefore`'s own function scope, since JS `var` is
function-scoped, not block-scoped) rather than ever assigning to any outer/instance `row`/`column`.
The constructor-top-level `var row, column;` (mirrored here as private instance fields, deliberately
kept distinct from `drawBefore()`'s locals rather than merged/simplified away) are therefore never
assigned by anything, ever — `for (let r = 0; r < (this.row as number); r++)` with `this.row ===
undefined` is always `false`. Doubly (arguably triply) unreachable independent of that: (a) the
original `table.js`, unlike `panel.js`/`overlap.js`, never declares `var _ = jui.include
("util.base");` at all — its `_.extend(...)` call would throw `ReferenceError: _ is not defined` if
ever reached; (b) even setting both aside, the created rect's `g.append(rect)` line is literally
commented out (`//g.append(rect);`) in the original, and its `fill` value is typo'd (`"tranparent"`,
missing an `s`). All preserved byte-faithfully (structurally faithful but provably-dead loop body),
not fixed, per Phase 0 rule 6. `drawBefore()`'s own `row`/`column`/`padding`/`rowUnit`/`columnUnit`
and the resulting `this.scale(i)` are entirely correct and unaffected by this bug (genuinely
separate local bindings) — hand-traced in `table.spec.ts` (e.g. `rows:2, columns:3, padding:10`
over a `210×110` area → `columnUnit ≈ 63.33`, `rowUnit = 50`, `scale(4)` at row 1/col 1 with
padding offsets). Tested: `this.row`/`this.column` are asserted `undefined` after `drawBefore()`
runs, and `custom()` is asserted to never call `chart.svg.rect` at all.

**`grid/draw2d.ts` — the real 2D-drawing-method mixin `grid/core.ts`'s `registerGridDraw2D()` hook
was built to receive, confirmed wired up and working end-to-end**: NOT a `CoreGrid` subclass — a
sibling sharing `CoreGrid`'s own `extend: "chart.draw"` field (confirmed via grep, matching
`grid/core.ts`'s own dependency map). Read `grid/core.ts` first to confirm the exact shape
`registerGridDraw2D` expects (`GridDrawMixinApplier = (target: CoreGrid) => void`, and the 4 fields
`CoreGrid` itself declares definite-assignment placeholders for: `createGridX`/`createGridY`/
`drawImage`/`drawValueText`), then ported all 9 of the original's methods (those 4 plus
`fillRectObject`/`drawAxisLine`/`drawPattern`/`drawBaseLine`/`drawValueLine`, internal-only helpers
not declared on `CoreGrid` but needed by future `grid/*.ts` leaf subclasses too, e.g. `block.ts`'s
own `drawPattern(...)` calls) to match that shape exactly, and calls
`registerGridDraw2D(applyDraw2DGridMixin)` as a real module-load-time side effect at the bottom of
the file (see the file's own header comment for why self-registration on import — rather than
requiring an explicit bootstrap call, unlike the genuinely pluggable `registerAxis`/`registerBrush`/
`registerWidget` — is the right translation for this specific case: there is exactly one real 2D
implementation, and this project has no "assemble everything" entry-point file yet). `src/index.ts`
re-exporting `applyDraw2DGridMixin` from `grid/draw2d.ts` is therefore enough, on its own, to wire
the mixin into every `CoreGrid` subclass that gets constructed afterward.

**Implementation shape**: ported as a batch of plain function closures over a local `const self =
target as unknown as Draw2DTarget` inside `applyDraw2DGridMixin(target)`, assigned onto the target
via `Object.assign(target, {...})` — NOT a class whose methods get copied via
`Object.assign(target, new Draw2DGrid())` (a real trap worth flagging: class prototype methods are
NOT the instance's own enumerable properties, so that approach would have silently copied nothing
useful). This mirrors the original precisely: `draw.call(this)` in `grid/core.js`'s `drawGrid()`
runs `Draw2DGrid`'s constructor body with `this` bound DIRECTLY to the grid instance being rendered
— `this.createGridX = function(){...}` etc. assign straight onto that instance, no intermediate
object ever exists. Every internal cross-call between these methods (e.g. `createGridX` calling
`drawValueLine`, `drawPattern` calling `fillRectObject`, `drawBaseLine` calling `drawAxisLine`) goes
through `self.methodName(...)` — a genuine, deliberate choice over calling the sibling closures
directly, so that these calls remain late-bound/overridable through the target instance exactly like
the original's own uniform `this.methodName(...)` dispatch (confirmed the distinction actually
matters: an earlier draft that called sibling closures directly broke `draw2d.spec.ts`'s
`fillRectObject`-spy assertion, since a spy replaces `target.fillRectObject`, not the closure).

**End-to-end confirmation available from THIS batch's own files**: `panel.spec.ts`/
`overlap.spec.ts`/`table.spec.ts` each include a dedicated "end-to-end render() with the real
draw2d.ts mixin" test — registers the REAL `applyDraw2DGridMixin` (not a mock) via
`registerGridDraw2D`, constructs a real `PanelGrid`/`OverlapGrid`/`TableGrid`, and calls the real,
inherited `.render()` (from `Draw`, through `CoreGrid`) — confirming `drawGrid()` finds the
registered mixin without throwing, that `createGridX`/`createGridY`/`drawImage`/`drawValueText`
become real functions on the instance, and that the render's other observable effects (rect count,
`display:none` from the forced `grid.hide`) come out correct. This is a real `CoreGrid` subclass
from this exact batch, not a hypothetical — so the wiring is proven against genuine, concurrently-
shippable product code, not just the mixin's own shape in isolation. `draw2d.spec.ts` itself (25
tests) additionally exercises the mixin standalone, applied directly onto a bare `CoreGrid`
instance, covering every one of the 9 methods' own branches independently (tick-line orientation,
`drawValueLine`'s `checkDrawLineX`/`checkDrawLineY` gating and dashed-stroke handling,
`fillRectObject`'s gradient/rect/neither branches, `drawPattern`'s guard clauses and value-pair
fill loop, `drawImage`'s block-vs-non-block positioning across all 4 orients, `drawValueText`'s 4
position branches and `grid.hideText` guard).

**One small reconciliation this file required, done WITHOUT touching `grid/core.ts` itself** (kept
out of that already-landed file's blast radius, same discipline `grid/core.ts`'s own header comment
used for `base/axis.ts`): `this.chart.text(...)` (used by `drawValueText`) isn't part of what
`axis.js`/`grid/core.js` themselves call, so neither `AxisChart` nor `grid/core.ts`'s own
`GridChart` declare it. Resolved via a local `Draw2DChart = GridChart & { text(...): TransElement
}` type, used only for this file's own `self.chart` field — confirmed real, not invented:
`src/base/builder.ts`'s `Builder.text(attr, textOrCallback?)` already exists, so a real `Builder`
instance satisfies `Draw2DChart` today with zero changes needed anywhere else.

**Preserved bugs/quirks specific to `draw2d.ts` itself** (beyond the ones it merely inherits/
exercises from already-documented `grid/core.ts` findings, e.g. `getLineOption()`'s dead
`.type`-array-split branch, `getGridSize()`'s `depth`/`degree` `NaN` bug reachable via
`drawBaseLine()`): `drawAxisLine()` builds its line via `this.chart.svg.line(...)` directly — NOT
via `this.line(...)` (`grid/core.ts`'s own default-merging helper, which `drawValueLine` DOES use)
— a genuinely different default attribute set (no `stroke-dasharray`/theme-driven width defaults,
always `stroke-opacity: 1`). Preserved verbatim, not unified between the two call sites. `drawValueText`'s
`index`/`xy` parameters are accepted (for positional-argument-order fidelity with `grid/core.ts`'s
`drawValueText!` field type and its `drawTop`/`drawBottom`/`drawLeft`/`drawRight` call sites) but
never referenced in either the original or this port's own function body — a genuinely unused
parameter pair upstream, not a porting omission.

### Progress log — `grid/date.js`, `grid/radar.js`, `grid/grid3d.js`

Ported to `src/grid/date.ts`, `src/grid/radar.ts`, `src/grid/grid3d.ts`. Co-located spec files:
`date.spec.ts` (24 tests), `radar.spec.ts` (15 tests), `grid3d.spec.ts` (12 tests) — 51 new tests.
Full repo suite: **709 tests across 41 spec files, 0 failures** (this batch's 51 alongside all
prior Phase A/B/C work, including the concurrently-landed `block`/`range`/`fullblock`/`panel`/
`overlap`/`table`/`draw2d` batches). `npm run typecheck`, `npm run test`, and `npm run build:lib`
all pass clean against the full combined tree (43 modules bundled, up from 40). `src/index.ts`
updated with `DateGrid`/`RadarGrid`/`Grid3D` (+ their config/scale types), inserted alongside the
other concurrently-landed grid exports.

All three `extend: "chart.grid.core"` (`CoreGrid`) directly, confirmed via the original's own
`extend:` field per the dependency map above. None have an existing jui-chart-vue reference
(jui-chart-vue never built a time-axis or radar chart type, and its 3D charts use a simplified
linear/ordinal z-axis rather than this real ported grid) — full independent port/verification for
all three, per this batch's own assignment.

**`grid/date.ts` — class shape (important for the next `grid/dateblock.ts` task, which `extend:
"chart.grid.date"`s this class)**: `DateGrid extends CoreGrid`, zero-parameter constructor (same
as `CoreGrid` itself). Public surface kept 1:1: `center`/`top`/`bottom`/`left`/`right` (the
`this[this.grid.orient]` dispatch targets), `wrapper()` (overrides `CoreGrid.wrapper()`'s identity
default — index-vs-raw-value scale wrapping via `key`), `initDomain()`, `drawBefore`/`draw`
(arrow-field-typed, matching `CoreGrid.drawAfter`'s established TS2425-avoidance convention since
`Draw` declares `draw?`/`drawBefore?` as properties, not methods), plus the render-populated
instance fields (`scale`/`ticks`/`values`/`start`/`size`/`end`/`bar`/`interval`) and a `grid:
DateGridConfig` field-type override (narrowed from `Draw.grid: any`). Real Phase A dependencies
used as real imports: `util/scale.ts`'s `time()` (the same "bundle" `util.scale` module every
other `grid/*.ts` consumes) and `util/time.ts`'s `format()`/unit-name constants. `top`/`bottom`/
`left`/`right`/`center` additionally need `drawPattern`/`drawBaseLine`/`drawCenter` — real
`grid/draw2d.ts`/`grid/draw3d.ts` mixin methods `CoreGrid` itself doesn't declare (only
`createGridX`/`createGridY`/`drawImage`/`drawValueText` are, since those are all `CoreGrid`'s own
methods reference) — declared here as definite-assignment (`!`) fields, same convention/
consequence as `grid/core.ts` established for its own not-yet-mixed-in members. Now that
`grid/draw2d.ts` has landed (concurrently, this same round) and self-registers via
`registerGridDraw2D()` on import, `DateGrid.top()`/etc. work end-to-end through a real render pass
without further changes here.

**`grid/date.ts` preserved bugs/quirks** (Node-cross-checked, not obvious from a single read):
  - **`initDomain()` crashes with `TypeError: Cannot read properties of null (reading 'length')`
    for a fully-default-config `DateGrid` (no `domain`/`min`/`max` set)** — a severe, previously-
    undocumented finding. When `grid.domain` is left at its default `null`, the "else" branch sets
    `valueList = this.grid.domain` (i.e. `null`); if `min`/`max` are ALSO left `undefined`, the
    very next line unconditionally reads `valueList.length` inside an `&&` — `null.length` throws.
    Node-verified. Supplying an explicit `domain` (string/function/array) or explicit `min`+`max`
    avoids it (short-circuits past the `.length` read). Tested (`date.spec.ts`, both the crash and
    the explicit-min/max escape).
  - The function-domain branch's `value_list[index] = Math.max(...)` / `value_list.push(Math.min(
    ...))` interleave into a jumbled array as the countdown loop runs (Node-verified concrete
    example: `[5, 9, 3, 0, 2, 1]` for 3 rows) — harmless since only the overall `Math.min`/`Math.max`
    across the whole array are read afterward (order-independent). Tested.
  - `grid.min || undefined` / `grid.max || undefined`: an explicit `min: 0` (or `max: 0`) is falsy,
    so it's silently treated as unset and overridden by the auto-computed value. Tested.
  - `this.scale(ticks[i])` passes a real `Date` instance to a `TimeScale` typed `(x: number) =>
    number` — works at runtime via JS's `ToPrimitive` coercion inside `linear()`'s comparisons,
    cast through for 1:1 fidelity rather than pre-converting to a timestamp.
  - `static setup()` returns only `DateGrid`'s own 8 fields, byte-faithful to the original literal
    — does NOT additionally merge `CoreGrid.setup()`'s base fields. This mirrors a real,
    pre-existing gap at the `base/axis.ts`/`grid/core.ts` boundary (documented in `date.ts`'s
    header comment): the real original library's `defineOptions()` walks the full `extend:` parent
    chain to merge every ancestor's `.setup()`, but this port's `base/axis.ts` (already shipped,
    out of this task's scope) only ever calls `GridCtor.setup()` one level deep. Not something this
    task introduced or should silently "fix" by inventing new chain-merging logic elsewhere.

**`grid/radar.ts`**: `RadarGrid extends CoreGrid`, zero-parameter constructor. Uses `util/math.ts`'s
`rotate()` throughout (domain-spoke walking + per-value coordinate rotation). Unlike `date.ts`/
`grid3d.ts`, `draw()` builds its own SVG tree directly and returns `{root, scale}` itself —
completely bypasses `CoreGrid.drawGrid()`/`top`/`bottom`/etc., so it has zero dependency on the
`draw2d.ts`/`draw3d.ts` mixin. Needed a locally-extended `RadarGridChart = GridChart & {padding,
text}` type (both real, already-present `Builder` surface) since `chart.padding(key)`/`chart.text(
attr, text)` aren't called by `axis.js`/`grid/core.js` themselves, so neither `AxisChart` nor
`GridChart` declare them — resolved without touching `grid/core.ts`, same discipline `draw2d.ts`'s
own `Draw2DChart` local extension already established.

**`grid/radar.ts` preserved bug** (Node-cross-checked, not obvious from a single read):
`initDomain()`'s STRING-domain branch, when `grid.reverse: true`, walks `data` BACKWARDS to build
`domain` — but the shared tail (`if (this.grid.reverse) domain.reverse();`, applied unconditionally
after all three branches) then reverses that already-backwards array AGAIN, landing back at forward
order. Node-verified: 3 rows with field values `"a","b","c"`, `reverse: true` → the backward walk
alone produces `["c","b","a"]`, but the final reverse flips it back to `["a","b","c"]` — IDENTICAL
to what `reverse: false` produces. The function/array-domain branches have no such backward walk,
so `reverse: true` DOES visibly reverse their result there — only the string-domain branch's
`reverse` option is silently a no-op. Tested (`radar.spec.ts`, contrasting all three branches).

**`grid/grid3d.ts` — Phase D interface boundary: NONE needed.** Despite being framed as the
"2D/3D-shared grid variant" and living alongside `grid/draw3d.ts` (which DOES have a hard,
documented `polygon/{grid,line,point}.js` dependency), `grid/grid3d.js` itself never references
`polygon/*.js` at all (confirmed by reading the original in full) — it only draws plain 2D `<line>`
elements via `CoreGrid.line()` (already-shipped) positioned with trig math, not an actual 3D
polygon mesh. The "minimal TypeScript interface for an unported dependency, documented for later
reconciliation" contingency this task was briefed to consider did not apply here. `Grid3D extends
CoreGrid`, zero-parameter constructor; uses `util/math.ts`'s `radian()` only (no `rotate()`, unlike
`radar.ts`). Registered as the z-axis grid type (`base/axis.ts`'s `drawGridType()` forces `orient:
"center"` for `k === "z"`) — since `Grid3D` defines no `top`/`bottom`/`left`/`right`/`center`
(genuinely absent in the original too), `CoreGrid.drawGrid()`'s `this[this.grid.orient]` lookup
never resolves to a function, so its whole mixin-registration block is skipped (the same
"orient-doesn't-resolve-skips-mixin" quirk already tested in `core.spec.ts`) — meaning this file
has ZERO dependency on the `draw2d.ts`/`draw3d.ts` mixin either, unlike `date.ts`.

**`grid/grid3d.ts` preserved bugs/quirks** (Node-cross-checked, not obvious from a single read):
  - **A severe, previously-undocumented bug**: `drawBefore()`'s `degree = this.axis.get("degree")`
    falls through `Axis.get()` to the raw `cloneAxis.degree` config value, whose documented/default
    shape (`Axis.setup()`: `{x:0,y:0,z:0}`) is an OBJECT, not a number. `radian = math.radian(360 -
    degree)` then computes `360 - {x,y,z}` — JS's `ToNumber` coercion (no custom `valueOf`, falls
    through to `toString()` → `"[object Object]"` → `NaN`) makes this `NaN` in every standard-
    schema configuration (Node-verified). This poisons BOTH `draw()`'s depth-line-endpoint geometry
    (`Math.sin/cos(radian)*depth`) AND `this.scale`'s multi-step z-projection branch with `NaN` —
    `Grid3D`'s entire depth-line rendering/z-projection is silently broken for any chart using the
    standard `axis.degree` config object. Same CATEGORY of bug `grid/core.ts`'s `getGridSize()`
    already documented (object-vs-number coercion on `axis.degree`), but a DIFFERENT code path
    (`axis.get("degree")` here vs. the live `axis.degree` field there) and far more severe
    consequence (poisons the whole render, not one conditional branch). Tested both the NaN case
    and, for contrast/hand-traceability, an atypical numeric-`degree`-override case that computes
    correctly (confirming the bug is specifically the object-vs-number coercion, not a hard crash).
  - **A second, independent, previously-undocumented bug found via this batch's own test-writing
    process (not obvious from reading the code once)**: `getElementAttr(root)` doesn't `break`/
    return early on its first matching `<line>` child — it keeps overwriting its result for every
    match, so with MULTIPLE direct `<line>` children it returns the LAST one, not the first. This
    is genuinely reachable in `draw()`: `yRoot.each()` runs first and, in its own "is a line"
    branch, appends a NEW `<line>` directly onto `yRoot` itself — so by the time `xRoot.each()`
    later calls `getElementAttr(yRoot)`, `yRoot` can have two direct `<line>` children, and the
    freshly-appended one's (already depth-transformed) `y2` wins over the original axis line's —
    silently changing `xRoot`'s own depth-line geometry based on render order. Caught by this
    batch's own `grid3d.spec.ts` failing on first run against a naively-computed expected value
    (53) instead of the real one (58.00000000000001) — Node-cross-checked and documented in both
    `grid3d.ts`'s `getElementAttr()` doc comment and a dedicated isolated test.

### Progress log — `grid/dateblock.js`, `grid/log.js`, `grid/rule.js`

Ported to `src/grid/dateblock.ts`, `src/grid/log.ts`, `src/grid/rule.ts`. Co-located spec files:
`dateblock.spec.ts` (20 tests), `log.spec.ts` (10 tests), `rule.spec.ts` (26 tests) — 56 new tests.
Full repo suite: **765 tests across 44 spec files, 0 failures** (this batch's 56 alongside all
prior Phase A/B/C work, including the 709 already landed). `npm run typecheck`, `npm run test`,
and `npm run build:lib` all pass clean against the full combined tree (46 modules bundled).
`src/index.ts` updated with `DateBlockGrid`/`DateBlockGridConfig`, `LogGrid`/`LogGridOptions`, and
`RuleGrid`/`RuleGridOptions`.

**Extend chains, all confirmed via the original's own `extend:` field, not assumed**:
`DateBlockGrid extends DateGrid` (`extend: "chart.grid.date"`), `LogGrid extends RangeGrid`
(`extend: "chart.grid.range"`), `RuleGrid extends CoreGrid` (`extend: "chart.grid.core"`) — all
three exactly as this project's own dependency map already predicted; no surprises on the extend
chain itself for any of the three.

**`grid/rule.js`'s real Phase D dependency status — resolved precisely, per this batch's specific
assignment to verify it, not trust either prior claim**: a concurrent agent's report had flagged a
POSSIBLE Phase D (`polygon/`) dependency for this file. Investigated exhaustively rather than
assumed: `rule.js` has ZERO import/`jui.include(...)` reference to anything under `polygon/`,
confirmed by reading the original in full. **No real Phase D dependency exists — ported fully now,
per this task's instructions.** The likely false-trail source was found and documented precisely:
`rule.js`'s own `this.axisLine({...})` calls (bare, no "draw" prefix) superficially resemble
`grid/draw3d.js`'s comment block, which is literally labeled `@method axisLine` immediately above
its own, differently-named, differently-shaped real method `this.drawAxisLine = function(position,
axis) {...}`. Grepping the ENTIRE `juijs-graph` source tree for `axisLine` (not just `grid/`, not
just `draw3d.js`) confirms `this.axisLine(...)` is called ONLY by `rule.js` (4 times) and is NEVER
DEFINED anywhere — not by `CoreGrid`, not by `grid/draw2d.js`'s or `grid/draw3d.js`'s real mixins
either (both define the similarly-named-but-different `drawAxisLine` instead). This is therefore
not a "minimal Phase D interface boundary" situation at all (unlike `grid/draw3d.ts` itself, which
genuinely does need one) — it's a separate, permanent, unfixable upstream bug (see below).

**`RuleGrid` is genuinely, severely, MULTIPLY broken in the real original engine — three
independent, previously-undocumented bugs "layer" on top of each other** (Node/hand-verified
against literal transcriptions, not merely inferred from a single read; same "onion" bug category
`grid/table.ts`'s own doubly/triply-dead `custom()` loop already established):
  1. **`draw()` always throws, unconditionally.** The original: `this.draw = function() { return
     this.drawGrid(chart, orient, "rule", grid); }` — `chart`/`orient`/`grid` are bare, NEVER-
     DECLARED identifiers (not `this.chart`/`this.grid`; `orient` isn't declared anywhere in the
     file at all). JS evaluates call arguments left-to-right before the call itself, so reading
     `chart` first throws `ReferenceError: chart is not defined` immediately (Node-verified) —
     `this.drawGrid(...)` is never even invoked. Reproduced literally (same convention as
     `math.ts`'s `niceFraction`), not adapted away the way every other concrete grid's harmless
     dead-STRING-argument case (`this.drawGrid("block")`, already-discarded by `drawGrid()` itself)
     was.
  2. **`initDomain()`'s "else" branch (neither string nor function `grid.domain`) references a
     bare, never-declared `grid` identifier too** (`value_list = grid.domain;`, unlike every other
     read in the same method, which correctly uses `this.grid.*`). Since `RuleGrid.setup()`'s own
     default is `domain: null` (neither "string" nor "function"), **this is the branch a
     default-configured `RuleGrid` actually takes** — `initDomain()` itself throws
     `ReferenceError: grid is not defined` for the common case, independently of bug 1 (reached
     earlier in the render sequence: `Draw.render()` → `drawBefore()` → `initDomain()`, before
     `draw()` is ever called).
  3. **`top()`/`bottom()`/`left()`/`right()` each call `this.axisLine({...})` as their first
     statement — never defined anywhere** (see above) — `TypeError: this.axisLine is not a
     function` on every real invocation. Doubly unreachable via a genuine `render()` call (bugs 1
     and 2 both throw first), but independently, directly callable/testable (same convention
     `grid/overlap.ts`'s/`grid/table.ts`'s own independently-broken, real-render-unreachable
     methods already use) and independently broken on their own terms.
Net effect: a `RuleGrid`, as literally written in the real original engine, can never successfully
render through any orient. Not fixed here — preserved faithfully throughout, each bug reproduced at
its own exact call site, each covered by its own direct (non-`render()`-path) test in
`rule.spec.ts`. `axisLine` itself is declared as a definite-assignment field
(`axisLine!: (attr) => TransElement`) deliberately never assigned by anything in this port either —
calling any of `top`/`bottom`/`left`/`right` throws the same `TypeError` the original does,
faithfully, distinct from `CoreGrid`'s own mixin-pending fields (`createGridX!` etc, which really
do get assigned once `registerGridDraw2D`/`registerGridDraw3D` run — this one never does, by
anything, ever).

**`RuleGrid.initDomain()`/`drawBefore()` closely resemble `RangeGrid`'s own, but are NOT a shared/
inherited implementation** (this file extends `CoreGrid` directly, not `RangeGrid` — confirmed
above; the resemblance is coincidental, matching the original's own lack of a real
`extends RangeGrid` relationship) — real, previously-undocumented divergences found and preserved,
Node-cross-checked, tested in `rule.spec.ts`:
  - String-domain branch shares `RangeGrid.initDomain()`'s already-documented
    `Math.max(value)`/`Math.min(value)`-with-no-`.apply` bug, but does NOT share `RangeGrid`'s own
    unconditional `value_list.push(0)` per non-array row.
  - After computing `tempMin`/`tempMax`: simple `if (typeof min == 'undefined') min = tempMin;`
    (no `RangeGrid`'s own `|| min > tempMin` re-widening) — an explicitly configured `grid.min`/
    `grid.max` is honored EXACTLY as given, never widened outward by a smaller/larger computed
    value the way `RangeGrid.initDomain()` does.
  - `this.grid.max = max; this.grid.min = min;` — mutates the shared `grid` config object with the
    resolved min/max (same "config object mutated in place" category `base/axis.ts`'s two-phase
    `axis.x`/`.y` finding, `dateblock.ts`'s `grid.unit` mutation, and `log.ts`'s `grid.unit = false`
    mutation below all document) — genuinely absent from `RangeGrid.initDomain()`.
  - `unit = Math.ceil((max - min) / this.grid.step)` — much simpler than `RangeGrid`'s fixed-point
    (`math.div`/`math.fixed`-based) unit computation; no `unit > 1`/`0 < unit < 1` branching.
  - The domain-snapping loops use plain floating-point `+=`/`-=`, NOT `RangeGrid`'s decimal-safe
    `math.fixed()`-based stepping — genuinely more susceptible to binary floating-point drift for a
    non-integer `unit`.
  - No `domain.step` bolt-on property at all (the original's own line computing it is literally
    commented out).
  - `drawBefore()` never calls `.clamp(...)` (same omission category `log.ts`'s own finding below),
    never reverses `this.ticks` for left/right orient (unlike `RangeGrid.drawBefore()`), and sets
    `this.hideZero`/`this.center` — two fields `RangeGrid` doesn't have, read by `top`/`bottom`/
    `left`/`right`'s own independent rendering implementation (which builds its own `<g>` tree
    directly via `this.chart.svg.group()`/`.translate()`/`.append()`, NOT delegating to
    `CoreGrid.drawTop()`/etc at all — zero dependency on the `draw2d.ts`/`draw3d.ts` mixin, same
    "builds its own SVG tree directly" pattern `grid/radar.ts` already established). `drawBefore()`
    still reaches the already-documented `util/math.ts` `nice()` `ReferenceError` when `nice: true`
    (tested, routed around bug 2 via an explicit string domain).

**`grid/dateblock.ts` — class shape, extends `DateGrid` directly**: only `wrapper()`/
`initDomain()`/`drawBefore`/`draw` are overridden (confirmed by reading the original in full);
`top`/`bottom`/`left`/`right`/`center` are inherited from `DateGrid` completely unchanged.
`wrapper()` is a full, non-cooperative OVERRIDE (not an extension) of `DateGrid.wrapper()` — ignores
`key` entirely and instead permanently mutates whatever scale it's given by tacking on a `rangeBand
()` method (reading `this.grid.unit`, itself written by this file's own `drawBefore()`), returning
the same scale object unchanged. `initDomain()` is a near-duplicate of `DateGrid.initDomain()` with
two real, previously-undocumented divergences (Node-cross-checked, not obvious without diffing both
files directly): (1) the string-domain branch never got `DateGrid.initDomain()`'s `data.length > 0`
guard — an empty `data` array throws `TypeError: Cannot read properties of undefined` reading
`data[0][field]`; (2) the final min/max auto-computation never got the `value_list.length > 0`
guard either, but this does NOT crash the way `DateGrid`'s own documented gap does —
`Math.min/max.apply(Math, null)` resolves to `[Infinity, -Infinity]` instead of throwing
(`Function.prototype.apply` treats a `null` argsList as zero arguments — Node-verified). Also sets
`domain.interval` as a bolt-on ARRAY property (matching the original's own shape), NOT
`this.interval` the way the inherited `DateGrid.interval` instance field works — this file's
`drawBefore()` never touches that inherited field at all. `drawBefore()` itself: uses
`.rangeRound(range)` instead of `DateGrid`'s `.range(range)`; never calls `.clamp(...)`; never
filters ticks/values by `obj.start`/`obj.end` (every tick `time.ticks()`/`.realTicks()` returns is
kept); computes `unit = this.grid.unit = Math.abs(range[0]-range[1]) / (axis.data.length - 1)`
(mutating the shared config object — a real, previously-undocumented divide-by-zero/NaN quirk when
`axis.data.length` is 0 or 1, Node-verified and tested: length 1 → `Infinity`, length 0 → silently
negated unit); and finally REPLACES `this.scale` entirely with an index-based positioner
(`Object.assign((i) => this.start + i*unit, timeScale)`) — ticks/labels come from the real time
domain, but each tick's screen position comes from its own array INDEX, not its date value. `grid/
dateblock.js` has NO `.setup()` of its own at all (confirmed by reading the original in full,
unlike every other concrete grid class ported so far) — deliberately not overridden here either, so
`DateBlockGrid.setup()` resolves via real ES `class extends` static inheritance straight through to
the inherited `DateGrid.setup()` (documented as a deliberate, behavior-preserving-or-better
consequence of porting a constructor-function-based registry as real classes, not a silent
deviation — there's no original "DateBlockGrid.setup() resolves to nothing" behavior to regress
from, since the original registry's own inheritance semantics for a missing subclass `.setup()`
were never independently verifiable without jui-core, itself deferred per this file's own Phase 0
preamble).

**`grid/log.ts` — class shape, extends `RangeGrid` directly**: only `drawBefore`/`draw` are
overridden (confirmed by reading the original in full); `center`/`top`/`bottom`/`left`/`right`/
`wrapper`/`initDomain` are inherited from `RangeGrid` completely unchanged — including `RangeGrid`'s
own `this.scale.min()`/`.max()` calls in the orient methods, satisfied by `LogScale.min()`/`.max()`
per `util/scale/log.ts`'s own interface (Phase A, no changes needed there). Preserved quirks, all
Node-verified, all previously undocumented:
  1. **`this.grid.unit = false` is forced BEFORE calling the inherited `initDomain()`** (config-
     object mutation, same category as `dateblock.ts`'s own `grid.unit` mutation and `rule.ts`'s
     `grid.min`/`grid.max` mutation above) — `RangeGrid.initDomain()`'s own unit-resolution only
     takes its `function`/`number` branches for a real function/number `grid.unit`; `false` matches
     neither, so `LogGrid` ALWAYS falls through to the auto-computed-from-`step` branch, silently
     discarding any numeric/function `unit` a caller explicitly configures on a log grid. Tested (a
     configured `unit: 5` is proven inert by comparing against an otherwise-identical grid with no
     `unit` configured at all — identical ticks either way).
  2. **`LogGrid.drawBefore()` never calls `.clamp(...)` at all**, unlike the inherited
     `RangeGrid.drawBefore()`'s own explicit `this.scale.clamp(this.grid.clamp)` — a log grid's
     scale is therefore never clamped, regardless of the `grid.clamp` config. Tested by proving
     `clamp: true` and `clamp: false` produce byte-identical scale output.
  3. **`this.step = this.grid.step` reads the raw CONFIGURED step directly, NOT `domain.step`**
     (the auto-computed "nice" step count `RangeGrid.initDomain()` itself still computes and sets)
     — a real divergence from `RangeGrid.drawBefore()`'s own `this.step = domain.step`. Tested.
  4. **`LogGrid.setup()` does NOT merge `RangeGrid.setup()`'s own fields** (`domain`/`min`/`max`/
     `unit`/`clamp`/`reverse`/`key`) — same "one-level-deep `GridCtor.setup()` merge" gap
     `date.ts`'s header comment already documents for `DateGrid`/`CoreGrid`. Verified this specific
     gap is BENIGN for every affected `LogGrid` field (unlike `DateGrid`'s crash-risk case): every
     field defaults to `undefined` instead of its own documented default, but every read site
     treats `undefined` identically to that default (falsy/no-op either way) — `grid.unit` and
     `grid.clamp` are moot regardless, per quirks 1/2 above.
`LogGrid.drawBefore()`/`ticks()`/`values` cross-checked against an independently-built reference
`log()` scale (`util/scale/log.ts`, already Phase-A-tested) constructed over the SAME resolved
domain `LogGrid`'s own `initDomain()` (inherited from `RangeGrid`) produces, NOT the raw
`grid.domain` literal (a real early test-writing mistake this batch's own verification process
caught: `log().domain()`'s `checkMax()`/`getNextMax()` step can silently widen the resolved
domain's upper bound further, e.g. `12 → 100`, so hardcoded boundary-value assertions against the
literal configured domain failed on first run — fixed by re-deriving the resolved domain via
`g.initDomain()` for the reference scale too, same "cross-check via independently reproducing the
same already-tested Phase A primitive" convention `date.spec.ts`'s own realtime test already
established).

**Verification**: 56 new hand-traced/Node-cross-checked tests across the three spec files (20 + 10
+ 26), covering every quirk/bug above with its own direct test, plus `static setup()` shapes
(`DateBlockGrid.setup()` inheriting `DateGrid.setup()`'s exact literal; `LogGrid.setup()`'s
byte-faithful 4-field literal; `RuleGrid.setup()`'s byte-faithful 12-field literal), `wrapper()`
behavior for all three, and `drawBefore()`'s scale/ticks/values wiring. `npm run typecheck`, `npm
run test` (**765 tests across 44 spec files, 0 failures**), and `npm run build:lib` (clean, 46
modules bundled) all pass against the full combined tree. `src/index.ts` updated with
`DateBlockGrid`/`DateBlockGridConfig`, `LogGrid`/`LogGridOptions`, `RuleGrid`/`RuleGridOptions`.

**Phase C status after this batch**: every `grid/*.js` file is now ported except `grid/draw3d.js`,
which remains genuinely blocked on Phase D (`polygon/{core,point,line,grid}.js` — confirmed, not
assumed, per `grid/core.ts`'s own dependency map: `grid/draw3d.js` DOES have real
`polygon/`-referencing content, unlike `rule.js`'s false trail investigated above). Recommended
next: Phase D (`polygon/core.js`/`polygon/point.js`/`polygon/line.js`/`polygon/cube.js`/
`polygon/grid.js`), after which `grid/draw3d.ts` can come back around to close out Phase C fully.

### Progress log — `grid/draw3d.js` (Phase C's last item — Phase C is now complete)

Ported to `src/grid/draw3d.ts` as `applyDraw3DGridMixin(target)`, with co-located `draw3d.spec.ts`
(34 new tests). Full repo suite: **841 tests across 50 spec files, 0 failures** (this batch's 34
alongside all prior Phase A–D work, including the concurrently-completed Phase D `polygon/*.ts`
batch this file was blocked on). `npm run typecheck`, `npm run test`, and `npm run build:lib`
(clean, 52 modules bundled, up from 49) all pass against the full combined tree.

**Mixin shape — identical convention to `grid/draw2d.ts`, confirmed deliberately, not just copied**:
sibling to `grid/core.ts` (`extend: "chart.draw"`, confirmed via grep, NOT a `CoreGrid` subclass), a
batch of plain function closures over `const self = target as unknown as Draw3DTarget`, assigned
onto the target via `Object.assign(target, {...})` — not a class-then-copy (would silently copy
nothing useful, per `draw2d.ts`'s own documented reasoning, reused verbatim here). Every internal
cross-call goes through `self.methodName(...)` for the same late-bound/overridable-through-the-
target-instance reason `draw2d.ts` already established and tested. Registered via
`registerGridDraw3D(applyDraw3DGridMixin)` as a real module-load-time side effect at the bottom of
the file — same self-registering-on-import convention (there is exactly one real 3D-draw
implementation; this project still has no "assemble everything" bootstrap entry point).

**`registerGridDraw3D` wiring confirmation, against a real consumer**: `draw3d.spec.ts`'s own
"end-to-end render() with the real draw3d.ts mixin" test registers the REAL
`applyDraw3DGridMixin` (not a mock) via `registerGridDraw3D`, constructs a real `BlockGrid`
(`grid/block.ts`, already landed) with a stub `Axis` whose `isFull3D()` returns `true` and
`grid.orient: "center"`, and calls the real, inherited `.render()` (from `Draw`, through
`CoreGrid`). Confirms: `grid/core.ts`'s `drawGrid()` correctly picks `draw3DMixin` over
`draw2DMixin` based on `axis.isFull3D()` (already tested in isolation by `core.spec.ts`, now
exercised for real here); `BlockGrid.center()`'s own `this.drawCenter(...)`/
`this.drawBaseLine('center', g)` calls resolve to real functions (not `TypeError: ... is not a
function`); the render produces the expected DOM shape (root has exactly 2 children — one group
per `drawCenter`/`drawBaseLine` `g.append()` call — the `drawCenter` group holds 3 real text nodes
from `drawValueTextCenter`'s 3-tick loop, since `grid.line` defaults to `false` so
`drawValueLineCenter` is skipped; the `drawBaseLine` group holds exactly 1 face polygon); and that
face polygon's `points` attribute is still `undefined` even through a full real render pass — the
same preserved bug the standalone unit tests demonstrate (see below), now confirmed reachable
through actual product code, not just the mixin's own shape in isolation. This is a real `CoreGrid`
subclass this project already ships, not a hypothetical.

**Real consumers beyond this test**: grepped `src/grid/*.ts` directly (not assumed) — `block.ts`,
`range.ts`, `fullblock.ts`, and `date.ts` (four concrete `CoreGrid` subclasses, all already landed)
each declare their own `drawCenter!`/`drawBaseLine!` definite-assignment fields and call
`this.drawCenter(...)`/`this.drawBaseLine(...)` from their own `center()`/`top()`/`bottom()`/
`left()`/`right()` orient methods — every one of them becomes fully drawable in full-3D mode
(`axis.isFull3D() === true`) now that this file exists and self-registers on import.

**A real, previously-undocumented bug found and preserved**: `drawAxisLine()` builds each grid
"face" (`top`/`bottom`/`left`/`right`/`center` background quad panel) via `this.svg.polygon({...})`
(`PolyElement`, Phase A) and calls `.point(x, y)` once per rotated vertex — but never calls
`.join()` anywhere in the whole file (confirmed via a full grep of the real upstream source). Since
`PolyElement.point()` only pushes into a *private* `orders` array and `.join()` is the ONLY thing
that ever flushes it into the real `points=` SVG attribute, every 3D grid face renders as an
attribute-less `<polygon>` — no visible geometry at all, despite `stroke`/`fill`/`fill-opacity` all
being set correctly on it. Reachable by any real full-3D chart that renders grid faces (i.e. every
one, since `drawBaseLine()` — called by every concrete subclass's orient methods — always routes
through `drawAxisLine()`). Preserved exactly (not "fixed" with an added `.join()` call), per Phase 0
rule 6. Tested both as a standalone unit test (`face.attr("points")` stays `undefined` after
`drawAxisLine()` runs, contrasted with an explicit manual `.join()` call on the SAME instance proving
the accumulated points would have produced a real string had the original called it) and via the
end-to-end `BlockGrid` render test above.

**Other preserved quirks/bugs** (Node/hand-verified, not obvious from a single read):
  - **`this.axis.get("y").hide` gates the SECOND line/face in `drawAxisLine()`/`drawValueLine()`/
    `drawValueLineCenter()` unconditionally — even when drawing an X-axis position (`top`/
    `bottom`)** — never `axis.get("x").hide`, regardless of which axis is actually being rendered.
    Confirmed identical across all three call sites in the original. Tested (both the "Y hidden
    suppresses lo2/face" case and the "non-center positions always append the face regardless of
    Y's hide state" asymmetry for `drawAxisLine` specifically).
  - **`drawValueLine`'s `isActive` parameter is declared but never referenced anywhere in its
    body** — a real behavioral divergence from `draw2d.ts`'s own `drawValueLine`, which genuinely
    uses `isActive` to pick an active/inactive theme color; the 3D version always uses the plain
    `"gridBorderColor"`/`"gridBorderWidth"` keys regardless. Tested (confirms `chart.theme` is never
    called with `"gridActiveBorderColor"`).
  - **`drawValueText`'s `index` parameter is declared but never referenced** (only `xy`/`domain`/
    `position` matter) — same "declared, unused" shape `draw2d.ts`'s own `drawValueText` already
    has for a different pair of parameters. Also: the real original 3D `drawValueText` takes only 5
    parameters (no `move`/`isActive`, unlike the 2D mixin's 7) — `CoreGrid.drawValueText!`'s wider
    7-arg field type is still satisfied (TypeScript allows a function declaring fewer parameters to
    satisfy a type requiring more; the extra arguments are simply ignored, exactly matching real JS
    call-site behavior). Not padded with unused extra parameters that don't exist in the original.
  - **`drawValueTextCenter`'s `values`/`checkActive` parameters are both declared but never
    referenced inside its own body** (only `ticks`/`axis.depth`/`moveZ` drive the loop) — still
    faithfully forwarded from `drawCenter()`'s own call site, matching the original's positional-
    argument-passing exactly even though the callee ignores two of the five. Tested.
  - `drawPattern`/`drawImage` are literal no-ops (`function(){}`) — a full-3D grid never draws a
    background pattern or per-tick image, confirmed intentional (no TODO/stub marker suggesting
    otherwise). Tested.
  - `createGridX`/`createGridY` build their group via a bare `this.svg.group()` with **no**
    `.translate(...)` call, unlike `draw2d.ts`'s equivalents — 3D positioning instead happens
    per-vertex inside `drawValueLine`'s own `LinePolygon`/`calculate3d()` pipeline, a genuinely
    different (not omitted) positioning strategy. Tested.
  - **`this.svg` vs `this.chart.svg`**: every group in this file is built via `this.svg.group()`
    (`Draw`'s own top-level `svg` field), never `this.chart.svg.group()` (`draw2d.ts`'s consistent
    choice). Both are the literal same object at render time in every real reachable path (confirmed
    via `base/axis.ts`'s `drawGridType()`: `obj.svg = this.chart.svg` right after construction), so
    this is a genuine-but-currently-inert difference — preserved verbatim (`self.svg`, narrowed from
    `CoreGrid`'s inherited `svg: any` to the real `SVG` class) rather than silently unified with
    `draw2d.ts`'s own choice, per Phase 0 rule 6's fidelity-over-taste discipline.

**Cross-check note**: this file's entire 3D transform pipeline is the exact same `self.calculate3d(
...)` (`base/draw.ts`, Phase B) call every other 3D consumer in this engine uses — already
cross-checked exhaustively against jui-chart-vue's `usePolygon3d.ts`/`dot3d.js`/`column3d.js`/
`line3d.js`/`rotate3d.js` Phase E writeups in `base/draw.ts`'s and `polygon/core.ts`'s own header
comments (the `Math.max(w,h,d)` depth-vs-`axis.depth/2`-center distinction, the float32-precision
note). Nothing new to re-derive at this grid level — this file is simply another real caller of that
same, already-verified pipeline (via `GridPolygon`/`LinePolygon`/`PointPolygon`, Phase D, instead of
`dot3d.js`'s `vertex()`/`cubeVertices()` stand-ins). No discrepancy found, consistent with every
prior cross-check in this project.

**Verification**: `draw3d.spec.ts`, 34 hand-traced/Node-cross-checked tests, all using the same
"identity-transform oracle" convention `polygon/core.spec.ts`/`polygon/grid.spec.ts` already
established (`degree: {x:0,y:0,z:0}` + `perspective: 1` isolates pure identity rotation, so every
`Vector.x/.y` after `calculate3d()` equals its raw, un-rotated vertex coordinate exactly — making
every coordinate in this file hand-computable without re-deriving the rotation math itself). Covers:
mixin assignment (all 11 methods); `drawPattern`/`drawImage` no-ops; `createGridX`/`createGridY`
(no-translate, line-option forwarding with the right positional `xy` argument, skip-when-falsy);
`drawAxisLine`'s hand-traced quad-face vertex coordinates for all 5 positions (`top`/`bottom`/
`left`/`right`/`center`), the `w`/`h` in-place-reassignment quirks, the `join()`-never-called bug
(with its join-would-have-worked contrast), and the Y-hide gating asymmetry; `drawBaseLine`'s
wrapping; `drawCenter`'s line/no-line branching; `drawValueLine`'s hand-traced line coordinates,
`checkDrawLineX`/`Y` boundary-exclusion gating (inherited from `CoreGrid`, already tested there),
dashed-stroke handling, and the unused-`isActive` quirk; `drawValueLineCenter`'s hand-traced z-mesh
coordinates, the block-vs-non-block `len` divergence, and Y-hide gating; `drawValueText`'s 4 position
branches (`top`/`bottom`/`left`/`right`), `hideText` guard, and unused-`index` quirk;
`drawValueTextCenter`'s per-tick loop, `hideText` guard, and unused-`values`/`checkActive` quirk; and
the full end-to-end `BlockGrid` render test described above. `src/index.ts` updated with
`export { applyDraw3DGridMixin } from './grid/draw3d'`.

**Phase C status: now fully complete.** All 15 `grid/*.js` files are ported and checked off
(`core`/`block`/`range`/`date`/`dateblock`/`log`/`radar`/`rule`/`panel`/`table`/`overlap`/
`fullblock`/`grid3d`/`draw2d`/`draw3d`, grep-verified against this section's own checklist below —
zero remaining `- [ ]` items). See the completion summary at the top of this Phase C section.

- [x] `grid/core.js` → `src/grid/core.ts` — see the "Progress log" writeup immediately above this
      checklist for full detail (real `extends Draw` finding, the abstract-base/mixin-registration
      design, `GridConstructor`/`GridInstance` reconciliation, and every preserved bug/quirk with
      its test). The same writeup also contains the full real dependency map for the 14 files below.
- [x] `grid/block.js` → `src/grid/block.ts` — extends `chart.grid.core` directly (confirmed via
      `extend:` field). Cross-checked against jui-chart-vue's `useAxis.ts`/`useChartLayout.ts` Phase F
      writeup, the "range-axis-reverses/block-axis-never-does" orientation asymmetry — confirmed exact
      match (no discrepancy). See the "Progress log — `grid/block.js`, `grid/range.js`,
      `grid/fullblock.js`" writeup above `grid/core.js`'s own entry for full detail: preserved bugs
      (`initDomain()`'s `grid.reverse` no-op for string domains, `wrapper()`'s effectively-dead-code
      reverse branch), 16 tests in `block.spec.ts`.
- [x] `grid/range.js` → `src/grid/range.ts` — extends `chart.grid.core` directly (confirmed via
      `extend:` field). Cross-checked against jui-chart-vue's `useAxis.ts`/`useChartLayout.ts` Phase F
      writeup (the other half of the reverses/never-reverses asymmetry) — confirmed exact match.
      Confirmed reachable path to `util/math.ts`'s documented `nice()` `ReferenceError` bug (tested
      directly). See the "Progress log" writeup above `grid/core.js`'s own entry for full detail:
      two further preserved bugs in `initDomain()`'s string-domain array handling (missing
      `.apply`/spread on `Math.max`/`Math.min`, and an extra-`push(0)`-per-row asymmetry vs. the
      function-domain branch), 23 tests in `range.spec.ts`.
- [x] `grid/date.js` → `src/grid/date.ts` — extends `chart.grid.core` directly. No existing
      reference; full independent port. See the "Progress log — `grid/date.js`, `grid/radar.js`,
      `grid/grid3d.js`" writeup above `grid/core.js`'s own entry for full detail (class shape for
      `grid/dateblock.ts` to extend, the preserved `initDomain()` null-domain `TypeError` crash and
      other quirks, and every test). 24 tests in `date.spec.ts`. **Lands before `grid/dateblock.ts`**
      (see dependency map) — `grid/dateblock.ts` itself is still unstarted.
- [x] `grid/dateblock.js` → `src/grid/dateblock.ts` — extends `chart.grid.date` (NOT `chart.grid.core`
      directly, confirmed), depends on `grid/date.ts` (landed). See the "Progress log —
      `grid/dateblock.js`, `grid/log.js`, `grid/rule.js`" writeup above `grid/core.js`'s own entry
      for full detail: only `wrapper`/`initDomain`/`drawBefore`/`draw` are overridden (the rest
      inherited from `DateGrid` unchanged), `wrapper()` is a full non-cooperative override tacking a
      `rangeBand()` onto whatever scale it's given, `initDomain()` has two divergences from
      `DateGrid`'s own copy (a missing `data.length > 0` guard that DOES crash, and a missing
      `value_list.length > 0` guard that does NOT), and `drawBefore()` replaces `this.scale`
      entirely with an index-based positioner (the defining "block" behavior) including a
      previously-undocumented divide-by-zero/NaN unit quirk. Has no `.setup()` of its own in the
      original — resolves via real class static inheritance to `DateGrid.setup()`. 20 tests in
      `dateblock.spec.ts`.
- [x] `grid/log.js` → `src/grid/log.ts` — extends `chart.grid.range` (NOT `chart.grid.core` directly,
      confirmed), depends on `grid/range.ts` (landed). Cross-checked against Phase A's already-ported
      `util/scale/log.ts`. See the "Progress log" writeup above `grid/core.js`'s own entry for full
      detail: only `drawBefore`/`draw` are overridden (the rest inherited from `RangeGrid`
      unchanged), and four preserved quirks — forces `grid.unit = false` before `initDomain()` runs
      (silently discarding any configured unit), never calls `.clamp(...)`, reads `grid.step`
      directly rather than the inherited `initDomain()`'s own computed `domain.step`, and its
      `static setup()` doesn't merge `RangeGrid.setup()`'s own fields (verified benign for every
      affected field here, unlike `DateGrid`'s crash-risk case). 10 tests in `log.spec.ts`.
- [x] `grid/radar.js` → `src/grid/radar.ts` — extends `chart.grid.core` directly. No existing
      reference; full independent port. See the "Progress log — `grid/date.js`, `grid/radar.js`,
      `grid/grid3d.js`" writeup above `grid/core.js`'s own entry for full detail (the locally-
      extended `RadarGridChart` type, and the preserved string-domain `reverse` no-op bug). 15
      tests in `radar.spec.ts`.
- [x] `grid/rule.js` → `src/grid/rule.ts` — extends `chart.grid.core` directly (confirmed). Its
      possible Phase D dependency (flagged by a concurrent agent's report) was investigated
      exhaustively and resolved precisely: NO real Phase D dependency exists (`rule.js` never
      references `polygon/*.js` at all) — the false trail was `this.axisLine(...)` merely
      resembling `grid/draw3d.js`'s differently-named/differently-shaped `drawAxisLine` mixin
      method (confirmed via an exhaustive grep of the whole engine: `axisLine` is never defined
      ANYWHERE). Ported fully, per instructions. See the "Progress log" writeup above
      `grid/core.js`'s own entry for the full detail: `RuleGrid` is genuinely, severely, multiply
      broken in the real original engine (three independent, previously-undocumented, layered bugs
      — `draw()` always throws via bare `chart`/`orient`/`grid` identifiers, `initDomain()`'s
      default-reached branch throws via a bare `grid` identifier, and `top`/`bottom`/`left`/`right`
      each call the never-defined `axisLine`), all preserved faithfully and independently tested,
      plus several further divergences from the superficially-similar `RangeGrid.initDomain()`/
      `drawBefore()` (no real inheritance relationship between the two files). 26 tests in
      `rule.spec.ts`.
- [x] `grid/panel.js` → `src/grid/panel.ts` — extends `chart.grid.core` directly, confirmed "nothing
      extra" beyond `util.base`'s `extend()`. See the "Progress log — grid/panel.js, grid/overlap.js,
      grid/table.js, grid/draw2d.js" writeup above `grid/core.js`'s own entry for full detail
      (the always-`x=0,y=0` `custom()` quirk, the forced `grid.hide=true`, and the `drawGrid()`
      argument-dropping adaptation). 4 tests in `panel.spec.ts`.
- [x] `grid/table.js` → `src/grid/table.ts` — extends `chart.grid.core` directly. The
      3-parameter-constructor exception investigated precisely and resolved: confirmed vestigial/dead
      (never referenced in the constructor body; every grid type receives the same 3 real
      construction arguments per `axis.js`'s `drawGridType()`, table.js just uniquely declared params
      for them) — ported with the same 0-arg constructor every other subclass uses, re-verified via a
      compile-time `tableGridConstructorTypeCheck`. A separate, genuinely new finding also surfaced:
      `custom()`'s entire loop body is unreachable dead code (a real `var`-shadowing bug between
      `drawBefore()`'s own locals and the constructor-scope `row`/`column`). See the "Progress log"
      writeup above `grid/core.js`'s own entry for the full investigation trail. No jui-chart-vue
      `useGridLayout.ts` cross-check was ultimately load-bearing (that file is a generic hand-port,
      not derived from this specific file — confirmed no shared verification value beyond generic
      row/column layout sanity, which this port's own hand-traced `table.spec.ts` values already
      cover directly). 8 tests in `table.spec.ts`.
- [x] `grid/overlap.js` → `src/grid/overlap.ts` — extends `chart.grid.core` directly, confirmed
      "nothing extra" beyond `util.base`'s `extend()`. Genuine, previously-undocumented bug found and
      preserved: `custom()` takes zero parameters (unlike `panel.js`'s `custom(g)`), so the rects it
      computes and constructs each render are never appended anywhere — see the "Progress log"
      writeup above `grid/core.js`'s own entry for full detail. 6 tests in `overlap.spec.ts`.
- [x] `grid/draw2d.js` → `src/grid/draw2d.ts` — sibling to `grid/core.ts` (both `extend: "chart.draw"`),
      not a `CoreGrid` subclass. Ported all 9 methods to match `registerGridDraw2D`'s expected
      `GridDrawMixinApplier` shape and calls `registerGridDraw2D(applyDraw2DGridMixin)` as a real
      module-load-time side effect, closing the loop `grid/core.ts` left open. Confirmed working
      end-to-end against real `CoreGrid` subclasses from this same batch (`PanelGrid`/`OverlapGrid`/
      `TableGrid`'s own spec files each include a real `.render()` integration test using this exact
      mixin, not a mock), plus 25 standalone unit tests of the mixin's own 9 methods in
      `draw2d.spec.ts`. See the "Progress log" writeup above `grid/core.js`'s own entry for the full
      implementation-shape rationale (plain function closures over `self`, not a class-then-copy) and
      every preserved quirk/bug.
- [x] `grid/draw3d.js` → `src/grid/draw3d.ts` — sibling to `grid/core.ts` (both `extend: "chart.draw"`),
      not a `CoreGrid` subclass. Phase D dependency (`polygon/{grid,line,point}.js`) now satisfied.
      Ported all 11 methods to match `registerGridDraw3D`'s expected `GridDrawMixinApplier` shape and
      calls `registerGridDraw3D(applyDraw3DGridMixin)` as a real module-load-time side effect,
      finally closing the loop `grid/core.ts` left open for the 3D case. Confirmed working
      end-to-end against a real full-3D `BlockGrid` (`axis.isFull3D() === true`, `grid.orient:
      "center"`) via a real `.render()` call, not a mock — see the "Progress log — `grid/draw3d.js`"
      writeup above `grid/core.js`'s own entry for the full implementation-shape rationale, the
      real-consumer confirmation, the genuinely severe `drawAxisLine()` face-polygon-never-calls-
      `.join()` bug finding, and every other preserved quirk. 34 tests in `draw3d.spec.ts`. **This
      was Phase C's last remaining item — Phase C is now 100% complete.**
- [x] `grid/fullblock.js` → `src/grid/fullblock.ts` — extends `chart.grid.core` directly (confirmed
      via `extend:` field — NOT `BlockGrid`, despite the structural similarity; see the "Progress log"
      writeup above `grid/core.js`'s own entry for the full byte-diff detail). No direct
      jui-chart-vue reference (full independent port for `drawBefore()`/`wrapper()`/the orient
      methods; `initDomain()` is byte-identical to `block.ts`'s own, re-verified directly). Preserved
      bugs: `wrapper()`'s off-by-one reverse-index arithmetic vs. `BlockGrid.wrapper()` (`len - i`
      vs. `len - i - 1`, Node-verified side by side), plus the same string-domain `grid.reverse`
      no-op quirk `block.ts` documents. 13 tests in `fullblock.spec.ts`.
- [x] `grid/grid3d.js` → `src/grid/grid3d.ts` — extends `chart.grid.core` directly. No actual
      `polygon/*.js` (Phase D) dependency despite the framing (confirmed by reading the original in
      full — it only draws plain 2D lines via `CoreGrid.line()`, not a real 3D mesh), so no Phase D
      interface stand-in was needed. `usePolygon3d.ts`'s z-axis handling is a SIMPLIFIED linear/
      ordinal stand-in for this real file, not a direct cross-check source (per the dependency map
      above) — full independent port/verification instead. See the "Progress log — `grid/date.js`,
      `grid/radar.js`, `grid/grid3d.js`" writeup above `grid/core.js`'s own entry for full detail:
      the severe preserved `axis.get("degree")`-is-an-object `NaN` bug (poisons the whole z-axis
      render) and the independently-discovered `getElementAttr()` last-match-wins bug. 12 tests in
      `grid3d.spec.ts`.

## Phase D — Polygon layer (`polygon/`)

The 3D engine jui-chart-vue's `usePolygon3d.ts` already wraps a meaningful subset of. This phase has the
richest existing cross-check material of the whole port.

### Progress log — `polygon/core.js`

Ported to `src/polygon/core.ts` as a real `class PolygonCore` (no base class - `extend: null`,
confirmed directly from source, matching `base/vector.ts`'s own `extend: null`). **Verified, not
assumed, per this task's own explicit instruction**: `PolygonCore` does NOT extend `Vector` - it
only USES `Vector` instances (constructing/mutating them in its own `vectors` field), no inheritance
relationship at all.

**Class structure**: `perspective = 0.9` (field initializer, matches the original's only
constructor-body statement), `vertices!: PolygonVertex[]` (definite-assignment-asserted, NOT
initialized to `[]` - the original never initializes it either; a subclass - `point.ts`/`line.ts`/
`cube.ts`/`grid.ts`, all future Phase D items - is expected to populate it before `rotate()`/
`min()`/`max()` are ever called, and this port preserves that "crashes if called too early" contract
exactly rather than papering over it with a fake default), `vectors?: Vector[]` (optional, guarded
via `Array.isArray()` - a behaviorally-identical substitute for the original's `_.typeCheck("array",
...)`, since only the `"array"` check is needed here, not the full `typeCheck` machinery other files
duplicate). Three public methods, all kept 1:1 by name/parameter order: `rotate(depth, degree, cx,
cy, cz): void`, `min(): Point3`, `max(): Point3`.

**Real dependency reuse (first file in this project to combine them)**: imports and uses the REAL,
already-ported `Transform` class (`util/transform.ts`, Phase A) and `matrix3d`/`scaleValue`
(`util/math.ts`, Phase A) directly - matching the original's own `jui.include("util.transform")`/
`jui.include("util.math")` dependencies exactly, per Phase 0 rule 1. This is the first file in the
whole port to actually exercise both modules together, and it surfaced a real cross-module TS
structural-typing friction: `Transform.matrix()` returns `(number[] | Float32Array)[]`, but
`matrix3d()`'s first parameter is typed `number[][]` - both handle `Float32Array` rows identically
at runtime (plain indexed reads), so this is pure typing friction between two independently-typed
already-locked-in Phase A files, not a behavior difference. Resolved pragmatically: the intermediate
matrix-composition locals (`m`/`m2`) inside `rotate()` are typed `any` (documented inline), while the
public method signatures and `vertices`/`vectors` fields stay fully typed.

**A real, previously-undocumented finding about the ALREADY-PORTED `util/transform.ts` (Phase A, out
of this task's scope to fix), surfaced only by tracing `PolygonCore.rotate()`'s exact real call graph
through `Transform.custom()`**: the ORIGINAL `util/transform.js`'s own private `calculate(m)`
(every `Transform` method, including `custom()`, funnels through it) always calls `math.matrix(m,
points[i])` - `util/math.js`'s GENERIC, dimension-agnostic, PLAIN-ARRAY-producing dispatcher
(`if (typeCheck("array", b[0])) deepMatrix(a,b); else matrix(a,b)` - dispatch purely on whether `b`
is itself a matrix, never on `a`'s size) - for EVERY transform, 2D or 3D alike. The original's
`matrix3d()`/`deepMatrix3d()` (Float32Array-producing) are NEVER called by `Transform` internally at
all; they exist solely as `util.math`'s own separate public API, called directly by consumers like
`PolygonCore.rotate()` itself (its explicit `math.matrix3d(m, t.matrix(...))` composition calls).
This project's already-ported `src/util/transform.ts` instead invented its own dimension-based
`matrixDispatch()` (`is3D = a.length===4 && a[0].length===4`) that routes 4x4 matrix operations
through a locally-duplicated `matrix3d()`/`deepMatrix3d()` (Float32Array-producing) - something the
original never does at this call site. Net effect: this port's own `rotate()`, by faithfully reusing
the REAL (currently in-repo) `Transform` class, inherits one extra layer of float32-precision
rounding on the FINAL per-vertex dot-product sum during `t.custom(m)` that the pristine original
wouldn't have there (both versions already share float32 rounding at matrix CONSTRUCTION time -
`Transform.matrix()`'s literal `new Float32Array([...])` rows - that part is unaffected). Confirmed
via a standalone Node re-simulation of both the real (current) `Transform`+`matrix3d` combination and
a literal transcription of the pristine original's `math.matrix()`-only path: results match to
within ~1e-6 in every hand-traced case below - a sub-ULP-level precision curiosity, not a geometry/
logic bug. **Not fixed here** (a separate, already-completed Phase A file this task was not assigned
to touch) - documented for a future reconciliation pass. This port's own test expectations are
Node-cross-checked against the REAL, currently-in-repo `Transform`+`matrix3d` combination (i.e. what
actually executes today), not the theoretical pristine original.

**Cross-check against jui-chart-vue's `usePolygon3d.ts`, across all four of its consuming
iterations** (per this task's assignment):
  - **`dot3d.js`** (the original `rotatePolygonVertices()` port): confirmed identical two-stage
    algorithm (rotate around `(cx,cy,cz)` via composed `move3d`/`rotate3dx`/`rotate3dy`/`rotate3dz`/
    `move3d(-)`, then an independent per-vertex perspective scale around `(cx,cy,depth/2)` - note the
    DIFFERENT z-center between the two stages, confirmed and preserved exactly, matching
    `usePolygon3d.ts`'s own already-documented finding of the same asymmetry). Reused its
    `rotatePolygonVertices` describe block's 4 hand-traced cases directly as this port's own test
    oracle (identity-rotation-at-z=0 unchanged; identity-rotation-at-z=depth scaling to exactly
    `(145,145,190)`; `rotY(90)` at perspective=1 rotating `(1,0,0)` to `(0,0,-1)`; a non-origin
    rotation center staying fixed under its own rotation) - all four match (within float32-vs-float64
    tolerance, see the precision finding above; the two exact-integer cases, `(100,50,0)` and
    `(145,145,190)`, match to the bit). Also confirmed and reused `base/draw.ts`'s already-ported
    `calculate3d()` (Phase B) as the real caller contract: `rotate(Math.max(w,h,d), r, x+w/2, y+h/2,
    d/2)` - `depth` is `Math.max(plotWidth, plotHeight, axis.depth)`, NOT `axis.depth` directly,
    while `cz` is `axis.depth/2` - a DIFFERENT value in general from `depth`'s own halved value used
    inside stage 2. Both `draw.ts`'s own header comment and `usePolygon3d.ts`'s independently derived
    the identical finding from source; this port's own header comment cross-references both.
  - **`column3d.js`+`line3d.js`** (added `cubeVertices()`/`CUBE_FACES` to `usePolygon3d.ts`, needed
    by `polygon/cube.js` - NOT this file - and confirmed the SAME `chart.draw.calculate3d()` ->
    `PolygonCore.rotate()` call path `dot3d.js` already used, not a parallel/different engine). No
    additional cross-check needed for `core.ts` itself beyond what `dot3d.js`'s entry already
    established - `column3d.js`/`line3d.js` are downstream consumers of the identical `rotate()`
    pipeline, confirming (not revising) the same algorithm. Relevant to a FUTURE `polygon/cube.ts`
    iteration, not this one.
  - **`widget/polygon/rotate3d.js`** (the interactive mouse-drag-to-rotate widget): confirmed it
    produces `axis.degree.x/y/z` INPUTS fed into this same `rotate()` engine, with no separate
    rotation math of its own - nothing for `core.ts` itself to cross-check beyond the `Degree3`
    shape (`{x,y,z}` degrees) already matching `rotate()`'s own `degree` parameter exactly.

**Quirks/bugs preserved** (Node/hand-traced, not fixed, per Phase 0 rule 6):
  - `vertices`/`vectors` un-initialized in the constructor (see "Class structure" above) - a real
    subclass-populates-this-field contract, not an oversight.
  - Stage 2's perspective-scale center reuses `cx`/`cy` from stage 1 but a DIFFERENT z (`depth/2`,
    not `cz`) - see `dot3d.js` cross-check above.
  - `vectors[i] == null` (loose equality) creates a brand-new `Vector`; otherwise the EXISTING
    `Vector` instance is mutated in place (`.x`/`.y`/`.z` reassigned, same object reference kept) -
    tested explicitly (`toBe(existing)` after `rotate()`).
  - The float32-precision-rounding finding in `util/transform.ts` documented above (not this file's
    own bug, but directly affects this file's real runtime output - documented at length in `core.ts`'s
    header comment and re-summarized here).

**Verification**: `core.spec.ts`, 13 hand-traced/Node-cross-checked tests - `perspective` default;
`rotate()`'s two jui-chart-vue-oracle cases individually AND combined into a single multi-vertex call
(confirming the per-vertex scale-factor loop is genuinely independent per vertex, not just per-call);
the `rotY(90)`/perspective=1 and non-origin-center-fixed oracle cases; `vectors` array creation
(`== null` branch), in-place mutation (existing-instance branch), and the non-array/`undefined`
no-throw guard; `min()`/`max()` with 1 and 3+ vertices. `npm run typecheck`, `npm run test` (778
tests across 45 spec files, up from 765 - this batch's 13, 0 failures), and `npm run build:lib` all
pass clean. `src/index.ts` updated with `export { PolygonCore }` plus `PolygonVertex`/`Degree3`/
`Point3` type exports (direct, not namespaced - no collision risk, same convention Phase B/C already
established).

- [x] `polygon/core.js` → `src/polygon/core.ts` — cross-check against `usePolygon3d.ts`'s rotation-matrix/
      perspective-projection functions (already hand-traced/Node-cross-checked in jui-chart-vue across
      dot3d.js/column3d.js/line3d.js/rotate3d.js's four Phase E iterations). See the "Progress log"
      writeup immediately above for the full class structure, cross-check results across all four
      consuming iterations, the real `util/transform.ts` float32-precision finding, and preserved
      quirks.

### Progress log — `polygon/point.js`, `polygon/line.js`, `polygon/cube.js`

Ported to `src/polygon/point.ts`, `src/polygon/line.ts`, `src/polygon/cube.ts`, each a real `class
... extends PolygonCore` (per Phase 0 rule 2), with co-located `*.spec.ts` files (18 new tests: 6
point, 5 line, 7 cube). Full repo suite: 796 tests across 48 spec files, 0 failures (this batch's 18
alongside all prior Phase A-D work). `npm run typecheck`, `npm run test`, and `npm run build:lib` all
pass clean against the full combined tree.

**`extend` chains, confirmed directly from source for all three (not assumed - this task's brief
explicitly warned that a prior iteration found "obvious" sibling relationships were sometimes
wrong)**: all three are `extend: "chart.polygon.core"` — a single-level `extends PolygonCore`
DIRECTLY, none of them extends another sibling primitive (e.g. `LinePolygon` does NOT extend
`PointPolygon` despite "a line is two points" being a plausible-looking guess). Confirmed by reading
each original in full: every factory's own body only ever does `jui.use(core)` and references no
other `polygon/*.js` module; each constructor touches only fields `PolygonCore` itself declares
(`vertices`/`vectors`), except `cube.js`, which adds a genuinely new field (`this.faces`) beyond what
`PolygonCore` has.

**`polygon/point.js` (`PointPolygon(x, y, d)`)** — builds one homogeneous vertex `[x, y, d, 1]`
(constructor's third parameter is literally named `d`, not `z`, preserved 1:1) and an empty
`vectors` array. **Cross-check against jui-chart-vue**: no direct CLASS equivalent (jui-chart-vue is
composable-shaped throughout), but a direct FUNCTIONAL equivalent exists — `usePolygon3d.ts`'s own
`vertex(x, y, z)` helper (`{x, y, z, w: 1}`) builds the identical single-homogeneous-vertex shape.
Confirmed via jui-chart-vue's own `PORT_STATUS.md` (`column3d.js`/`line3d.js` entry): `PointPolygon`
is the SAME primitive both `dot3d.js`'s `createDot` (single point) AND `line3d.js`'s `createLine` (4
separate single-vertex `PointPolygon` calls building a ribbon quad) construct — `usePolygon3d.ts`'s
`vertex()` is jui-chart-vue's shared stand-in for exactly this constructor. No numeric oracle to
reuse (`vertex()` is a trivial object-literal builder), so tests hand-traced fresh, reusing
`core.spec.ts`'s already-verified `rotate()`/`min()`/`max()` cases to confirm inheritance wiring.

**`polygon/line.js` (`LinePolygon(x1, y1, d1, x2, y2, d2)`)** — builds two homogeneous vertices and
an empty `vectors` array. **Cross-check finding, verified precisely per this task's own specific
instruction, not assumed**: jui-chart-vue's own `PORT_STATUS.md` (`column3d.js`/`line3d.js` entry)
documents that `line3d.js`'s `createLine` builds its 4-point ribbon quad from 4 separate single-vertex
`PointPolygon` calls, NOT `LinePolygon` — so `LinePolygon` (`chart.polygon.line`) has NO consumer
anywhere in jui-chart-vue, direct or indirect, confirmed. **However**, a full grep of the real
upstream `jui-graph` source tree (`/home/search5/cl/jui-graph/src`) found `LinePolygon` is NOT dead
code in the original engine itself — it IS constructed, 8 times, by `grid/draw3d.js`
(`jui.include("chart.polygon.line")`, the 3D grid's edge/side outline lines and internal cross-hatch
mesh lines). `grid/draw3d.js` is out of THIS task's scope (per its own instructions: "Do NOT touch
grid/draw3d.ts"), and no jui-chart-vue composable wraps 3D grid-mesh rendering at all, so there is
genuinely no jui-chart-vue reference to cross-check `line.ts` against — but it is real, live code in
the original library, not an unused primitive. Ported as a full independent port accordingly (the
underlying rotation/perspective math is inherited unchanged from `PolygonCore`, already
cross-checked exhaustively). When `grid/draw3d.ts` is eventually ported, it should import this
`LinePolygon` class directly.

**`polygon/cube.js` (`CubePolygon(x, y, z, w, h, d)`)** — builds 8 homogeneous vertices (axis-aligned
box `(x,y,z)` to `(x+w,y+h,z+d)`) in the original's exact construction order, a new `this.faces`
field (6 quad index-quadruples, also exact source order), and an empty `vectors` array. **Cross-check
against jui-chart-vue, direct exact match**: `usePolygon3d.ts`'s `cubeVertices()`/`CUBE_FACES` were
added SPECIFICALLY as a port of this file, confirmed from jui-chart-vue's own `PORT_STATUS.md`
(`column3d.js`/`line3d.js` entry: "`usePolygon3d.ts` needed exactly one addition: `cubeVertices()` +
`CUBE_FACES` (ported from `chart.polygon.cube`...)"). This port's `cube.spec.ts` reuses
`usePolygon3d.spec.ts`'s own hand-traced `cubeVertices`/`CUBE_FACES` test values directly
(`cubeVertices(1,2,3,10,20,30)` → the 8-vertex sequence starting `[1,2,3],[11,2,3],...`; face
`[0,1,5,4]` is the cube's z-constant front face), adjusted only for the `Float32Array` vertex shape.

**Quirks/bugs preserved** (none new beyond what `core.ts` already documents — all three subclasses
are pure-construction wrappers with no additional logic of their own): `vertices!`/`vectors?` remain
subclass-populated-before-use per `PolygonCore`'s own contract (all three populate both in their
constructors, matching the original exactly); `d`/`d1`/`d2` parameter names (not `z`/`z1`/`z2`)
preserved 1:1 in `point.ts`/`line.ts` for signature fidelity.

**Verification**: 18 hand-traced/Node-cross-checked tests total — `point.spec.ts` (6): `extends
PolygonCore`, single-vertex construction shape, empty `vectors`, inherited `perspective` default,
`rotate()` populating `vectors[0]` via the inherited pipeline (reusing `core.spec.ts`'s identity-
rotation oracle), `min()`/`max()` on a single vertex; `line.spec.ts` (5): `extends PolygonCore`,
two-vertex construction shape, empty `vectors`, `rotate()` on both endpoints (reusing `core.spec.ts`'s
combined multi-vertex oracle), `min()`/`max()` spanning both endpoints; `cube.spec.ts` (7): `extends
PolygonCore`, 8-vertex construction order + `w===1` check, 6-face order, front-face z-constant check
(both reused from `usePolygon3d.spec.ts`), empty `vectors`, `min()`/`max()` across all 8 vertices,
`rotate()` sanity (no throw, all 8 `vectors` populated and finite). `npm run typecheck`, `npm run
test` (796 tests across 48 spec files, up from 778 — this batch's 18, 0 failures), and `npm run
build:lib` all pass clean. `src/index.ts` updated with `export { PointPolygon }`, `export {
LinePolygon }`, `export { CubePolygon }` (direct, not namespaced — no collision risk, same convention
`core.ts`'s export already established).

- [x] `polygon/point.js` → `src/polygon/point.ts` — no direct jui-chart-vue CLASS equivalent, but
      `usePolygon3d.ts`'s `vertex()` helper is a direct functional stand-in for the same single-vertex
      construction (see "Progress log" writeup above); consumed by both `dot3d.js` and `line3d.js` in
      the original engine.
- [x] `polygon/line.js` → `src/polygon/line.ts` — **no jui-chart-vue reference exists** (`line3d.js`
      builds its ribbon quad from 4 separate `PointPolygon` calls, never `LinePolygon` — confirmed
      precisely per this task's own instruction), but IS real, live code in the original engine,
      consumed by `grid/draw3d.js` (out of this task's scope). See "Progress log" writeup above.
- [x] `polygon/cube.js` → `src/polygon/cube.ts` — cross-check against `usePolygon3d.ts`'s `cubeVertices()`/
      `CUBE_FACES` (added specifically for `column3d.js`'s port) — direct exact match, oracle values
      reused verbatim in `cube.spec.ts`. See "Progress log" writeup above.
- [x] `polygon/grid.js` → `src/polygon/grid.ts` — no existing jui-chart-vue reference (not needed there);
      full independent port. See "Progress log" writeup below — Phase D is now fully complete
      (`core`/`point`/`line`/`cube`/`grid` all ported and checked off).

### Progress log — `polygon/grid.js` (Phase D's last item — Phase D is now complete)

Ported to `src/polygon/grid.ts` as a real `class GridPolygon extends PolygonCore` (per Phase 0 rule
2), with co-located `grid.spec.ts` (11 new tests). Full repo suite: 807 tests across 49 spec files, 0
failures (this batch's 11 alongside all prior Phase A-D work, including the concurrently-landed
`polygon/point.js`/`line.js`/`cube.js` batch above — 796 + 11 = 807). `npm run typecheck`, `npm run
test`, and `npm run build:lib` all pass clean against the full combined tree.

**`extend` chain, confirmed directly from source, not assumed** (per this task's own explicit
instruction to verify rather than guess): `extend: "chart.polygon.core"` — a single-level `extends
PolygonCore` directly, same as `point.ts`/`line.ts`/`cube.ts`. `grid.js`'s own module body only does
`jui.use(core)` and references no other `polygon/*.js` file.

**`polygon/grid.js` (`GridPolygon(type, width, height, depth, x, y)`)** — builds ONE rectangular quad
face of a 3D grid box, selected by `type` (one of `"center"`/`"horizontal"`/`"vertical"`), plus an
empty `vectors` array. Constructor logic ported 1:1 including the original's own
parameter-reassignment style: `x = x || 0; y = y || 0` (falsy coercion — not just `undefined`; a
caller passing `NaN` also gets coerced to `0`, tested explicitly), then `width`/`height` are
REASSIGNED in place to `x + width`/`y + height` (the quad's far corner), and a `matrix` object keyed
by all three type strings is built from these four numbers plus `depth`, each value a
`Float32Array([X, Y, Z, 1])` homogeneous vertex (`w` always `1`, matching `PolygonVertex`). Hand-
traced all three quads against a literal transcription of the original's vertex lists (see
`grid.ts`'s header comment for the derived geometry: `"center"` is the z=depth face; `"horizontal"`
spans z=0..depth at the far y edge; `"vertical"` spans z=0..depth at the far x edge) — no borrowed
oracle values exist anywhere (first confirmation, per this task's brief, that no jui-chart-vue
reference exists for this file: `usePolygon3d.ts`'s own header comment confirms jui-chart-vue's 3D
charts use a simplified linear/ordinal z-axis, never a real ported grid mesh).

**Preserved quirk, and one deliberately-narrowed-but-documented exception**: like `point.ts`/
`line.ts`, `vertices!`/`vectors?` stay subclass-populated-before-use per `PolygonCore`'s own contract.
Unique to this file: the original's `type` parameter is an unvalidated JS string — passing anything
other than exactly the three recognized keys makes `matrix[type] === undefined`, so `this.vertices`
ends up `undefined` too, crashing the moment `rotate()`/`min()`/`max()` read `this.vertices[0]` (a
`TypeError`, same crash shape `core.ts`'s "populated-by-subclass" contract already documents). This
port encodes the three valid values as a `GridPolygonType` string-literal union rather than a bare
`string`, since the real, sole caller (`grid/draw3d.js`'s `drawAxisLine()`, confirmed by reading it —
see below) never passes anything else — this makes the invalid-string crash unreachable through the
TYPED constructor signature, though still reproducible via an explicit `as any` cast (tested in
`grid.spec.ts`, confirming the exact same `undefined`-vertices/`TypeError` behavior as the original
when bypassed). Documented as a deliberate narrowing, not a silent behavior change.

**How this relates to `grid/draw3d.js`'s eventual needs (read in full, not ported this iteration, per
this task's own instructions)**: `drawAxisLine()` is `GridPolygon`'s ONLY real caller in the whole
engine. It constructs `new GridPolygon(type, w, h, d, x, y)` with `w`/`h`/`x`/`y` from
`this.axis.area(...)` and `d` from `this.axis.depth`, immediately passes the instance into
`this.calculate3d(p)` (`base/draw.ts`, already ported Phase B — sets `p.perspective` then calls
`p.rotate(Math.max(w,h,d), r, x+w/2, y+h/2, d/2)`, the exact same inherited-from-`PolygonCore` call
every other polygon primitive uses), then reads `p.vectors[i].x`/`p.vectors[i].y` in a loop over
`p.vectors.length` to build an SVG polygon face point-by-point. This means `GridPolygon`'s only real
contract beyond what `PolygonCore` itself provides is: (1) `vertices` ends up a length-4
`PolygonVertex[]` so `rotate()` has something to rotate, and (2) `vectors` is initialized to `[]`
(not left `undefined`) BEFORE `rotate()` runs, so `PolygonCore.rotate()`'s own `Array.isArray` guard
populates it with real `Vector` instances. Both are satisfied and directly verified in this port's
integration test (below) — this port's public surface is confirmed ready to satisfy `draw3d.ts`
once that file is ported. `grid/draw3d.js` also constructs `LinePolygon`/`PointPolygon` (already
ported) the same way; `draw3d.ts` itself remains untouched, per this task's instructions.

**Verification**: `grid.spec.ts`, 11 hand-traced/Node-cross-checked tests — `extends PolygonCore`;
all three quad types' exact vertex coordinates (`"center"`/`"horizontal"`/`"vertical"`, non-zero
`x`/`y` case); `x`/`y` omitted defaulting to `0`; the falsy-coercion quirk (`NaN` → `0`, distinct from
a genuinely-negative, truthy `x`/`y` which is NOT coerced); `vectors` initialized to `[]`; the
unvalidated-type-string quirk reproduced via `as any` (`vertices` `undefined`, `min()` throws
`TypeError`); `min()`/`max()` (inherited, unrotated) across all three quad types; and a full
integration test calling the inherited `rotate()` with `perspective = 1` (forcing `scaleValue`'s
per-vertex scale factor to exactly `1`, isolating pure identity rotation, mirroring
`core.spec.ts`'s own already-verified identity-rotation oracle) and `degree = {x:0,y:0,z:0}` at the
origin, confirming `vectors` ends up populated with real `Vector` instances matching the raw vertices
exactly — the same wiring `grid/draw3d.ts`'s future `calculate3d(p)` + `p.vectors[i].x/.y` usage will
depend on. `npm run typecheck`, `npm run test` (807 tests across 49 spec files, up from 796, 0
failures), and `npm run build:lib` all pass clean. `src/index.ts` updated with `export { GridPolygon
}` + `export type { GridPolygonType }` (direct, not namespaced — same convention `core.ts`/`point.ts`/
`line.ts`/`cube.ts` already established, no collision risk).

**Phase D status: now fully complete.** All five `polygon/*.js` files are ported and checked off
(`core`/`point`/`line`/`cube`/`grid`, grep-verified against this section's own checklist above).
`grid/draw3d.ts` (Phase C's last remaining item, blocked on this exact phase per its own dependency-
map entry) can now proceed — it needs `GridPolygon`/`LinePolygon`/`PointPolygon` (all three now real
TS classes) plus `base/draw.ts`'s already-ported `Draw`/`calculate3d()` (Phase B). Not started here,
per this task's own explicit instructions not to touch `grid/draw3d.ts` itself.

## Phase E — Brush/Widget base classes + map plugin points

Thin `extend`-chain root classes. Low line count each, but they define the contract every concrete
brush/widget subclasses — get these exactly right.

### Progress log — `widget/core.js`

Ported to `src/widget/core.ts` as a real `class CoreWidget extends Draw`, constructor kept 1:1
(the original's own `CoreWidget` constructor function takes ZERO parameters — `chart`/`axis`/
`widget`/`svg`/`canvas` are wired onto the instance externally by `base/builder.ts`'s
`drawWidget()`, not via construction), every method name kept 1:1 (`getIndexArray`/
`getScaleToValue`/`getValueToScale`/`isRender`/`on`/`drawAfter`, plus the static `CoreWidget.setup()`
defaults factory). Co-located `core.spec.ts`, 20 tests, all passing.

**Real extend target, confirmed from source (not assumed)**: `widget/core.js`'s own `extend:`
field literally reads `"chart.draw"`, not `"core"` — `CoreWidget extends Draw`
(`base/draw.ts`), the exact same target `grid/core.ts`'s `CoreGrid` already established for the
sibling `grid.*` family, and NOT `base/core.ts`'s `Core` (the per-instance-event-bus/option-merge
base for top-level UI objects like `Builder`/`Plane`). This is a direct, explicit correction of
this task's own initial framing (which assumed "very likely extends `Core`") — the real source
settles it unambiguously, and the correction matches the precedent `grid/core.ts` already set for
the parallel `grid.*` family one phase earlier.

**Cross-check against jui-chart-vue's `widget/polygon/rotate3d.js`/`useRotate3d.ts` Phase E
writeup** (`jui-chart-vue/PORT_STATUS.md` ~L6077-6081) — this project's richest pre-source
evidence for this exact class:
  - **Confirmed correct, verbatim**: "`chart.widget.polygon.rotate3d` extends
    `chart.widget.polygon.core` ... extends `chart.widget.core` (`getIndexArray`/
    `getScaleToValue`/`getValueToScale`/`on()`/default `drawAfter()`) extends `chart.draw`." Every
    method name listed matches this file's real, complete surface exactly — nothing invented,
    nothing missing from what it listed.
  - **One addition, not a correction**: that writeup omitted `isRender()` — reasonable, since
    `rotate3d.js` itself never calls it directly — but it IS a real, load-bearing part of the
    surface: called both by `base/builder.ts`'s `drawWidget()` (gates the "render once unless
    `widget.render: true`" lazy-draw lifecycle: `if (this._initialize && draw.isRender &&
    !draw.isRender() && isAll !== true) { return; }`) and by `CoreWidget.on()` itself (picks the
    dynamic reset-type argument — see below). Documented as the sixth surface member in this
    port's own header comment.
  - **No other Phase D widget writeup** (`zoom.js`/`dragselect.js`/`selectbox.js`/`focus.js`/
    `guideline/cross.js`/`tooltip.js`/`legend.js`, all checked) inferred anything further about
    this base class beyond confirming the same `extend: "chart.widget.core"` chain string — none
    had this file's real source to read (jui-chart-vue's Phase D was a from-scratch
    Vue-idiomatic reimplementation, not a vendored port), so there was nothing else to cross-check.

**`on(type, callback, axisIndex)`'s exact semantics — genuinely different from `Draw.on()`
(the grid family's version), determined precisely from source, not assumed from the name match**:
  1. Takes an explicit THIRD ARGUMENT, `axisIndex` — NOT derived from `self.axis.index` the way
     `Draw.on()` does. A widget is wired to only `this._axis[0]` by `drawWidget()`, but a single
     widget instance may still listen for `"axis.*"` events scoped to a *different* axis than the
     one it's attached to (a widget's own `widget.axis` config array drives which index a caller
     passes per-call — confirmed real via `rotate3d.js`'s own per-configured-axis wiring).
  2. The reset-type argument passed to `this.chart.on(...)` is **dynamic**, not always `"render"`
     the way `Draw.on()`'s is: `this.isRender() ? "render" : "renderAll"` — a widget configured
     with `render: true` resets its handler on `"render"`; the default `render: false` (drawn
     once, lazily) resets on `"renderAll"` instead.
  3. The per-axis dispatch guard compares `args[1]` against the explicit `axisIndex` parameter
     (mirroring point 1), not `self.axis.index`. The original uses loose `==` here
     (`arguments[1] == axisIndex`) — preserved as `===` with no behavior difference (same
     precedent `base/draw.ts`'s own analogous comparison already established): `axisIndex` is
     guarded by `typeCheck("integer", axisIndex)` immediately above, so both operands are always
     numbers by the time the comparison runs, and `==`/`===` are identical for two same-typed
     number operands.

**`drawAfter(obj)`**: `obj.attr({ "class": "widget-" + this.widget.type })` — stamps a
`widget-<type>` CSS class onto the drawn element. Declared as an arrow-function class field, not
method syntax, matching `Draw`'s own `drawAfter?: (obj: any) => void` optional property
declaration — same TS2425 override-kind-matching necessity `grid/core.ts`'s `CoreGrid.drawAfter`
already required, and matching the original's own per-instance closure-assignment shape too.

**`getScaleToValue`/`getValueToScale`**: a real (near-)inverse pair, hand-verified algebraically —
pure functions of their own arguments, never touching `this`. `getScaleToValue` clamps its result
to `[minValue, maxValue]`; `getValueToScale` rounds via `.toFixed(1)` but is **NOT** clamped to
`[minScale, maxScale]` — a genuine asymmetry in the original design, preserved (not "fixed"),
tested (`getValueToScale(200, 0, 100, 0, 10)` produces `-10`, well outside `[0,10]`).

**`getIndexArray(index)`**: array passes through unchanged; a single integer becomes a 1-element
array; anything else (including the common `undefined` "not configured" case) defaults to `[0]`
— "operate on axis 0 unless told otherwise". No quirks found — straightforward `typeCheck`
branching, ported verbatim.

**`isRender()`**: `return (this.widget.render === true) ? true : false` — a real, if redundant,
ternary-wrapped boolean coercion, preserved verbatim rather than simplified to a bare comparison
(behaviorally identical either way, kept for literal fidelity).

**No other quirks/bugs found** — this file is small and its logic is straightforward compared to
`base/axis.ts`/`grid/core.ts`'s much larger surfaces; every method's behavior matched a
first-principles read with no surprises once the `Draw`-not-`Core` extend target was settled.

**Verification**: `core.spec.ts`, 20 hand-traced tests covering `getIndexArray` (all 4 branches),
`getScaleToValue`/`getValueToScale` (hand-computed values, the clamp/no-clamp asymmetry, the
`toFixed(1)` rounding case), `isRender` (`=== true` strictness, not loose truthy), `on` (dynamic
`"render"`/`"renderAll"` resetType selection, non-axis-event full-arg forwarding with `this`
bound to the widget, axis-scoped dispatch matching/non-matching `axisIndex`, axis-scoped dispatch
when `chart.axis()` resolves to `undefined`, and the axis-prefixed-but-no-integer-axisIndex
fallthrough to the non-axis branch), `drawAfter` (via a real `SVG.rect()`-produced `TransElement`,
same convention `grid/core.spec.ts`'s `line()` test used), the inherited `Draw.render()` abstract
throw (`CoreWidget` never assigns `this.draw`, exactly like `CoreGrid`), and `static setup()`'s
exact default shape. `npm run typecheck` (clean), `npm run test` (**861 tests across 51 spec
files, 0 failures** — this batch's 20 plus all 841 from Phases A–D), and `npm run build:lib`
(clean, 53 modules bundled, up from 52) all pass against the full combined tree. `src/index.ts`
updated with `export { CoreWidget }` + `export type { WidgetConfig }`.

### Progress log — `brush/core.js`

Ported to `src/brush/core.ts` as a real `class CoreBrush extends Draw` (per Phase 0 rule 2),
constructor kept 1:1 (zero parameters — see below for the externally-wired `chart`/`axis`/`brush`/
`svg`/`canvas` shape). Every public method name kept 1:1: `drawAfter`/`drawTooltip`/`curvePoints`/
`eachData`/`listData`/`getData`/`getValue`/`getXY`/`getStackXY`/`addEvent`/`color`/`offset`, plus
the static `setup()` defaults factory. Co-located `core.spec.ts`, 33 hand-traced/Node-cross-checked
tests, all passing.

**Extend chain — corrects the task brief's own working assumption**: `brush/core.js`'s own
`extend:` field literally reads `"chart.draw"` (line 9 of the original), **not** `"core"` — so
`CoreBrush extends Draw` (`base/draw.ts`, already ported), **not** `Core` (`base/core.ts`). This is
the exact same `Draw`-family precedent `grid/core.ts`'s `CoreGrid` and `widget/core.ts`'s
`CoreWidget` already established for their own sibling families (`Core` is the per-instance-
event-bus/option-merge base for top-level UI objects — `Builder`/`Plane` — never reached by any
`chart.brush.*`/`chart.widget.*`/`chart.grid.*` class in the real engine). Confirmed from source,
not assumed, before writing any code.

**How a brush gets `chart`/`axis`/`svg` wired up**: exactly the same externally-wired-after-
construction shape `CoreGrid`/`CoreWidget` already established, confirmed by reading
`base/builder.ts`'s already-ported `drawBrush()` (line ~341): `const draw = new Obj(this, axis,
draws[i]); draw.chart = this; draw.axis = axis; draw.brush = draws[i]; draw.svg = this.svg;
draw.canvas = this._canvas.buffer;` — all AFTER construction; the constructor arguments themselves
are never read by `CoreBrush`. `builder.ts`'s own `registerBrush(type, ctor)` / `DrawConstructor`
(`new (chart, axis, options) => DrawLike`) already anticipated this exact wiring before this file
existed — a concrete `chart.brush.*` leaf class satisfies `DrawConstructor` by extending
`CoreBrush` with a 0-arg constructor, the same "implementation may ignore trailing parameters" TS
rule `GridConstructor`/`CoreGrid` already relies on. `chart`/`axis`/`brush` are overridden from
`Draw`'s own narrower `chart!: DrawChartLike`/`axis!: DrawAxisLike`/`brush: any` fields via
`declare chart: BrushChart; declare axis: Axis; declare brush: BrushOptions;` — the same
`declare`-override convention `CoreGrid`/`CoreWidget` established, needed here because `CoreBrush`'s
own methods read considerably more off `axis` (`.data`/`.getValue()`/`.x`/`.y`/`.get("clipId")`)
and `chart` (`.area()`/`.svg`/`.color()`/`.theme()`/`.text()`/`.padding()`/`.emit()`/`.root`) than
`Draw`'s own methods do.

**Cross-check against jui-chart-vue's accumulated `chart.brush.core` inferences** (this task's own
central job) — read the real 559-line source in full first, then checked every brush-file writeup
across jui-chart-vue's whole Phase A–E that cites `chart.brush.core`:
  - **Confirmed, method-for-method**: `eachData(callback, reverse)`, `getValue(data, fieldString,
    defaultValue)`, `addEvent(elem, dataIndex, targetIndex)` — the `{brush, dataIndex, dataKey,
    data}` payload shape jui-chart-vue's own `ChartElementEventPayload` was independently reverse-
    engineered to match (`PORT_STATUS.md` ~L273/~L309-332 there) is byte-exact against the real
    source, including the `typeCheck("object", dataIndex) && !targetIndex` special-case branch.
    `color(key1, key2)`, `offset(type, index)`, and `curvePoints(K)` — jui-chart-vue's `useSeries.ts`
    already says "Ported from `chart.brush.core`'s `curvePoints()`" and its own Phase F
    re-verification note (`PORT_STATUS.md` ~L6240-6241 there) already confirmed the Thomas-algorithm
    variable names/comments match this exact file; its hand-solved oracle (`curvePoints([0,10,20,30])`
    → `p1=[10/3,40/3,70/3]`, `p2=[20/3,50/3,80/3]`) was reused directly in `core.spec.ts`.
  - **Corrected**: the task brief's own working assumption ("cache methods like `getCache`/
    `setCache`") is wrong for this class — those belong to `base/builder.ts`'s `Builder`
    (`chart.getCache`/`chart.setCache`, already ported there, lines ~1100–1107); `activebubble.js`'s
    own Phase E writeup (`PORT_STATUS.md` ~L5252 there) had already correctly attributed them to
    `chart`, not to `chart.brush.core` — re-confirmed here by reading the real source in full: zero
    cache methods anywhere in `brush/core.js`. Likewise `getIndexArray()` belongs to
    `widget/core.ts`'s `CoreWidget` (a different Phase E base for the sibling `chart.widget.*`
    family), not this one — the task brief's own phrasing conflated the two; no jui-chart-vue brush
    writeup actually claimed otherwise, so this is a scope-boundary clarification, not a correction
    to any existing writeup.
  - **A genuine, if minor, prior inference gap found and corrected**: `bubble.js`'s Phase B writeup
    (`PORT_STATUS.md` ~L1160-1170 there) claims `target`/`colors`/`display`/`active` are ALL
    "inherited `chart.brush.core` defaults" — only `target`/`colors` actually are.
    `CoreBrush.setup()`'s real, complete return value is exactly `{target, colors, axis, index,
    clip, useEvent}` — no `display`, no `active`; those two must be per-leaf-brush own `setup()`
    config in the original. Documented for the record; no jui-chart-vue file needed editing (out of
    this task's scope).

**New finding, not previously inferrable without the real source** (required tracing `getXY()`'s
coordinate math and `builder.ts`'s option-merge helper directly, not just reading brush-file call
sites): `base/builder.ts`'s already-landed `defineOptions(ctor, options)` helper (line ~158) is a
SIMPLIFIED one-level version (`ctor.setup()` only) of the real original engine's `jui.defineOptions`
(`base/base.js` ~L1168: `getOptions(Module, {})`, which walks the WHOLE `extend` chain leaf-first —
confirmed by reading that function directly). In the real original, a concrete brush's per-instance
options are merged from its OWN `setup()`, then `CoreBrush.setup()`, then `Draw.setup()` — the full
3-level chain, exactly like `Core.mergeOptions()` already does for `Builder`/`Plane`. `builder.ts`'s
current `defineOptions()` only applies the leaf ctor's own `setup()`, so once a real `chart.brush.*`
leaf lands and gets `registerBrush()`'d, its instances will NOT automatically receive
`CoreBrush.setup()`'s `clip: true`/`useEvent: true`/etc. defaults through `builder.ts`'s current
wiring, unlike the real original. A pre-existing gap in `builder.ts`, not introduced by this task
and outside this task's own file-touch scope — flagged here as a follow-up for whoever ports the
first real `chart.brush.*` leaf.

**Quirks/bugs found and preserved** (Node/hand-verified, not "fixed" per Phase 0 rule 6):
  - **`eachData(callback, reverse)`'s swapped-argument-order quirk**: the non-reverse branch (the
    default, and the only form `getStackXY()` itself ever uses) calls `callback.call(this,
    list[index], index)` — `(data, index)`. The `reverse === true` branch calls `callback.call(this,
    len, list[len])` — `(index, data)`, SWAPPED. A caller reusing the same callback shape for both
    forms silently receives data where it expects an index and vice versa. Preserved exactly;
    tested (`core.spec.ts`'s two `eachData` order tests).
  - **`getMinMaxValue()`'s always-true, wrong-variable guard**: its first pass checks
    `!seriesList[target[i]]` (always `true` — `seriesList` is empty at that point, only populated in
    a later pass) before initializing `targetList[target[i]] = []` — checking the WRONG object, not
    a real duplicate-key guard. Verified harmless in effect (re-initializing the same empty array
    more than once for a repeated `target` key is a no-op), so not independently unit-tested beyond
    `getXY()`'s own min/max assertions (which exercise the function's real output regardless).
  - **`_.loop()` (`util/base.js`'s "최적화된 루프") is real, load-bearing product logic** `getXY()`
    reuses directly — inlined here (per Phase 0 rule 4's "verify before dropping" instruction, same
    treatment `base/axis.ts` gave `extend`/`deepClone`/`typeCheck`) rather than replaced with a
    plain sequential loop. It splits `[0,total)` into 5 interleaved buckets and visits them
    round-robin, not sequentially — Node-cross-checked against a literal transcription of
    `base/base.js`'s real `loop()`, and against `core.spec.ts`'s own hand-simulated `total=7` case
    (visitation order `[0,2,4,6,1,3,5]`, not `[0,1,2,3,4,5,6]` — asserted directly). Doesn't change
    `getXY()`'s final RESULT (every write targets an absolute index, so order-independent), but is
    preserved anyway since a future canvas/3d brush subclass could plausibly observe the
    interleaved CALL order itself via a side-effecting callback.
  - **`isRangeY` role-swap in `getXY()`/`getStackXY()`**: when `axis.y.type == "range"`, `x` is
    resolved from the plain ROW INDEX once per row (a block/ordinal axis) while `y` is recomputed
    per target from each row's VALUE; the opposite when `y` is not a range axis (`y(i)` once per
    row, `x(value)` per target). Genuine, intentional design (not a bug) — both branches ported and
    tested (`getXY`'s two hand-traced tests cover both roles explicitly, including the "same
    coordinate on the non-recomputed axis is shared across all targets for a given row" detail).
  - **`getStackXY()` leaves `value`/`min`/`max` untouched** — only the recomputed axis (`x` or `y`,
    per `isRangeY`) gets overwritten with the cumulative stacked sum; `xy[j].value[i]` stays the RAW
    field value, never the stacked sum. Tested explicitly (a real, non-obvious detail for anyone
    reading a stacked chart's tooltip/label data later).
  - **`curvePoints()`'s un-`var`'d first-loop variable**: the original's first internal-segment
    `for` loop reuses its loop variable (`i`) without its own `var` declaration — harmless only
    because a LATER loop in the same function DOES declare `var i`, and `var` hoists to function
    scope. Reproduced with a single `let i` declared once up front (functionally identical to the
    hoisted-`var` reuse, not a behavior change) rather than three independently-scoped `let`s.
  - **`drawTooltip()`'s `text.element.textContent = value`**: assigning a non-string (e.g. a raw
    number) to `.textContent` stringifies it at the real DOM level — ported as `String(value)`, a
    TS-necessary widening with an IDENTICAL runtime result (same category as other already-
    documented "widen for the type system, no behavior change" cases in this port).
  - **`drawTooltip()`'s `.get(0)!`/`.get(1)!` non-null assertions**: the original never guards these
    either — always safe in practice since `draw()` always creates exactly `[text, circle]` as the
    tooltip group's only two children, in that order, before `control()`/`style()` can ever run.

**`util.dom`'s `$.offset()` dependency**: `addEvent()`'s `setMouseEvent()` genuinely needs
`util/dom.ts`'s already-ported `offset()` (Phase A) — imported directly (`offset as domOffset`),
not re-inlined, since a real shared module already exists for it (unlike the various per-file
`typeCheck`/`extend` copies this port's convention keeps duplicated elsewhere).

**`drawTooltip()`'s SVG-nesting correctness, verified not assumed**: the original calls
`self.chart.text({...})`/`self.chart.svg.circle({...})` (mixing `chart.text()` and `chart.svg.X()`
calls) inside a `self.chart.svg.group({...}, callback)` callback, never using the callback's own
`this`-bound group reference to attach children explicitly. Traced through `Builder.text()`
(delegates to `this.svg.text(...)`, the SAME `SVG` instance as `chart.svg`) and `SVG`'s own
`create()` override (`src/util/svg.ts` ~L133): nesting is tracked via `depth`/`parentStack`
INSTANCE STATE on the `SVG` object itself, not via the callback's `this` binding — so calling
`chart.text(...)`/`chart.svg.circle(...)` from inside an open `chart.svg.group(...)` callback
correctly nests into that group regardless of which method triggered the call. Confirmed via a real
`SVG` instance in `core.spec.ts`'s `drawTooltip` tests (not a stub), not assumed from reading the
source alone.

**Verification**: `core.spec.ts`, 33 hand-traced/Node-cross-checked tests covering `listData`/
`getData`/`getValue` (including the two falsy-axis/falsy-data guard branches), `eachData` (both
argument orders, the non-function-callback no-op guard, `this`-binding), `curvePoints` (the reused
jui-chart-vue oracle), `getXY` (both `isRangeY` roles, `isCheckMinMax=false`, the hand-simulated
`_.loop()` interleaved-order case), `getStackXY` (cumulative-sum hand-trace, `value` staying raw),
`addEvent` (useEvent gate, both the object-form and index-form payload branches, `setMouseEvent()`'s
`bgX`/`bgY`/`chartX`/`chartY` stamping cross-checked against the real `util/dom.ts` `offset()`, the
`rclick`/`preventDefault` contextmenu mapping, all 8 registered event types), `color` (1-arg vs.
2-arg `key1`/`key2` resolution, all three function-`colors` branches plus the non-function
fallback), `offset` (block vs. non-block `rangeBand` addition), `drawAfter` (clip on/off, CSS class,
translate-to-chart-area), and `drawTooltip` (construction via a real `SVG` instance, `control()`'s
show/hide + 4-orient text positioning, `style()`'s re-theming). `npm run typecheck` (clean),
`npm run test` (**894 tests across 52 spec files, 0 failures** — this batch's 33 plus all 861 from
Phases A–D plus `widget/core.ts`), and `npm run build:lib` (clean, 54 modules bundled, up from 53)
all pass against the full combined tree. `src/index.ts` updated with `export { CoreBrush }` +
`export type { BrushChart, BrushOptions, BrushAxisScale, BrushData, BrushEventPayload,
BrushMouseEvent, BrushSeriesXY, BrushTooltip }`.

### Progress log — `widget/canvas/core.js`, `widget/polygon/core.js`, `widget/map/core.js`

Ported to `src/widget/canvas/core.ts` (`CanvasCoreWidget`), `src/widget/polygon/core.ts`
(`PolygonCoreWidget`), `src/widget/map/core.ts` (`MapCoreWidget`), all as real
`class ... extends CoreWidget` (per Phase 0 rule 2). Co-located spec files: `canvas/core.spec.ts`
(8 tests), `polygon/core.spec.ts` (8 tests), `map/core.spec.ts` (10 tests) — 26 new
hand-traced/Node-cross-checked tests. Full repo suite: **912 tests across 55 spec files, 0
failures** (this batch's 26 plus all 886 from Phases A–D plus `widget/core.ts`/`brush/core.ts`).

**Extend chain, all three confirmed from source (not assumed)**: all three files' own `extend:`
field literally reads `"chart.widget.core"` — `CanvasCoreWidget`/`PolygonCoreWidget`/
`MapCoreWidget` all extend `widget/core.ts`'s `CoreWidget` directly (not `Draw` directly, and not
each other) — the exact one-level-deeper link in the chain `widget/core.ts`'s own header comment
already anticipated ("real subclasses (`widget/canvas/core.js`/`widget/polygon/core.js`/
`widget/map/core.js` ...) get `chart`/`axis`/`widget`/`svg`/`canvas` wired onto them externally").

**`widget/canvas/core.ts` — what it actually adds over `CoreWidget`, precisely (this task's own
central question, since no jui-chart-vue reference exists for this specific file)**: reading the
real source settles it — **nothing except erasing `CoreWidget.drawAfter`'s CSS-class-stamping
behavior.** No canvas-context access, no hit-testing, no new methods or fields — the task brief's
own "likely canvas-specific hit-testing or context access" guess is **not** borne out by the real
source. `CanvasCoreWidget`'s whole body is a zero-param constructor (inherited) plus a completely
EMPTY `drawAfter(obj) {}` override, shadowing `CoreWidget.drawAfter`'s `obj.attr({class:
"widget-"+this.widget.type})` stamp entirely. Confirmed via `grep -rn "widget.canvas.core"` across
the whole `/home/search5/cl/jui-graph/src` tree: only `main.js`'s registration import references
it — **zero concrete subclasses anywhere public** (same category as the map stub below; real
canvas-rendered content in this engine lives almost entirely under the separate `chart.brush.*`
family's `brush/canvas/core.js`, still Phase E's own pending item, not this one).

**`widget/polygon/core.ts` — cross-check against jui-chart-vue's `rotate3d.js`/`useRotate3d.ts`
Phase E writeup, this task's own specific assignment**: that writeup already described
`chart.widget.polygon.core` as "a two-line pass-through — empty `drawAfter()` override, nothing
else". **CONFIRMED CORRECT, verbatim, against the real source — not a correction.**
`widget/polygon/core.js` is byte-identical in shape to `widget/canvas/core.js` (confirmed via
`diff` against the real source: only the two names differ, `PolygonCoreWidget`/
`chart.widget.polygon.core` vs. `CanvasCoreWidget`/`chart.widget.canvas.core`) — a zero-param
constructor plus one completely empty `drawAfter(obj) {}` override, nothing more. jui-chart-vue's
description could not be more precise; nothing to add.

**`widget/map/core.ts` — verified still an empty extension-point stub with zero concrete
subclasses anywhere public, per jui-chart-vue's PORT_STATUS.md documentation, same category as
`brush/map/core.js`**: **CONFIRMED**, with one precision this task's own assignment specifically
asked for — `MapCoreWidget` is genuinely DIFFERENT in shape from its canvas/polygon siblings, not
just a third copy of the same two-line pass-through. Its constructor declares three parameters
(`chart, axis, widget` — matching neither `CoreWidget`'s own zero-param constructor nor the
canvas/polygon siblings' implicit zero-param one) but the body is completely empty — none of the
three are ever read or assigned, since real wiring still happens externally via
`base/builder.ts`'s `drawWidget()` regardless, exactly like every other Phase E base class. Kept
1:1 per Phase 0 rule 2 rather than dropped, each parameter explicitly marked unused in the port.
More importantly: **`MapCoreWidget` does NOT override `drawAfter` at all** — unlike
`CanvasCoreWidget`/`PolygonCoreWidget`, it inherits `CoreWidget.drawAfter`'s REAL CSS-class-
stamping behavior unmodified. The one real addition is a `static setup()` override returning
`{axis: 0}`, REPLACING (not merging with) `CoreWidget.setup()`'s own `{render:false, index:0}`
defaults — consistent with this engine's already-documented no-automatic-setup-chain-merge
behavior (`brush/core.ts`'s "New finding" section). Confirmed via `grep -rn "widget.map.core"`
across the whole source tree: only `main.js`'s registration import references it — zero concrete
`chart.widget.map.*` leaf class exists anywhere in the real engine, matching `brush/map/core.js`'s
documented category exactly.

**Quirks/bugs preserved**: the empty `drawAfter(obj) {}` overrides on `CanvasCoreWidget`/
`PolygonCoreWidget` (silently dropping the `widget-<type>` CSS class stamp for any hypothetical
subclass) and `MapCoreWidget`'s vestigial 3-parameter, zero-effect constructor are all preserved
byte-faithfully, not "fixed" — each documented in its own file's header comment and directly
tested (`canvas/core.spec.ts`/`polygon/core.spec.ts` both assert `rect.attr("class")` stays falsy
after `drawAfter()`; `map/core.spec.ts` asserts the opposite — `class` IS stamped — plus that
`this.chart`/`this.axis`/`this.widget` all stay `undefined` after a 3-argument construction).

**Verification**: `npm run typecheck` (clean for all three new files — the tree's only
`tsc` error, `src/brush/canvas/core.ts(165,6): error TS2352`, is confirmed pre-existing/unrelated:
it belongs to the concurrently in-progress `brush/canvas/core.js`/`brush/polygon/core.js`/
`brush/map/core.js` batch (see below — not yet landed as of this writeup: `src/brush/polygon/`
and `src/brush/map/` are still empty directories, `src/brush/canvas/core.ts` has no spec file yet),
not this task, and not reachable from `src/index.ts`'s own import graph either, same precedent
Phase B's `axis.ts` writeup already established for an analogous concurrent-work typecheck
failure), `npm run test` (**912 tests across 55 spec files, 0 failures**), and `npm run build:lib`
(clean, 57 modules bundled, up from 54 — `build:lib` only type-checks `src/index.ts`'s own
transitive import graph via `tsconfig.lib.json`, which doesn't yet include the unfinished
`brush/canvas/core.ts`) all pass against the full combined tree. `src/index.ts` updated with
`export { CanvasCoreWidget }` / `export { PolygonCoreWidget }` / `export { MapCoreWidget }`.

### Progress log — `brush/canvas/core.js`, `brush/polygon/core.js`, `brush/map/core.js`

Ported to `src/brush/canvas/core.ts` (`CanvasCoreBrush`), `src/brush/polygon/core.ts`
(`PolygonCoreBrush`), `src/brush/map/core.ts` (`MapCoreBrush`), all as real
`class ... extends CoreBrush` (per Phase 0 rule 2). Co-located spec files: `canvas/core.spec.ts`
(11 tests), `polygon/core.spec.ts` (7 tests), `map/core.spec.ts` (4 tests) — 22 new
hand-traced/Node-cross-checked tests. Full repo suite: **934 tests across 58 spec files, 0
failures** (this batch's 22 plus all 912 from Phases A–D plus `widget/core.ts`/`brush/core.ts`/
the concurrently-landed `widget/canvas/core.ts`/`widget/polygon/core.ts`/`widget/map/core.ts`
batch). **This completes Phase E** — see the checklist below, every item now checked, both the
brush-side (this batch) and widget-side (concurrent batch, already landed and exported) halves
confirmed done.

**Extend chain, all three confirmed from source (not assumed)**: all three files' own `extend:`
field literally reads `"chart.brush.core"` — `CanvasCoreBrush`/`PolygonCoreBrush`/`MapCoreBrush`
all extend `brush/core.ts`'s `CoreBrush` directly (not `Draw` directly, and not each other),
mirroring the exact one-level-deeper link the sibling `widget/canvas/core.js`/`widget/polygon/
core.js`/`widget/map/core.js` batch already established for the `chart.widget.*` family.
Constructors kept 1:1 (zero parameters each, `chart`/`axis`/`brush`/`svg`/`canvas` wired onto the
instance externally by `base/builder.ts`'s `drawBrush()`, same externally-wired-after-construction
shape every other Phase E base class in this engine uses).

**`brush/canvas/core.ts` — cross-check against jui-chart-vue's `ChartCanvasBase.vue`/
`useCanvasChart.ts` (this task's own central verification job, read against the real 45-line
source in full)**: **DECISIVELY CORRECTED — jui-chart-vue's entire canvas infrastructure is its
own independent invention, unconnected to anything in this real source.** The real
`chart.brush.canvas.core` is 45 lines total and contains ZERO canvas-context handling, ZERO DPI/
`devicePixelRatio` logic, and ZERO `requestAnimationFrame`/animation-loop scheduling of any kind —
confirming jui-chart-vue's own indirect finding (`PORT_STATUS.md` ~L4948-4955 there: "`util.
canvas.base` provides NONE of: devicePixelRatio/retina handling..., requestAnimationFrame/
animation-loop scheduling... confirmed absent by grepping the ENTIRE jui-chart + juijs-graph
tree") directly, by reading the one remaining plausible candidate file (`chart.brush.canvas.core`
itself, the "core" file most likely to hold shared canvas plumbing) and finding it equally empty
of that logic. `useCanvasChart.ts`'s DPI-scaled backing-store sizing and `useAnimationFrameLoop`'s
RAF delta-clamping are entirely jui-chart-vue's own from-scratch solution to a real gap the
upstream engine simply never centralizes — no correction needed to jui-chart-vue's own design,
just confirmation that it isn't "secretly" a port of anything. **What this file actually adds
over `CoreBrush`, precisely**: exactly two methods, `addPolygon(polygon, callback)` (queues a 3D
polygon after `this.calculate3d(polygon)`, stamping `order = axis.depth - polygon.max().z`) and
`drawAfter()` (sorts the queue ascending by `.order` and drains it via `handler.call(this,
polygon)`) — a back-to-front z-sort purely for hand-rolled 3D canvas brushes, confirmed dead in
every canvas brush jui-chart-vue itself ported (`activebubble.js`/`bubblecloud.js`/
`activecircle.js`/`equalizercolumn.js`, each grepped `addPolygon`/`drawAfter`-free per their own
writeups) and alive only in `dot3d.js` (jui-chart-vue's own writeup at ~L5600: "the FIRST canvas
brush in this phase that actually EXERCISES `chart.brush.canvas.core`'s `addPolygon()`/
`drawAfter()`"). **A real, previously-undocumented finding this cross-check surfaces**:
`CanvasCoreBrush.drawAfter()` COMPLETELY SHADOWS `CoreBrush.drawAfter()`'s clip-path/CSS-class/
origin-translate wiring — it does not call or compose with it, exactly reproducing the original's
own constructor-assignment-order semantics (`CoreBrush`'s ctor sets `this.drawAfter = ...clip/
translate...` first; `CanvasCoreBrush`'s own ctor then reassigns `this.drawAfter = ...polygon
sort/drain...` second, clobbering it). Ported as a real ES class field on `CanvasCoreBrush` that
redeclares `drawAfter` without calling `super.drawAfter` — a subclass field initializer running
strictly after `super()` reproduces the identical shadow-not-compose behavior byte-faithfully.
Practical consequence, preserved not fixed: any real `chart.brush.canvas.core`-derived leaf brush
gets NO automatic clip-path/CSS-class/translate from the base wiring at all.

**`brush/polygon/core.ts` — cross-check against jui-chart-vue's `column3d.js`/`line3d.js` writeup
(`PORT_STATUS.md` ~L5869-5919 there), which already documented `createPolygon()` calling `chart.
draw.calculate3d()` and stamping `order = axis.depth - polygon.max().z` WITHOUT ever having this
25-line base-class source file to read directly (jui-chart-vue only had the two concrete
subclasses' own call sites into it)**: **CONFIRMED, precisely, method-for-method — no corrections
needed on any point checked.** `createPolygon(polygon, callback)` is the ONLY method this file
adds (matching jui-chart-vue's own count exactly). Verified line-for-line against the real
source: (1) `this.calculate3d(polygon)` — the SAME inherited `Draw.calculate3d()`
`CanvasCoreBrush.addPolygon()` also calls, confirmed not brush-specific, exactly as jui-chart-vue's
writeup already states. (2) `callback.call(this, polygon)` — invoked with `this` bound to the
`PolygonCoreBrush` instance. (3) the `order` stamp is GATED behind `if(element)` — confirmed by
reading the exact source line, a detail jui-chart-vue's own writeup independently corroborated via
`line3d.js`'s real usage ("`line3d.js`'s `createLine`... whose `createPolygon()` callbacks never
`return` anything, so `order` is instead computed BY HAND after the loop"): when `callback`
returns nothing, `createPolygon()` itself returns `undefined` and stamps NO `order` anywhere.
Preserved exactly, tested for both the truthy-return-stamps-order case and the
returns-nothing/returns-null no-stamp case. **`static setup()`, confirmed present (unlike
`CanvasCoreBrush`, which has none)**: `{id: null, clip: false}` — two real details: `clip: false`
DIVERGES from `CoreBrush.setup()`'s own `clip: true` default (a polygon-drawing SVG brush
defaults to NOT clipping to the axis's clip-path, the opposite of a plain axis-based SVG brush);
`id: null` is a genuinely NEW key, not an override of anything `CoreBrush.setup()` already
returns. Same already-documented `builder.ts` `defineOptions()`-doesn't-walk-the-full-`extend`-
chain gap (`brush/core.ts`'s own header comment) applies here too — not re-litigated per file.

**`brush/map/core.ts` — verified still an empty extension-point stub with zero concrete
subclasses anywhere public, per jui-chart-vue's PORT_STATUS.md documentation, same category as
`widget/map/core.js`**: **CONFIRMED**, re-read from the real source directly rather than trusting
the prior claim — the entire file is 10 lines, `component: function() { var MapCoreBrush =
function() {}; return MapCoreBrush; }`, a constructor with a COMPLETELY EMPTY BODY. Adds ZERO
methods, ZERO fields, ZERO `static setup()` over `CoreBrush`. Grepped this project's own full
clone of `juijs-graph`'s source tree for any file with `extend: "chart.brush.map.core"`: zero
matches — confirmed via `grep -rn "chart.brush.map.core" /home/search5/cl/jui-graph/src/`, only
its own `name:` declaration matches, no consumer anywhere. Ported as `export class MapCoreBrush
extends CoreBrush {}` — literally empty, per Phase 0 rule 2 (real class, not a registry entry).

**Quirks/bugs preserved**: `CanvasCoreBrush.drawAfter()`'s complete shadowing of `CoreBrush.
drawAfter()` (documented above, tested via a spy `attr`/`translate` proving neither is called);
`addPolygon()`'s array-reinitialization guard re-checked on every call (`Array.isArray(...)` —
functionally a lazy init, but a truthy-non-array value gets reset rather than left alone, tested);
`drawAfter()`'s drain loop mutating `this.polygons` down to `[]` as a side effect (tested);
`createPolygon()`'s `if(element)`-gated order stamp (tested for both branches, including a `null`
return). None "fixed" — each preserved byte-faithfully per Phase 0 rule 6.

**Verification**: `npm run typecheck` (clean across the full tree — the pre-existing
`src/brush/canvas/core.ts(165,6): error TS2352` noted as still-open in the concurrent widget-side
batch's own writeup is resolved by this batch, since it's this exact file), `npm run test`
(**934 tests across 58 spec files, 0 failures**), and `npm run build:lib` (clean, 60 modules
bundled, up from 57) all pass against the full combined tree. `src/index.ts` updated with
`export { CanvasCoreBrush }` + `export type { CanvasPolygon, CanvasPolygonEntry }`,
`export { PolygonCoreBrush }` + `export type { PolygonBrushPolygon, PolygonBrushElement,
PolygonBrushOptions }`, and `export { MapCoreBrush }`.

- [x] `brush/core.js` → `src/brush/core.ts` — the root nearly every jui-chart-vue composable's "extend chain"
      writeup cites (`chart.brush.core`). See the "Progress log" writeup above for the full method
      surface, the `Draw`-not-`Core` extend-target correction, the externally-wired `chart`/`axis`/
      `brush`/`svg`/`canvas` shape, the cross-check against jui-chart-vue's accumulated inferences
      (confirmations, corrections, and the `builder.ts` `defineOptions()` new finding), and every
      preserved quirk/bug with its test.
- [x] `brush/canvas/core.js` → `src/brush/canvas/core.ts` — cross-checked against jui-chart-vue's
      `ChartCanvasBase.vue`/`useCanvasChart.ts`: DECISIVELY CORRECTED — that Phase E canvas infrastructure
      (DPI-scaled sizing, `requestAnimationFrame` loop) is entirely jui-chart-vue's own independent
      invention; the real 45-line `chart.brush.canvas.core` has ZERO canvas-context/DPI/RAF logic. What it
      actually adds over `CoreBrush`: `addPolygon()`/`drawAfter()`, a back-to-front z-sort for hand-rolled
      3D canvas brushes (confirmed dead everywhere jui-chart-vue ported except `dot3d.js`). New finding:
      `CanvasCoreBrush.drawAfter()` completely shadows (does not compose with) `CoreBrush.drawAfter()`'s
      clip-path/CSS-class/translate wiring. See the "Progress log" writeup above for the full cross-check.
- [x] `brush/polygon/core.js` → `src/brush/polygon/core.ts` — cross-checked against jui-chart-vue's
      `column3d.js`/`line3d.js` writeup (`createPolygon()`/`chart.draw.calculate3d()`/z-sort `order`
      already documented there): CONFIRMED, precisely, method-for-method — no corrections needed. Also
      confirmed the `if(element)`-gated order stamp (no stamp when `callback` returns nothing, matching
      `line3d.js`'s real usage) and the `static setup()` `{id: null, clip: false}` defaults (`clip: false`
      diverging from `CoreBrush.setup()`'s own `clip: true`). See the "Progress log" writeup above.
- [x] `brush/map/core.js` → `src/brush/map/core.ts` — CONFIRMED still an empty extension-point stub with
      zero concrete subclasses anywhere public (re-verified via `grep -rn "chart.brush.map.core"` across
      the real source tree: only its own `name:` declaration matches). Ported faithfully as a literally
      empty `class MapCoreBrush extends CoreBrush {}`. See the "Progress log" writeup above.
- [x] `widget/core.js` → `src/widget/core.ts` — the root nearly every jui-chart-vue widget composable's
      extend-chain writeup cites (`chart.widget.core`'s `on()`/`getIndexArray()` etc., per `rotate3d.js`'s
      Phase E entry). See the "Progress log" writeup at the top of this section for the full method
      surface, the `Draw`-not-`Core` extend-target correction, and the `on()`/`isRender()`/`drawAfter()`
      cross-check against jui-chart-vue's `rotate3d.js` writeup.
- [x] `widget/canvas/core.js` → `src/widget/canvas/core.ts` — no existing jui-chart-vue reference; real
      source shows it adds NOTHING over `CoreWidget` except a completely empty `drawAfter()` override
      (no canvas-context access, no hit-testing). Zero concrete subclasses anywhere public. See the
      "Progress log" writeup above for the full finding and the preserved CSS-class-stamp-shadowing quirk.
- [x] `widget/polygon/core.js` → `src/widget/polygon/core.ts` — cross-checked against jui-chart-vue's
      `rotate3d.js`/`useRotate3d.ts` writeup ("a two-line pass-through — empty `drawAfter()` override,
      nothing else"): CONFIRMED verbatim against the real source, not a correction. Byte-identical in
      shape to `widget/canvas/core.js`. See the "Progress log" writeup above.
- [x] `widget/map/core.js` → `src/widget/map/core.ts` — CONFIRMED still an empty extension-point stub with
      zero concrete subclasses anywhere public, same category as `brush/map/core.js`. Genuinely different
      shape from its canvas/polygon siblings though: a vestigial 3-parameter (unused) constructor and a
      `static setup()` override (`{axis:0}`), but NO `drawAfter` override — inherits `CoreWidget`'s real
      CSS-class-stamping behavior unmodified, unlike the canvas/polygon siblings. See the "Progress log"
      writeup above.

## Phase F — `jui-chart-vue` migration (real runtime dependency)

**Only start once Phases A–E are built and independently tested.** Goal: `jui-chart-vue` adds `jui-graph-ts`
as a real `dependencies` entry and each composable that has a `jui-graph-ts` equivalent becomes a thin
wrapper delegating to it, instead of owning a parallel hand-port of the same algorithm. This is a real
migration of already-shipped, already-tested code — treat every swap as a refactor that must not change
observable behavior, verified by jui-chart-vue's own existing spec suites continuing to pass unmodified
wherever possible (same expected values), plus a full re-run of its Playwright route sweep at the end.

Do not start this phase's file list until Phases A–E are checked off — it will be enumerated in detail
(composable-by-composable mapping to the jui-graph-ts class/module it should delegate to) as a dedicated
planning step once there's something real to map against, not guessed at up front.

## Progress log

(Completion summaries get added here per phase, mirroring jui-chart-vue's `PORT_STATUS.md` format — each
phase gets a summary block at the top of its section once done.)
