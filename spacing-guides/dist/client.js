/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./lib/SpacingGuides.js"
/*!******************************!*\
  !*** ./lib/SpacingGuides.js ***!
  \******************************/
(module, __unused_webpack_exports, __webpack_require__) {

const { computeSpacingGuide } = __webpack_require__(/*! ./gapMath */ "./lib/gapMath.js");
const { renderGuide, clearLayer } = __webpack_require__(/*! ./rendering */ "./lib/rendering.js");

const LAYER_NAME = 'spacing-guides';

function SpacingGuides(eventBus, canvas) {
  this._canvas = canvas;
  this._layer = null;

  eventBus.on('shape.move.move', (event) => this._update(event));
  eventBus.on(['shape.move.end', 'shape.move.hover', 'shape.move.out', 'shape.move.cleanup'], () => this._clear());
}

SpacingGuides.$inject = ['eventBus', 'canvas'];

SpacingGuides.prototype._getLayer = function() {
  if (!this._layer) {
    this._layer = this._canvas.getLayer(LAYER_NAME, 1200);
  }

  return this._layer;
};

SpacingGuides.prototype._update = function(event) {
  const context = event.context;
  const shapes = context && context.shapes;

  // Keep the prototype scoped to the common case: dragging a single element.
  if (!shapes || shapes.length !== 1) {
    return this._clear();
  }

  const shape = shapes[0];
  const movedBounds = {
    x: shape.x + event.dx,
    y: shape.y + event.dy,
    width: shape.width,
    height: shape.height
  };

  const guide = computeSpacingGuide(shape, movedBounds);

  if (!guide) {
    return this._clear();
  }

  renderGuide(this._getLayer(), guide);
};

SpacingGuides.prototype._clear = function() {
  if (this._layer) {
    clearLayer(this._layer);
  }
};

module.exports = SpacingGuides;


/***/ },

/***/ "./lib/SpacingGuidesModule.js"
/*!************************************!*\
  !*** ./lib/SpacingGuidesModule.js ***!
  \************************************/
(module, __unused_webpack_exports, __webpack_require__) {

const SpacingGuides = __webpack_require__(/*! ./SpacingGuides */ "./lib/SpacingGuides.js");

module.exports = {
  __init__: ['spacingGuides'],
  spacingGuides: ['type', SpacingGuides]
};


/***/ },

/***/ "./lib/gapMath.js"
/*!************************!*\
  !*** ./lib/gapMath.js ***!
  \************************/
(module) {

const TOLERANCE = 1;

function mid(box) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
}

function getOrientation(a, b) {
  const dx = Math.abs(mid(a).x - mid(b).x);
  const dy = Math.abs(mid(a).y - mid(b).y);

  return dx >= dy ? 'horizontal' : 'vertical';
}

// Gap between two boxes' facing edges along the given axis, regardless of
// which one is visually first.
function orderedGap(orientation, a, b) {
  if (orientation === 'horizontal') {
    return a.x <= b.x ? b.x - (a.x + a.width) : a.x - (b.x + b.width);
  }

  return a.y <= b.y ? b.y - (a.y + a.height) : a.y - (b.y + b.height);
}

function getPredecessor(shape) {
  const connection = shape.incoming && shape.incoming[0];
  return (connection && connection.source !== shape) ? connection.source : null;
}

function getSuccessor(shape) {
  const connection = shape.outgoing && shape.outgoing[0];
  return (connection && connection.target !== shape) ? connection.target : null;
}

// Shape sits between an already-connected predecessor and successor: the
// gap on the left should match the gap on the right.
function computeBetweenGuide(shape, movedBounds) {
  const predecessor = getPredecessor(shape);
  const successor = getSuccessor(shape);

  if (!predecessor || !successor) {
    return null;
  }

  const orientation = getOrientation(predecessor, successor);
  const gapBefore = orderedGap(orientation, predecessor, movedBounds);
  const gapAfter = orderedGap(orientation, movedBounds, successor);

  if (Math.abs(gapBefore - gapAfter) > TOLERANCE) {
    return null;
  }

  return {
    orientation,
    segments: [
      { from: predecessor, to: movedBounds, gap: gapBefore },
      { from: movedBounds, to: successor, gap: gapAfter }
    ]
  };
}

