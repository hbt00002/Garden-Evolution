// Where a world's camera rests. Each world is a painting (designW x designH)
// and the camera shows a window onto it, scaled by `zoom` (chosen so the window
// always lies inside the painting). `focus` is how far across the painting the
// window sits horizontally: 0 = the left edge of the painting, 1 = the right
// edge, 0.5 = the middle. null/undefined means the middle (or `fallback`).
//
// Phaser zooms a camera about the centre of its viewport, so the top-left of
// what is visible is scroll + (view - view / zoom) / 2, not scroll. That is
// accounted for here, so the window lands exactly on the painting and never
// shows anything beyond its edges.
//
// Looking around the garden (src/world-view.js) moves the window by changing
// the focus; the canvas is never resized, so nothing is ever stretched.
export function cameraScroll(designW, designH, viewW, viewH, zoom, focus, fallback = 0.5) {
  const fraction = Math.min(1, Math.max(0, focus ?? fallback));
  const left = Math.max(0, designW - viewW / zoom) * fraction;
  const top = Math.max(0, designH - viewH / zoom) / 2;
  return {
    x: left - (viewW - viewW / zoom) / 2,
    y: top - (viewH - viewH / zoom) / 2
  };
}
