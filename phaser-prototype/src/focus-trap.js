// Keeps Tab inside an open dialog. Given the dialog's focusable elements, the
// element that has focus and the Tab direction, returns the element that
// should receive focus, or null to let the browser move focus normally.
export function nextFocus(focusables, active, backwards) {
  if (!focusables.length) return null;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const index = focusables.indexOf(active);
  if (index === -1) return backwards ? last : first;
  if (backwards && active === first) return last;
  if (!backwards && active === last) return first;
  return null;
}