// Shape has a predecessor but no outgoing flow (a leaf being placed/moved):
// the gap to its predecessor should match the gap the predecessor already
// has to *its* predecessor, keeping the chain's rhythm consistent.
function computeChainGuide(shape, movedBounds) {
  if (shape.outgoing && shape.outgoing.length) {
    return null;
  }

  const predecessor = getPredecessor(shape);

  if (!predecessor) {
    return null;
  }

  const grandPredecessor = getPredecessor(predecessor);

  if (!grandPredecessor) {
    return null;
  }

  const orientation = getOrientation(grandPredecessor, predecessor);
  const establishedGap = orderedGap(orientation, grandPredecessor, predecessor);
  const currentGap = orderedGap(orientation, predecessor, movedBounds);

  if (Math.abs(establishedGap - currentGap) > TOLERANCE) {
    return null;
  }

  return {
    orientation,
    segments: [
      { from: grandPredecessor, to: predecessor, gap: establishedGap },
      { from: predecessor, to: movedBounds, gap: currentGap }
    ]
  };
}

function computeSpacingGuide(shape, movedBounds) {
  return computeBetweenGuide(shape, movedBounds) || computeChainGuide(shape, movedBounds);
}

module.exports = {
  TOLERANCE,
  getOrientation,
  orderedGap,
  getPredecessor,
  getSuccessor,
  computeBetweenGuide,
  computeChainGuide,
  computeSpacingGuide
};


/***/ },

/***/ "./lib/rendering.js"
/*!**************************!*\
  !*** ./lib/rendering.js ***!
  \**************************/
(module) {

const SVG_NS = 'http://www.w3.org/2000/svg';
const TICK_LENGTH = 8;
const LABEL_OFFSET = 12;
const MATCH_COLOR = '#2e8b3d';

function svg(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const key in attrs) {
    el.setAttribute(key, attrs[key]);
  }
  return el;
}

// Draws a dimension-line-style guide (line + end ticks + px label) along the
// gap between two boxes, offset to one side so it doesn't sit on top of them.
function drawSegment(parent, orientation, from, to, gapValue) {
  const group = svg('g', { class: 'djs-spacing-guide-segment' });

  if (orientation === 'horizontal') {
    const y = Math.min(from.y, to.y) + Math.max(from.height, to.height) + LABEL_OFFSET;
    const x1 = from.x <= to.x ? from.x + from.width : to.x + to.width;
    const x2 = from.x <= to.x ? to.x : from.x;

    group.appendChild(svg('line', { x1, y1: y, x2, y2: y, stroke: MATCH_COLOR, 'stroke-width': 1.5 }));
    group.appendChild(svg('line', { x1, y1: y - TICK_LENGTH / 2, x2: x1, y2: y + TICK_LENGTH / 2, stroke: MATCH_COLOR, 'stroke-width': 1.5 }));
    group.appendChild(svg('line', { x1: x2, y1: y - TICK_LENGTH / 2, x2, y2: y + TICK_LENGTH / 2, stroke: MATCH_COLOR, 'stroke-width': 1.5 }));

    const label = svg('text', {
      x: (x1 + x2) / 2,
      y: y - 4,
      fill: MATCH_COLOR,
      'font-size': 10,
      'text-anchor': 'middle'
    });
    label.textContent = `${Math.round(gapValue)}px`;
    group.appendChild(label);
  } else {
    const x = Math.min(from.x, to.x) + Math.max(from.width, to.width) + LABEL_OFFSET;
    const y1 = from.y <= to.y ? from.y + from.height : to.y + to.height;
    const y2 = from.y <= to.y ? to.y : from.y;

    group.appendChild(svg('line', { x1: x, y1, x2: x, y2, stroke: MATCH_COLOR, 'stroke-width': 1.5 }));
    group.appendChild(svg('line', { x1: x - TICK_LENGTH / 2, y1, x2: x + TICK_LENGTH / 2, y2: y1, stroke: MATCH_COLOR, 'stroke-width': 1.5 }));
    group.appendChild(svg('line', { x1: x - TICK_LENGTH / 2, y1: y2, x2: x + TICK_LENGTH / 2, y2, stroke: MATCH_COLOR, 'stroke-width': 1.5 }));

    const label = svg('text', {
      x: x + 4,
      y: (y1 + y2) / 2,
      fill: MATCH_COLOR,
      'font-size': 10,
      'dominant-baseline': 'middle'
    });
    label.textContent = `${Math.round(gapValue)}px`;
    group.appendChild(label);
  }

  parent.appendChild(group);
}

