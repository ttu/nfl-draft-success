/**
 * Width of an SVG's coordinate system for a chart drawn `containerWidth` px
 * wide. A fixed viewBox scales its text with the chart, so a chart laid out
 * for desktop drew its labels at a few px on a phone. Matching the container
 * keeps text at the size it is set in; `min` stops the plot from cramping on a
 * phone (text there scales down only a little), and `max` keeps the desktop
 * chart exactly as designed. Unmeasured (null) means the design width.
 */
export function fitViewWidth(
  containerWidth: number | null,
  { min, max }: { min: number; max: number },
): number {
  if (containerWidth === null) return max;
  return Math.min(max, Math.max(min, Math.round(containerWidth)));
}
