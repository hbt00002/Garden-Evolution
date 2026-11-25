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

// When a dialog opens, focus goes to its title (a heading with tabindex="-1"),
// not to a button: on Chrome for Android, focusing a button walks the whole
// page (for the keyboard's next/previous field and autofill), which made every
// window slow to open on a phone. Screen readers still hear the dialog's name,
// and Tab from the title goes on to the dialog's first control (nextFocus).
export function focusTitle(title) {
  title?.focus({ preventScroll: true });
}
