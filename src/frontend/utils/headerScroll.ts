/** Accumulate scroll intent, including small trackpad deltas, without flickering on reversals. */
export function createHeaderScrollTracker(initialY: number) {
  let anchor = Math.max(0, initialY);
  let visible = true;
  return (scrollY: number): boolean => {
    const y = Math.max(0, scrollY);
    if (y <= 8) {
      visible = true;
      anchor = y;
    } else if (visible) {
      anchor = Math.min(anchor, y);
      if (y > 80 && y - anchor >= 24) {
        visible = false;
        anchor = y;
      }
    } else {
      anchor = Math.max(anchor, y);
      if (anchor - y >= 12) {
        visible = true;
        anchor = y;
      }
    }
    return visible;
  };
}
