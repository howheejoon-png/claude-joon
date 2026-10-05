/** Before/after comparison slider. */
export function initBeforeAfter() {
  const wrap = document.querySelector('[data-ba]');
  if (!wrap) return;

  const after = wrap.querySelector('.ba__after');
  const handle = wrap.querySelector('[data-ba-handle]');
  const range = wrap.querySelector('input[type="range"]');
  if (!after || !handle || !range) return;

  const set = (v) => {
    after.style.clipPath = `inset(0 0 0 ${v}%)`;
    handle.style.left = `${v}%`;
  };
  range.addEventListener('input', () => set(range.value));
  set(range.value || 50);
}
