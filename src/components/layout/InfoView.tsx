import { useEffect, useRef } from 'react';
import { RoleChip } from '../design/Primitives';

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
              How the Index is built.
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
                Three honest measures: <b>snap share</b> (how often a drafted
                player is on the field), <b>games played</b> (availability), and{' '}
                <b>retention</b> (whether the player is still on the roster).
                Snap share and games played combine into the draft success score
                — impact on a 0–100 scale. Retention is reported alongside it as
                its own number, so keeping your draftees stays a separate,
                visible signal rather than being folded in.
              </p>

              <h2 className="info-section-title" style={{ marginTop: 32 }}>
                Role classification
              </h2>
              <table className="info-role-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th className="right">Snap %</th>
                    <th className="right">Games</th>
                    <th>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  <RoleRow
                    role="core"
                    snap="≥ 65%"
                    games="≥ 50% of team"
                    desc="Full-time, healthy"
                  />
                  <RoleRow
                    role="shw"
                    snap="≥ 65%"
                    games="< 50% of team"
                    desc="Starter role, missed time"
                  />
                  <RoleRow
                    role="sig"
                    snap="≥ 35%"
                    games="any"
                    desc="Rotation / package player"
                  />
                  <RoleRow
                    role="dep"
                    snap="10–35%"
                    games="any"
                    desc="Backup / special teams"
                  />
                  <RoleRow
                    role="non"
                    snap="< 10%"
                    games="any"
                    desc="Inactive most weeks"
                  />
                </tbody>
              </table>

              <h2 className="info-section-title" style={{ marginTop: 32 }}>
                The score, formally
              </h2>
              <pre className="info-formula">{`score(pick)   = clamp( w_s · snapShare + w_a · availability, 0, 1 ) × 100
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
                  Players are credited to the team that <em>drafted</em> them —
                  trades don't change accounting.
                </li>
                <li>
                  Quarterbacks behind a healthy starter score lower on snap
                  share. The index measures <em>what happened</em>, not what
                  might.
                </li>
                <li>
                  The current season is partial; figures update as the schedule
                  progresses.
                </li>
                <li>
                  <em>Load</em> excuses injury absences: games missed while on
                  the injury report are dropped from the denominator, so a
                  starter who plays every snap when healthy keeps a high Load
                  despite missing time.
                </li>
              </ul>
            </div>

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
          </div>
        </div>
      </div>
    </>
  );
}

function RoleRow({
  role,
  snap,
  games,
  desc,
}: {
  role: 'core' | 'shw' | 'sig' | 'dep' | 'non' | 'gone';
  snap: string;
  games: string;
  desc: string;
}) {
  const mappedRole =
    role === 'core'
      ? 'core_starter'
      : role === 'shw'
        ? 'starter_when_healthy'
        : role === 'sig'
          ? 'significant_contributor'
          : role === 'dep'
            ? 'depth'
            : role === 'non'
              ? 'non_contributor'
              : 'gone';
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
