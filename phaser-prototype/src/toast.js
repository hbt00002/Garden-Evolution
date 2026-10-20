// A short message that fades in at the top of the screen and goes away by itself.
// The element is a live region, so screen readers announce it too.
export function createToast(el, { showMs = 2400, fadeMs = 300 } = {}) {
  let timer = null;
  return {
    show(message) {
      el.textContent = message;
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add("show"));
      clearTimeout(timer);
      timer = setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => { el.hidden = true; }, fadeMs);
      }, showMs);
    }
  };
}
