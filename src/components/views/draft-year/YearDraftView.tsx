import type { CSSProperties } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  TeamLogo,
  PlayerAvatar,
  teamColor,
  roleDesignClass,
  shortRoleLabel,
  scoreTierClass,
  StatBlock,
} from '../../design/Primitives';
import { sortPicksByOverall } from '../../../lib/pickSort';
import { getPlayerRole, getPlayerDraftScore } from '../../../lib/getPlayerRole';
import { getDraftClassSummary } from '../../../lib/getDraftClassSummary';
import { buildPlayerHref } from '../../../lib/playerBackTarget';
import type { DraftClass, DraftPick } from '../../../types';

export interface YearDraftViewProps {
  draftClass: DraftClass;
  draftingTeamOnly: boolean;
}

export function YearDraftView({
  draftClass,
  draftingTeamOnly,
}: YearDraftViewProps) {
  const year = draftClass.year;
  const sorted = sortPicksByOverall(draftClass.picks);

  const enriched = sorted.map((pick) => {
    const role = getPlayerRole(pick, { draftingTeamOnly });
    const score = Math.round(getPlayerDraftScore(pick, { draftingTeamOnly }));
    return { pick, role, score };
  });

  const summary = getDraftClassSummary(draftClass, { draftingTeamOnly });
  const firstRound = enriched.filter((p) => p.pick.round === 1);

  return (
    <section className="year-draft-view" aria-labelledby="year-draft-title">
      <section className="year-masthead">
        <div>
          <div className="kicker" style={{ marginBottom: 14 }}>
            The Class Of
          </div>
          <h1 id="year-draft-title" className="year-numeral">
            {year}
          </h1>
          <p
            style={{
              maxWidth: 540,
              marginTop: 18,
              marginBottom: 0,
              fontSize: 14,
              lineHeight: 1.55,
              color: 'var(--ink-2)',
            }}
          >
            All {enriched.length} picks across the league, ranked by snap share,
            games played, and retention. No narrative, no hype.
          </p>
        </div>
        <div className="year-stats">
          <StatBlock
            variant="year"
            label="Avg. score"
            value={String(Math.round(summary.avgScore))}
            sub="out of 100"
          />
          <StatBlock
            variant="year"
            label="Core starters"
            value={String(summary.coreStarters)}
            sub={`of ${summary.tracked}`}
            accent
          />
          <StatBlock
            variant="year"
            label="Misses"
            value={String(summary.misses)}
            sub="non-contributors"
          />
          <StatBlock
            variant="year"
            label="QBs taken"
            value={String(summary.qbsTaken)}
            sub="all rounds"
          />
          <StatBlock
            variant="year"
            label="WRs taken"
            value={String(summary.wrsTaken)}
            sub="all rounds"
          />
          <StatBlock
            variant="year"
            label="Retention"
            value={`${Math.round(summary.retentionRate * 100)}%`}
            sub="still with team"
          />
        </div>
      </section>

      <section className="pick-ledger">
        <div className="section-head">
          <h2 style={{ marginTop: 0 }}>Round one, pick by pick.</h2>
          <div className="kicker">click any name for the player track</div>
        </div>

        <div className="pick-ledger__grid">
          {firstRound.map((p) => (
            <PickLedgerRow key={p.pick.overallPick} {...p} />
          ))}
        </div>
      </section>

      {enriched.length > firstRound.length && (
        <section className="pick-ledger" style={{ paddingTop: 0 }}>
          <div className="section-head">
            <h2 style={{ marginTop: 0 }}>The rest of the board.</h2>
            <div className="kicker">rounds 2–7</div>
          </div>
          <div className="pick-ledger__grid">
            {enriched
              .filter((p) => p.pick.round > 1)
              .map((p) => (
                <PickLedgerRow key={p.pick.overallPick} {...p} />
              ))}
          </div>
        </section>
      )}
    </section>
  );
}

function PickLedgerRow({
  pick,
  role,
  score,
}: {
  pick: DraftPick;
  role: string;
  score: number;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const color = teamColor(pick.teamId);
  const cls = roleDesignClass(role);
  const scoreClass = scoreTierClass(score, {
    high: 'pick-ledger-row__score--top',
    low: 'pick-ledger-row__score--low',
  });
  return (
    <div
      className="pick-ledger-row"
      style={{ ['--team' as never]: color } as CSSProperties}
      onClick={() =>
        navigate(
          buildPlayerHref(pick.playerId, location.pathname + location.search),
        )
      }
    >
      <div>
        <div className="pick-ledger-row__pick-label">Pick</div>
        <div className="pick-ledger-row__pick-num">{pick.overallPick}</div>
      </div>
      <div className="pick-ledger-row__body">
        <div className="pick-ledger-row__stripe" />
        <TeamLogo teamId={pick.teamId} size={28} ring={false} />
        <PlayerAvatar
          teamId={pick.teamId}
          name={pick.playerName}
          src={pick.headshotUrl}
          size={36}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pick-ledger-row__meta">
            <span className="pick-ledger-row__team">{pick.teamId}</span>
            <span style={{ color: 'var(--ink-4)' }}>·</span>
            <span className="pos-chip">{pick.position}</span>
            <span className={`role-chip ${cls}`}>{shortRoleLabel(role)}</span>
          </div>
          <div className="pick-ledger-row__name">{pick.playerName}</div>
        </div>
      </div>
      <div
        className={`pick-ledger-row__score${scoreClass ? ` ${scoreClass}` : ''}`}
      >
        {score}
      </div>
    </div>
  );
}
