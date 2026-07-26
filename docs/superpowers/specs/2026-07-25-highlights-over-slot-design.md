# Highlights ranked by over slot

Date: 2026-07-25

## Problem

`getLeagueHighlights` ranks steals by raw draft score among round 4+ picks, and
busts by raw draft score among round 1 picks. The round gates exist because raw
score is largely handed out by draft capital: without them, every "steal" would
be a top-10 pick and every "bust" a seventh-rounder.

Ranking inside those gates still misleads. Raw score puts Maxx Crosby (R4 #106,
+51 over slot) above Trey Smith (R6 #226, **+72**), because a fourth-rounder
scoring 98 beats a sixth-rounder scoring 94. Brock Purdy (#262 overall, +66)
misses the top ten entirely. The round-1 gate also hides honest busts:
Jonathon Brooks (R2 #46, −62) and Kellen Mond (R3 #66, −59) never appear.

## Evidence

Over slot (`getPlayerDraftSkill`) computed across all scored picks, 2018–2026,
with no round filter:

- Top 20 by round: `R4:2, R5:6, R6:6, R7:6` — no pick from rounds 1–3.
- Bottom 20 by round: `R1:10, R2:4, R3:6` — no pick from rounds 4–7.

The baseline curve enforces the round split structurally. A top-5 pick has ~9
points of headroom (100 − 83); a seventh-rounder has ~17 points of downside
(17 − 0). The hand-coded filter reproduces what the curve already does.

## Design

### `src/lib/getLeagueHighlights.ts`

`PlayerHighlight` gains `overSlot: number`, from `getPlayerDraftSkill` under the
same `GetPlayerRoleOptions` as `score`, so the two are on the same season basis.
Both fields stay on the interface — the view renders both.

Both round gates are removed. Every pick with season data is a candidate for
both lists.

- `compareSteal`: higher `overSlot`; ties to the **later** overall pick (same
  surplus from a later slot is the better find); then higher raw score.
- `compareBust`: lower `overSlot`; ties to the **earlier** overall pick; then
  lower raw score.

`mostCoreStarters` is unchanged — it counts roles, not scores, so draft capital
does not distort it the same way.

Edge case: the lists now draw from one pool, so a dataset with fewer than 40
scored picks can place the same player in both. Real windows carry 250+ picks
per class, so this only surfaces in fixtures. Covered by a test rather than a
guard that would never fire in production.

### `src/components/views/highlights/HighlightsView.tsx`

The row headline becomes `formatOverSlot(overSlot)`, colored by sign with
`var(--positive)` / `var(--negative)`, matching `draft/PlayerList.tsx`. The raw
score moves to the meta line: `OL · '21 · R6 #226 · KC · score 94`.

`scoreTierClass` leaves this view: its thresholds describe the 0–100 scale, not
the signed value the row now leads with.

Copy:

- Steals note: `round 4+ · best value` → `best value vs draft slot`
- Busts note: `round 1 · priciest misses` → `worst value vs draft slot`
- Empty labels drop their round qualifiers.
- Footer explains why a 7th-rounder at 83 can outrank a 4th-rounder at 96.
- Hero lede reframes late-round value as an outcome, not a rule.

### Bust exclusions

Removing the round-1 filter admits picks whose career ended for reasons outside
football. A player who never took a snap scores 0 against his slot, so such a
career lands near the top of the busts list — and the round gate had been hiding
them only by accident. Calling that a draft failure is wrong on the facts: the
team's evaluation was never tested.

`src/data/bust-exclusions.json` is a hand-maintained list (no nflverse feed
carries this), read by `src/lib/bustExclusions.ts`. `getLeagueHighlights`
filters bust candidates through `isBustExcluded`; the list backfills past them.

Scope is deliberately narrow — `death` and `non_football_medical` only. A career
derailed by a football injury is a real draft outcome (durability is scouted),
and so is one ended by off-field conduct (character is scouted). Both stay on
the list. Steals and the core-starter tally are unaffected: a player who
produced keeps that credit.

Suppression is silent. Nothing on the page names or counts the excluded picks.

Unknown reason strings throw at module load rather than silently passing
through, so a typo in the data file fails loudly.

### Out of scope

Draft-class maturity. Picks from classes too young to judge (2025, 2026) stay
eligible, as they are today. A highlights page should show what is happening
now.

## Testing

- `getLeagueHighlights.test.ts`: replace the round-gate assertions. An early
  pick with a high raw score ranks below a late pick with a lower raw score but
  higher over slot; a round-2/3 miss is eligible for the bust list; tie-breaks
  hold; small-pool overlap is asserted, not prevented.
- `HighlightsView.test.tsx`: over-slot headline, raw score on the meta line,
  updated empty-state copy.
- `/visual-verify` pass, since the rendered rows change.
