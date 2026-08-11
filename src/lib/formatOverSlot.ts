/**
 * Signed one-decimal "over slot" value, e.g. `+7.4` / `−3.2`. Uses a real minus
 * sign (U+2212) so negatives line up with positives in tabular figures. Zero and
 * positives take a leading `+`.
 *
 * The sign is taken from the **rounded** figure, not the raw one. Choosing it
 * first printed `−0.0` for a value like −0.04 — claiming a team finished below
 * its slot by an amount too small to show, a distinction the number does not
 * support. Rounding to `-0` first works because `-0 < 0` is false.
 */
export function formatOverSlot(value: number): string {
  const rounded = Number(value.toFixed(1));
  return rounded < 0
    ? `−${Math.abs(rounded).toFixed(1)}`
    : `+${rounded.toFixed(1)}`;
}

/**
 * Whether an over-slot value reads as non-negative — i.e. whether
 * {@link formatOverSlot} prints it with a `+`.
 *
 * Callers colour over slot by sign, and must branch on the same rounded figure
 * the label shows. Testing the raw value instead painted `+0.0` in the negative
 * colour for anything between −0.05 and 0.
 */
export function isOverSlotPositive(value: number): boolean {
  // `>= 0` rather than `!(< 0)` reads the same for −0 (which is `>= 0`) and is
  // the safer branch for NaN.
  return Number(value.toFixed(1)) >= 0;
}
