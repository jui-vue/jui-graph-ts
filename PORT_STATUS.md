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
- [ ] `util/svg.js` + `util/svg/{base,base3d,element,element.path,element.path.rect,element.path.symbol,element.poly,element.transform}.js`
      → `src/util/svg.ts` + `src/util/svg/*.ts` — no existing reference (jui-chart-vue uses Vue SFC templates
      instead of an imperative SVG element builder); full independent port. This is a large sub-tree — worth
      its own dedicated iteration(s).
- [ ] `util/canvas/base.js` → `src/util/canvas/base.ts` — cross-check against jui-chart-vue's
      `canvasPrimitives.ts` (jui-chart-vue deliberately wrote its own minimal primitives rather than porting
      this whole file — see jui-chart-vue's Phase E policy notes; this is the first real 1:1 port of it).
- [ ] `util/canvas/hidpi.js` → `src/util/canvas/hidpi.ts` — jui-chart-vue explicitly evaluated and declined to
      use this (global-prototype-monkeypatching approach judged unsafe for a component library / SSR-
      incompatible; see jui-chart-vue's Phase E entry for `useCanvasChart.ts`). Port it faithfully anyway
      (full-scope goal), but jui-chart-vue's own DPR handling should NOT be migrated to depend on it — keep
      that decision, documented here as a deliberate non-migration.

## Phase B — Base engine layer (`base/`)

Depends on Phase A. `base/base.js`'s registry-only parts are dropped per Phase 0 rule 1/4; its `util.base`
non-registry members (if any turn out to be real product logic, not just OOP scaffolding) get preserved.

- [ ] `base/vector.js` → `src/base/vector.ts`
- [ ] `base/draw.js` → `src/base/draw.ts` — includes `calculate3d()`, already indirectly cross-checkable via
      jui-chart-vue's `usePolygon3d.ts`/dot3d.js Phase E writeup (documented the `Math.max(plotWidth,
      plotHeight, axis.depth)` vs `axis.depth/2` distinction — carry that forward).
- [ ] `base/axis.js` → `src/base/axis.ts` — cross-check against jui-chart-vue's `useAxis.ts`/
      `useChartLayout.ts` (audited in Phase F, `calculatePanel()` layout arithmetic already understood).
- [ ] `base/plane.js` → `src/base/plane.ts`
- [ ] `base/builder.js` → `src/base/builder.ts`
- [ ] `base/animation.js` → `src/base/animation.ts` — the RAF-polling wrapper jui-chart-vue's `dot3d.js`
      writeup noted as "a separate, not-yet-ported juijs-graph/src/base/animation.js" whose `tpf===1`
      skip-first-frame guard its own `ChartCanvasBase.vue`/RAF loop reproduces differently. Port faithfully
      here; no obligation to retrofit jui-chart-vue's `useAnimationFrameLoop.ts` to use it (separate decision
      for Phase F below, once this exists to evaluate against).
- [ ] `base/core.js` → `src/base/core.ts`
- [ ] `base/collection.js` → `src/base/collection.ts`
- [ ] `base/manager.js` → `src/base/manager.ts` — NOTE: much of this file's *purpose* (instance
      registry/selector-based `emit`) is the global-registry pattern Phase 0 says to drop. Read it fully
      before deciding what (if anything) survives as real per-chart-instance event-plumbing vs. what's
      purely an artifact of the old registry design — document the call either way, don't reflexively port
      1:1 just because it's in the file list.
- [ ] `base/map.js` → `src/base/map.ts` — no jui-chart-vue reference (never ported there — see jui-chart-vue
      conversation history: confirmed base engine for a map chart type exists but no concrete
      brush/widget implementations are public anywhere). Full independent port + full independent
      verification (this is real, non-trivial logic: SVG path/polygon loading from data, zoom/pan state).

## Phase C — Grid layer (`grid/`)

Depends on Phase A/B (`base/axis.js` particularly).

- [ ] `grid/core.js` → `src/grid/core.ts`
- [ ] `grid/block.js` → `src/grid/block.ts` — cross-check against jui-chart-vue's `createOrdinalScale`
      usage pattern (ordinal/block-axis grid, already touched indirectly across many Phase B–D chart types).
- [ ] `grid/range.js` → `src/grid/range.ts` — cross-check against jui-chart-vue's linear/range-axis handling.
- [ ] `grid/date.js` + `grid/dateblock.js` → `src/grid/date.ts` + `src/grid/dateblock.ts` — no existing
      reference; full independent port.
- [ ] `grid/log.js` → `src/grid/log.ts` — no existing reference; full independent port.
- [ ] `grid/radar.js` → `src/grid/radar.ts` — no existing reference; full independent port.
- [ ] `grid/rule.js` → `src/grid/rule.ts`
- [ ] `grid/panel.js` → `src/grid/panel.ts`
- [ ] `grid/table.js` → `src/grid/table.ts` — cross-check against jui-chart-vue's `useGridLayout.ts`
      (audited in Phase F as generic/hand-port, but not 1:1 ported from this specific file — verify).
- [ ] `grid/overlap.js` → `src/grid/overlap.ts`
- [ ] `grid/draw2d.js` + `grid/draw3d.js` → `src/grid/draw2d.ts` + `src/grid/draw3d.ts`
- [ ] `grid/fullblock.js` → `src/grid/fullblock.ts`
- [ ] `grid/grid3d.js` → `src/grid/grid3d.ts` — cross-check against jui-chart-vue's `usePolygon3d.ts`'s
      z-axis handling (dot3d.js/column3d.js/line3d.js entries document a simplified linear/ordinal z rather
      than a full ported grid — this file is the real thing being simplified away there).

## Phase D — Polygon layer (`polygon/`)

The 3D engine jui-chart-vue's `usePolygon3d.ts` already wraps a meaningful subset of. This phase has the
richest existing cross-check material of the whole port.

- [ ] `polygon/core.js` → `src/polygon/core.ts` — cross-check against `usePolygon3d.ts`'s rotation-matrix/
      perspective-projection functions (already hand-traced/Node-cross-checked in jui-chart-vue across
      dot3d.js/column3d.js/line3d.js/rotate3d.js's four Phase E iterations).
- [ ] `polygon/point.js` → `src/polygon/point.ts`
- [ ] `polygon/line.js` → `src/polygon/line.ts`
- [ ] `polygon/cube.js` → `src/polygon/cube.ts` — cross-check against `usePolygon3d.ts`'s `cubeVertices()`/
      `CUBE_FACES` (added specifically for `column3d.js`'s port).
- [ ] `polygon/grid.js` → `src/polygon/grid.ts` — no existing jui-chart-vue reference (not needed there);
      full independent port.

## Phase E — Brush/Widget base classes + map plugin points

Thin `extend`-chain root classes. Low line count each, but they define the contract every concrete
brush/widget subclasses — get these exactly right.

- [ ] `brush/core.js` → `src/brush/core.ts` — the root nearly every jui-chart-vue composable's "extend chain"
      writeup cites (`chart.brush.core`). Cross-check method surface against what jui-chart-vue's own
      components/composables actually called across all of Phase A–E (`eachData`, cache methods, etc.).
- [ ] `brush/canvas/core.js` → `src/brush/canvas/core.ts` — cross-check against jui-chart-vue's
      `ChartCanvasBase.vue`/`useCanvasChart.ts` (Phase E's hand-built canvas infra — first real chance to
      compare an independently-designed Vue solution against the actual original base class).
- [ ] `brush/polygon/core.js` → `src/brush/polygon/core.ts` — cross-check against jui-chart-vue's
      `column3d.js`/`line3d.js` writeup (`createPolygon()`/`chart.draw.calculate3d()`/z-sort `order` already
      documented there).
- [ ] `brush/map/core.js` → `src/brush/map/core.ts` — empty extension-point stub in the original; port
      faithfully (trivial) but note in the writeup that it has zero concrete subclasses anywhere public.
- [ ] `widget/core.js` → `src/widget/core.ts` — the root nearly every jui-chart-vue widget composable's
      extend-chain writeup cites (`chart.widget.core`'s `on()`/`getIndexArray()` etc., per `rotate3d.js`'s
      Phase E entry).
- [ ] `widget/canvas/core.js` → `src/widget/canvas/core.ts`
- [ ] `widget/polygon/core.js` → `src/widget/polygon/core.ts` — cross-check against jui-chart-vue's
      `rotate3d.js`/`useRotate3d.ts` writeup.
- [ ] `widget/map/core.js` → `src/widget/map/core.ts` — empty stub, same note as `brush/map/core.js`.

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
