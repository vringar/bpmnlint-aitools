const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  getOrientation,
  orderedGap,
  computeBetweenGuide,
  computeChainGuide,
  computeSpacingGuide
} = require('../lib/gapMath');

function box(x, y, width, height) {
  return { x, y, width, height };
}

function connect(source, target) {
  const connection = { source, target };
  source.outgoing = (source.outgoing || []).concat(connection);
  target.incoming = (target.incoming || []).concat(connection);
}

describe('getOrientation', () => {
  it('detects a horizontal chain', () => {
    assert.equal(getOrientation(box(0, 0, 100, 80), box(300, 10, 100, 80)), 'horizontal');
  });

  it('detects a vertical chain', () => {
    assert.equal(getOrientation(box(0, 0, 100, 80), box(10, 300, 100, 80)), 'vertical');
  });
});

describe('orderedGap', () => {
  it('is order-independent for horizontal boxes', () => {
    const a = box(0, 0, 100, 80);
    const b = box(300, 0, 100, 80);

    assert.equal(orderedGap('horizontal', a, b), 200);
    assert.equal(orderedGap('horizontal', b, a), 200);
  });

  it('is order-independent for vertical boxes', () => {
    const a = box(0, 0, 100, 80);
    const b = box(0, 300, 100, 80);

    assert.equal(orderedGap('vertical', a, b), 220);
    assert.equal(orderedGap('vertical', b, a), 220);
  });
});

describe('computeBetweenGuide', () => {
  it('matches when the shape sits exactly midway between its neighbors', () => {
    const predecessor = box(0, 0, 100, 80);
    const shape = { incoming: [], outgoing: [] };
    const successor = box(400, 0, 100, 80);

    connect(predecessor, shape);
    connect(shape, successor);

    const movedBounds = box(200, 0, 100, 80);
    const guide = computeBetweenGuide(shape, movedBounds);

    assert.ok(guide);
    assert.equal(guide.orientation, 'horizontal');
    assert.equal(guide.segments[0].gap, 100);
    assert.equal(guide.segments[1].gap, 100);
  });

  it('returns null once the gaps diverge beyond tolerance', () => {
    const predecessor = box(0, 0, 100, 80);
    const shape = { incoming: [], outgoing: [] };
    const successor = box(400, 0, 100, 80);

    connect(predecessor, shape);
    connect(shape, successor);

    const movedBounds = box(240, 0, 100, 80);
    assert.equal(computeBetweenGuide(shape, movedBounds), null);
  });

  it('returns null when either neighbor is missing', () => {
    const shape = { incoming: [], outgoing: [] };
    assert.equal(computeBetweenGuide(shape, box(0, 0, 100, 80)), null);
  });
});

describe('computeChainGuide', () => {
  it('matches when the trailing gap repeats the established gap', () => {
    const grandPredecessor = box(0, 0, 100, 80);
    const predecessor = box(200, 0, 100, 80);
    const shape = { incoming: [], outgoing: [] };

    connect(grandPredecessor, predecessor);
    connect(predecessor, shape);

    const movedBounds = box(400, 0, 100, 80);
    const guide = computeChainGuide(shape, movedBounds);

    assert.ok(guide);
    assert.equal(guide.segments[0].gap, 100);
    assert.equal(guide.segments[1].gap, 100);
  });

  it('is skipped once the shape gains an outgoing flow', () => {
    const grandPredecessor = box(0, 0, 100, 80);
    const predecessor = box(200, 0, 100, 80);
    const shape = { incoming: [], outgoing: [] };
    const next = box(600, 0, 100, 80);

    connect(grandPredecessor, predecessor);
    connect(predecessor, shape);
    connect(shape, next);

    assert.equal(computeChainGuide(shape, box(400, 0, 100, 80)), null);
  });

  it('returns null without a grandpredecessor', () => {
    const predecessor = box(200, 0, 100, 80);
    const shape = { incoming: [], outgoing: [] };

    connect(predecessor, shape);

    assert.equal(computeChainGuide(shape, box(400, 0, 100, 80)), null);
  });
});

describe('computeSpacingGuide', () => {
  it('prefers the between-guide when both neighbors are present', () => {
    const grandPredecessor = box(0, 0, 100, 80);
    const predecessor = box(200, 0, 100, 80);
    const shape = { incoming: [], outgoing: [] };
    const successor = box(500, 0, 100, 80);

    connect(grandPredecessor, predecessor);
    connect(predecessor, shape);
    connect(shape, successor);

    const guide = computeSpacingGuide(shape, box(350, 0, 100, 80));

    assert.ok(guide);
    assert.equal(guide.segments[0].from, predecessor);
    assert.equal(guide.segments[1].to, successor);
  });
});
