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
