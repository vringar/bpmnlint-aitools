const { computeSpacingGuide } = require('./gapMath');
const { renderGuide, clearLayer } = require('./rendering');

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
