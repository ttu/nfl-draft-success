import { useEffect, useRef, useState } from 'react';
import { RoleChip } from '../design/Primitives';
import {
  baselinePositions,
  getPositionTierThresholds,
} from '../../lib/positionBaseline';
import { getPositionDisplayName } from '../../lib/positionDisplayName';

const GITHUB_URL = 'https://github.com/ttu/nfl-draft-success';

export interface InfoViewProps {
  onClose: () => void;
  dataLastUpdatedDate?: string | null;
}

export function InfoView({
  onClose,
  dataLastUpdatedDate = null,
}: InfoViewProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <>
      <div
        className="info-backdrop"
        role="presentation"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="info-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-sheet-title"
      >
        <header className="info-sheet__head">
          <div>
            <div className="kicker" style={{ marginBottom: 6 }}>
              Methodology · Glossary · Data
            </div>
            <h1 id="info-sheet-title" className="info-sheet__title">
              How the score is built.
            </h1>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="info-sheet__close"
            onClick={onClose}
            aria-label="Close methodology"
          >
            CLOSE ✕
          </button>
        </header>
        <div className="info-sheet__body">
          <div className="info-grid">
            <MethodologyColumn />
            <DataColumn dataLastUpdatedDate={dataLastUpdatedDate} />
          </div>
        </div>
      </div>
    </>
  );
}

function MethodologyColumn() {
  // Empty string = the generic, position-neutral rule (65% / 35% / 10%).
  const [rolePos, setRolePos] = useState('');
  const th = getPositionTierThresholds(rolePos || undefined);
  const asPct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div>
      <h2 className="info-section-title">The signals we use</h2>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: 'var(--ink-2)',
          maxWidth: 640,
        }}
      >
        Three honest measures: <b>snap share</b> (how often a drafted player is
        on the field), <b>games played</b> (availability), and <b>retention</b>{' '}
        (whether the player is still on the roster). Snap share and games played
        combine into the draft success score — impact on a 0–100 scale.
        Retention is reported alongside it as its own number, so keeping your
        draftees stays a separate, visible signal rather than being folded in.
      </p>

      <div className="info-role-head">
        <h2 className="info-section-title" style={{ marginTop: 32 }}>
          Role classification
        </h2>
        <label className="info-role-picker">
          <span className="kicker">Snap % for</span>
          <select
            value={rolePos}
            onChange={(e) => setRolePos(e.target.value)}
            aria-label="Show snap thresholds for position"
          >
            <option value="">Any position (generic)</option>
            {baselinePositions().map((p) => (
              <option key={p} value={p}>
                {getPositionDisplayName(p)} ({p})
              </option>
            ))}
          </select>
        </label>
      </div>
      <table className="info-role-table">
        <thead>
          <tr>
            <th>Role</th>
            <th className="right">Snap %*</th>
            <th className="right">Games</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <RoleRow
            role="core"
            snap={`≥ ${asPct(th.core)}`}
            games="≥ 50% of team"
            desc="On the field full-time, all season"
          />
          <RoleRow
            role="shw"
            snap={`≥ ${asPct(th.core)}`}
            games="< 50% of team"
            desc="A starter's workload, but missed games"
          />
          <RoleRow
            role="sig"
            snap={`≥ ${asPct(th.significant)}`}
            games="any"
            desc="In the rotation, not a starter"
          />
          <RoleRow
            role="dep"
            snap={`${asPct(th.depth)}–${asPct(th.significant)}`}
            games="any"
            desc="Backup or special teams only"
          />
          <RoleRow
            role="non"
            snap={`< ${asPct(th.depth)}`}
            games="any"
            desc="Rarely on the field"
          />
        </tbody>
      </table>
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--ink-2)',
          maxWidth: 640,
          marginTop: 12,
        }}
      >
        <b>* Snap % is position-adjusted.</b> Positions don't play the same
        amount, even when every one of them is a starter. A full-time offensive
        lineman is on the field for nearly every snap; a full-time running back
        for about two thirds of them, and a full-time defensive tackle for about
        seven in ten. Judging them all against one flat number would just rank
        positions instead of players.
        <br />
        <br />
        So each player is measured against a full-time starter{' '}
        <em>at his own position</em>, and the thresholds above shift to match. A
        running back counts as a Core Starter at ~42% of team snaps; an
        offensive lineman has to reach ~65%. Pick a position above to see its
        real numbers. The full-time bar for each position is derived from the
        snap data itself, not set by hand. (Kickers, punters and long snappers
        are measured on raw snaps — snap share can't describe what they do.)
      </p>

      <h2 className="info-section-title" style={{ marginTop: 32 }}>
        The score, formally
      </h2>
      <pre className="info-formula">{`snapShare_adj = min( snapShare / positionBaseline, 1 )   (K/P/LS: unadjusted)
score(pick)   = clamp( w_s · snapShare_adj + w_a · availability, 0, 1 ) × 100
score(class)  = mean( score(pick) for pick in class )
score(team)   = mean( score(pick) for pick in range )
retention     = retained_players / picks_in_range   (reported separately)
weights       = w_s 0.7, w_a 0.3   (snap share is the heavier signal)`}</pre>

      <h2 className="info-section-title" style={{ marginTop: 32 }}>
        Caveats
      </h2>
      <ul
        style={{
          paddingLeft: 18,
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--ink-2)',
        }}
      >
        <li>
          Players are credited to the team that <em>drafted</em> them — trades
          don't change accounting.
        </li>
        <li>
          Quarterbacks sitting behind a healthy starter score low on snap share.
          The score measures <em>what happened</em>, not what might have.
        </li>
        <li>
          The current season is partial; figures update as the schedule
          progresses.
        </li>
        <li>
          <em>Load</em> forgives injuries: weeks a player spent on the injury
          report aren't counted against him, so a starter who plays every snap
          when healthy keeps a high Load even if he missed part of the season.
        </li>
      </ul>
    </div>
  );
}

