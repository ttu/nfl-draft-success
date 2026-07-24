/**
 * Signed one-decimal "over slot" value, e.g. `+7.4` / `−3.2`. Uses a real minus
 * sign (U+2212) so negatives line up with positives in tabular figures. Zero and
 * positives take a leading `+`.
 */
export function formatOverSlot(value: number): string {
  return value < 0 ? `−${Math.abs(value).toFixed(1)}` : `+${value.toFixed(1)}`;
}