function renderGuide(layer, guide) {
  clearLayer(layer);

  guide.segments.forEach(({ from, to, gap }) => {
    drawSegment(layer, guide.orientation, from, to, gap);
  });
}

function clearLayer(layer) {
  while (layer.firstChild) {
    layer.removeChild(layer.firstChild);
  }
}

module.exports = {
  renderGuide,
  clearLayer
};


/***/ },

/***/ "./node_modules/camunda-modeler-plugin-helpers/index.js"
/*!**************************************************************!*\
  !*** ./node_modules/camunda-modeler-plugin-helpers/index.js ***!
  \**************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getModelerDirectory: () => (/* binding */ getModelerDirectory),
/* harmony export */   getPluginsDirectory: () => (/* binding */ getPluginsDirectory),
/* harmony export */   registerBpmnJSModdleExtension: () => (/* binding */ registerBpmnJSModdleExtension),
/* harmony export */   registerBpmnJSPlugin: () => (/* binding */ registerBpmnJSPlugin),
/* harmony export */   registerClientExtension: () => (/* binding */ registerClientExtension),
/* harmony export */   registerClientPlugin: () => (/* binding */ registerClientPlugin),
/* harmony export */   registerCloudBpmnJSModdleExtension: () => (/* binding */ registerCloudBpmnJSModdleExtension),
/* harmony export */   registerCloudBpmnJSPlugin: () => (/* binding */ registerCloudBpmnJSPlugin),
/* harmony export */   registerCloudDmnJSModdleExtension: () => (/* binding */ registerCloudDmnJSModdleExtension),
/* harmony export */   registerCloudDmnJSPlugin: () => (/* binding */ registerCloudDmnJSPlugin),
/* harmony export */   registerDmnJSModdleExtension: () => (/* binding */ registerDmnJSModdleExtension),
/* harmony export */   registerDmnJSPlugin: () => (/* binding */ registerDmnJSPlugin),
/* harmony export */   registerPlatformBpmnJSModdleExtension: () => (/* binding */ registerPlatformBpmnJSModdleExtension),
/* harmony export */   registerPlatformBpmnJSPlugin: () => (/* binding */ registerPlatformBpmnJSPlugin),
/* harmony export */   registerPlatformDmnJSModdleExtension: () => (/* binding */ registerPlatformDmnJSModdleExtension),
/* harmony export */   registerPlatformDmnJSPlugin: () => (/* binding */ registerPlatformDmnJSPlugin)
/* harmony export */ });
/**
 * Validate and register a client plugin.
 *
 * @param {Object} plugin
 * @param {String} type
 */
function registerClientPlugin(plugin, type) {
  var plugins = window.plugins || [];
  window.plugins = plugins;

  if (!plugin) {
    throw new Error('plugin not specified');
  }

  if (!type) {
    throw new Error('type not specified');
  }

  plugins.push({
    plugin: plugin,
    type: type
  });
}

/**
 * Validate and register a client plugin.
 *
 * @param {import('react').ComponentType} extension
 *
 * @example
 *
 * import MyExtensionComponent from './MyExtensionComponent';
 *
 * registerClientExtension(MyExtensionComponent);
 */
function registerClientExtension(component) {
  registerClientPlugin(component, 'client');
}

/**
 * Validate and register a bpmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerBpmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const BpmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerBpmnJSPlugin(BpmnJSModule);
 */
function registerBpmnJSPlugin(module) {
  registerClientPlugin(module, 'bpmn.modeler.additionalModules');
}

/**
 * Validate and register a platform specific bpmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerPlatformBpmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const BpmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerPlatformBpmnJSPlugin(BpmnJSModule);
 */
function registerPlatformBpmnJSPlugin(module) {
  registerClientPlugin(module, 'bpmn.platform.modeler.additionalModules');
}

/**
 * Validate and register a cloud specific bpmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerCloudBpmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const BpmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerCloudBpmnJSPlugin(BpmnJSModule);
 */
