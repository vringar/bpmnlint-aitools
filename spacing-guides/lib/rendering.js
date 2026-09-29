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
