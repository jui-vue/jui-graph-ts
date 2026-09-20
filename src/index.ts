// jui-graph-ts public entry point.
// Populated incrementally as PORT_STATUS.md's phases complete.
//
// Exported as namespaces (`export * as X`), not a flat `export *`, because several original
// source files independently define same-named symbols (e.g. `linear()`/`LinearScale` exist in
// BOTH `util/scale.ts` and `util/scale/linear.ts` - two real, separately-registered modules in the
// original engine with logically-identical but distinct implementations - see `util/scale.ts`'s
// header comment). Namespacing avoids export collisions now and keeps the convention consistent
// as later phases (base/grid/polygon/brush/widget) add their own same-named `core`/`domain`/etc.
// symbols.

export * as mathUtil from './util/math'
export * as colorUtil from './util/color'
export * as scaleUtil from './util/scale'
export * as linearScaleUtil from './util/scale/linear'
export * as ordinalScaleUtil from './util/scale/ordinal'
export * as logScaleUtil from './util/scale/log'
export * as timeScaleUtil from './util/scale/time'
export * as circleScaleUtil from './util/scale/circle'
export * as domUtil from './util/dom'
export * as timeUtil from './util/time'
export * as transformUtil from './util/transform'
export * as svgElementUtil from './util/svg/element'
export * as svgTransformElementUtil from './util/svg/element.transform'
export * as svgPathElementUtil from './util/svg/element.path'
export * as svgPathRectElementUtil from './util/svg/element.path.rect'
export * as svgPathSymbolElementUtil from './util/svg/element.path.symbol'
export * as svgPolyElementUtil from './util/svg/element.poly'
export * as svgBaseUtil from './util/svg/base'
export * as svgBase3dUtil from './util/svg/base3d'
export * as svgUtil from './util/svg'
export * as canvasBaseUtil from './util/canvas/base'
export * as canvasHidpiUtil from './util/canvas/hidpi'
