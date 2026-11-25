// Shrinks a button's label, a pixel at a time, until it fits on one line:
// long words in some languages ("Clasificación") on a narrow phone. A label
// that fits keeps the stylesheet's size. Run it again whenever the language
// or the button's width changes; it always starts from the stylesheet's size.
export function fitLabels(buttons, { min = 12 } = {}) {
  for (const button of buttons) {
    if (!button) continue;
    button.style.removeProperty("font-size");
    let size = parseFloat(getComputedStyle(button).fontSize);
    while (button.scrollWidth > button.clientWidth && size > min) {
      size -= 1;
      button.style.fontSize = `${size}px`;
    }
  }
}
