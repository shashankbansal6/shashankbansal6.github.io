// The animation loops set the same few styles on every frame. Remember the last value written and skip the write when
// it has not changed, so a frame where nothing moved costs no style work.
export function setStyle(el, prop, value) {
  const last = el.__style || (el.__style = {});
  if (last[prop] === value) return;
  last[prop] = value;
  el.style[prop] = value;
}

// Replacing text, even with the same text, makes a new text node and dirties layout.
export function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}
