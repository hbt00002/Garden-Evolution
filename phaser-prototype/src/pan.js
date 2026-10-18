// The maths of looking around a world. Each world is a 16:9 painting. On a
// screen that is narrower than that (any phone held upright) only a strip of it
// is visible behind the board; the rest can be brought into view by sliding the
// painting sideways. Pure functions, no DOM.

// The paintings are 1672 x 936.
export const ART_ASPECT = 1672 / 936;

// How wide the world has to be drawn to show the whole painting at the height of
// the screen, and how far it can slide. Both are 0 extra on a screen that is
// already as wide as the painting.
export function panExtent(viewWidth, viewHeight, aspect = ART_ASPECT) {
  const canvasWidth = Math.max(viewWidth, Math.round(viewHeight * aspect));
  // A 16:9 screen is a few pixels narrower than the painting: not worth a pan.
  if (canvasWidth - viewWidth < MIN_PAN) return { canvasWidth: viewWidth, maxOffset: 0 };
  return { canvasWidth, maxOffset: canvasWidth - viewWidth };
}
const MIN_PAN = 24;

// Which part of the painting the normal, cropped background centres on, as a
// fraction of the way across (0 = left edge, 1 = right edge). The moonlit world
// leans toward its moon on narrow screens; every other world is centred.
export function normalFocus(stage, viewWidth, viewHeight) {
  if (stage !== 5) return 0.5;
  const aspect = viewWidth / viewHeight;
  if (aspect <= 10 / 18) return 0.72;
  if (aspect <= 0.75) return 0.68;
  if (aspect <= 1) return 0.62;
  return 0.5;
}

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const clampOffset = (offset, maxOffset) => clamp(offset, 0, Math.max(0, maxOffset));
export const offsetForFraction = (fraction, maxOffset) => clampOffset(fraction * maxOffset, maxOffset);
export const fractionForOffset = (offset, maxOffset) => (maxOffset > 0 ? clamp(offset / maxOffset, 0, 1) : 0.5);

export const easeInOutCubic = t => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

// Dragging: the painting follows the finger, so moving the finger left slides
// the painting left (the offset grows).
export function dragOffset(startOffset, startX, currentX, maxOffset) {
  return clampOffset(startOffset - (currentX - startX), maxOffset);
}

// A guided look across the painting: from where the background normally rests,
// out to one edge, across to the other, and back, ending exactly where it
// started so the hand-over to the normal background is seamless. Returns
// { duration, segments } where each segment goes from one fraction to the next.
export function revealPath(focus, { pannable }) {
  if (!pannable) return { duration: 3200, segments: [{ from: focus, to: focus, ms: 3200 }] };
  const segments = [
    { from: focus, to: 0.04, ms: 1000 },
    { from: 0.04, to: 0.96, ms: 1900 },
    { from: 0.96, to: focus, ms: 1300 }
  ];
  return { duration: segments.reduce((sum, segment) => sum + segment.ms, 0), segments };
}

// Where along the painting (a fraction) the guided look is after `elapsed` ms.
export function positionAt(path, elapsed) {
  let remaining = Math.max(0, elapsed);
  for (const segment of path.segments) {
    if (remaining <= segment.ms) {
      return segment.from + (segment.to - segment.from) * easeInOutCubic(remaining / segment.ms);
    }
    remaining -= segment.ms;
  }
  return path.segments.at(-1).to;
}
