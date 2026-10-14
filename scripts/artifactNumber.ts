/**
 * Rounding for numbers written into committed build artifacts.
 *
 * `pnpm build` regenerates `default-rankings.json` and
 * `lagged-draft-rankings.json`, they are committed, and CI rebuilds them and
 * checks they did not move (`scripts/check-generated.sh`). That only works if
 * the numbers are bit-identical on every machine, and at full `double`
 * precision they are not: the draft-slot curve runs through `Math.exp` and
 * `Math.log` (`localLinearAt` in `src/lib/draftSlotBaseline.ts`), whose
 * precision ECMAScript leaves to the implementation. V8 answers them from
 * platform libm, so macOS arm64 and Linux x86_64 disagree in the last digit or
 * two — `14.511033713143355` against `14.511033713143357`.
 *
 * Six decimals is nine orders of magnitude clear of that ~1e-15 drift, and far
 * past anything the app shows: over slot renders as `+14.5`. The seventeen
 * digits were never precision, only noise with a decimal point in front.
 *
 * Only the written artifact is rounded. The runtime computes these live for
 * any other year range, where a last-digit difference between two viewers'
 * machines changes nothing either of them can see.
 */
export const ARTIFACT_DECIMALS = 6;

/** `value` at {@link ARTIFACT_DECIMALS}, as a number. */
export function roundForArtifact(value: number): number {
  return Number(value.toFixed(ARTIFACT_DECIMALS));
}