function DataColumn({
  dataLastUpdatedDate,
}: {
  dataLastUpdatedDate: string | null;
}) {
  return (
    <aside>
      <h2 className="info-section-title">Data sources</h2>
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--rule)',
          padding: '16px 18px',
          borderRadius: 2,
        }}
      >
        <Source
          name="nflverse-data"
          desc="Draft picks, snap counts, weekly games"
        />
        <Source name="rosters" desc="Active roster status" />
        <Source name="injuries" desc="Weekly injury report" />
      </div>

      <h2 className="info-section-title" style={{ marginTop: 28 }}>
        Coverage
      </h2>
      <div className="info-kv">
        <span>Teams</span>
        <span>32 / 32</span>
      </div>
      <div className="info-kv">
        <span>Years</span>
        <span>2018 – 2026</span>
      </div>
      {dataLastUpdatedDate && (
        <div className="info-kv">
          <span>Last updated</span>
          <span>{dataLastUpdatedDate}</span>
        </div>
      )}

      <h2 className="info-section-title" style={{ marginTop: 28 }}>
        Source
      </h2>
      <a
        className="fab-link"
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{ width: '100%', justifyContent: 'space-between' }}
      >
        <span>↗ GitHub · ttu/nfl-draft-success</span>
        <span>Open</span>
      </a>
    </aside>
  );
}

/** Shorthand used by the role table below, mapped to the canonical role ids. */
type RoleAbbrev = 'core' | 'shw' | 'sig' | 'dep' | 'non' | 'gone';

const ROLE_BY_ABBREV: Record<RoleAbbrev, string> = {
  core: 'core_starter',
  shw: 'starter_when_healthy',
  sig: 'significant_contributor',
  dep: 'depth',
  non: 'non_contributor',
  gone: 'gone',
};

function RoleRow({
  role,
  snap,
  games,
  desc,
}: {
  role: RoleAbbrev;
  snap: string;
  games: string;
  desc: string;
}) {
  const mappedRole = ROLE_BY_ABBREV[role];
  return (
    <tr>
      <td>
        <RoleChip role={mappedRole} />
      </td>
      <td className="right">{snap}</td>
      <td className="right">{games}</td>
      <td>{desc}</td>
    </tr>
  );
}

function Source({ name, desc }: { name: string; desc: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px dotted var(--rule-2)',
        fontSize: 12,
      }}
    >
      <div>
        <div className="mono" style={{ fontWeight: 700 }}>
          {name}
        </div>
        <div style={{ color: 'var(--ink-3)', fontSize: 11 }}>{desc}</div>
      </div>
    </div>
  );
}