function registerCloudBpmnJSPlugin(module) {
  registerClientPlugin(module, 'bpmn.cloud.modeler.additionalModules');
}

/**
 * Validate and register a bpmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerBpmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerBpmnJSModdleExtension(moddleDescriptor);
 */
function registerBpmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'bpmn.modeler.moddleExtension');
}

/**
 * Validate and register a platform specific bpmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerPlatformBpmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerPlatformBpmnJSModdleExtension(moddleDescriptor);
 */
function registerPlatformBpmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'bpmn.platform.modeler.moddleExtension');
}

/**
 * Validate and register a cloud specific bpmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerCloudBpmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerCloudBpmnJSModdleExtension(moddleDescriptor);
 */
function registerCloudBpmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'bpmn.cloud.modeler.moddleExtension');
}

/**
 * Validate and register a dmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerDmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerDmnJSModdleExtension(moddleDescriptor);
 */
function registerDmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'dmn.modeler.moddleExtension');
}

/**
 * Validate and register a cloud specific dmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerCloudDmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerCloudDmnJSModdleExtension(moddleDescriptor);
 */
function registerCloudDmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'dmn.cloud.modeler.moddleExtension');
}

/**
 * Validate and register a platform specific dmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerPlatformDmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerPlatformDmnJSModdleExtension(moddleDescriptor);
 */
function registerPlatformDmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'dmn.platform.modeler.moddleExtension');
}

/**
 * Validate and register a dmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerDmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const DmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerDmnJSPlugin(DmnJSModule, [ 'drd', 'literalExpression' ]);
 * registerDmnJSPlugin(DmnJSModule, 'drd')
 */
function registerDmnJSPlugin(module, components) {

  if (!Array.isArray(components)) {
    components = [ components ]
  }

  components.forEach(c => registerClientPlugin(module, `dmn.modeler.${c}.additionalModules`));
}

/**
 * Validate and register a cloud specific dmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerCloudDmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const DmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerCloudDmnJSPlugin(DmnJSModule, [ 'drd', 'literalExpression' ]);
 * registerCloudDmnJSPlugin(DmnJSModule, 'drd')
 */
function registerCloudDmnJSPlugin(module, components) {

  if (!Array.isArray(components)) {
    components = [ components ]
  }

  components.forEach(c => registerClientPlugin(module, `dmn.cloud.modeler.${c}.additionalModules`));
}

/**
 * Validate and register a platform specific dmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerPlatformDmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const DmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerPlatformDmnJSPlugin(DmnJSModule, [ 'drd', 'literalExpression' ]);
 * registerPlatformDmnJSPlugin(DmnJSModule, 'drd')
 */
function registerPlatformDmnJSPlugin(module, components) {

  if (!Array.isArray(components)) {
    components = [ components ]
  }

  components.forEach(c => registerClientPlugin(module, `dmn.platform.modeler.${c}.additionalModules`));
}

/**
 * Return the modeler directory, as a string.
 *
 * @deprecated Will be removed in future Camunda Modeler versions without replacement.
 *
 * @return {String}
 */
function getModelerDirectory() {
  return window.getModelerDirectory();
}

/**
 * Return the modeler plugin directory, as a string.
 *
 * @deprecated Will be removed in future Camunda Modeler versions without replacement.
 *
 * @return {String}
 */
function getPluginsDirectory() {
  return window.getPluginsDirectory();
}

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			const e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	// define getter/value functions for harmony exports
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop));
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = (exports) => {
/******/ 		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/ 	
/************************************************************************/
let __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";
/*!*************************!*\
  !*** ./client/index.js ***!
  \*************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var camunda_modeler_plugin_helpers__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! camunda-modeler-plugin-helpers */ "./node_modules/camunda-modeler-plugin-helpers/index.js");
/* harmony import */ var _lib_SpacingGuidesModule__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/SpacingGuidesModule */ "./lib/SpacingGuidesModule.js");




(0,camunda_modeler_plugin_helpers__WEBPACK_IMPORTED_MODULE_0__.registerBpmnJSPlugin)(_lib_SpacingGuidesModule__WEBPACK_IMPORTED_MODULE_1__);

})();

/******/ })()
;
//# sourceMappingURL=client.js.map