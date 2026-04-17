import { useEffect, useRef } from 'react';
import { SiteIntroContent } from '../content/siteIntro';

const GITHUB_URL = 'https://github.com/ttu/nfl-draft-success';
const CONTACT_EMAIL = 'contact@nfldraftsuccess.com';

export interface InfoViewProps {
  onClose: () => void;
}

export function InfoView({ onClose }: InfoViewProps) {
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
    <div
      className="info-view__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-view-title"
    >
      <div className="info-view__backdrop" onClick={onClose} aria-hidden />
      <div className="info-view__popup">
        <div className="info-view__header">
          <h2 id="info-view-title">About NFL Draft Success</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="info-view__close"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="info-view__body">
          <section
            className="info-view__intro"
            aria-labelledby="info-view-intro-title"
          >
            <h3 id="info-view-intro-title">What this site is</h3>
            <SiteIntroContent />
          </section>

          <section>
            <h3>Open Source</h3>
            <p>
              This is an open source project. You can contribute code, report
              bugs, or request new features on GitHub.
            </p>
            <p>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                {GITHUB_URL}
              </a>
            </p>
            <p>
              You can also contact us via email at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </section>

          <section>
            <h3>How the Calculation Works</h3>
            <h4>Role classification</h4>
            <p>
              Each season row in a player&apos;s career table has two snap
              columns:
            </p>
            <ul>
              <li>
                <strong>Avg snap</strong> — Average <em>role share</em> in games
                where you had at least one snap: each week we take the higher of
                offensive or defensive snap percentage (and for kickers,
                punters, and long snappers, the max includes special teams). We
                average those weekly values. This reads like &ldquo;when you
                played, how big was your role?&rdquo;
              </li>
              <li>
                <strong>Load</strong> — <em>Season snap load</em>: your season
                scrimmage snaps (ST included for specialists) divided by your
                primary team&apos;s <strong>full-season</strong> snap capacity
                (every game that team played). Weeks you don&apos;t play add no
                snaps to the numerator but the full schedule stays in the
                denominator, so part-time seasons read lower than playing every
                week. Weeks on the official injury report can reduce that
                denominator (up to games you missed), so injury absences
                don&apos;t hurt Load as much as healthy scratches. If you were
                traded mid-season, the script uses a games-played-only ratio
                instead. <strong>Role tiers</strong> use Load (capped at Avg
                snap when Load would exceed it), except kickers, punters, and
                long snappers — for them tiers use <strong>Avg snap</strong>{' '}
                because Load vs the entire team&apos;s snap pool is not
                comparable to these bands.
              </li>
            </ul>
            <p>
              Kickers, punters, and long snappers include special teams in those
              calculations so their usage is measured fairly; other positions do
              not use ST-only weeks to inflate offense/defense role share.
            </p>
            <p>
              Each player is classified into one of six roles using the same
              percentage thresholds: for most positions the input is season
              Load; for K/P/LS it is Avg snap. Games played still apply (e.g.
              Core Starter needs half the team schedule).
            </p>
            <ul>
              <li>
                <strong>Core Starter</strong> – Effective share ≥65% and played
                in ≥50% of team games
              </li>
              <li>
                <strong>Starter when healthy</strong> – Effective share ≥65% but
                played in &lt;50% of team games (e.g., injured)
              </li>
              <li>
                <strong>Significant Contributor</strong> – Effective share ≥35%
                (≥32% for kickers, punters, long snappers) and played in at
                least 2 games (single-game samples map to Contributor or lower)
              </li>
              <li>
                <strong>Contributor</strong> – Effective share at least 20% and
                below the SC threshold (rotation / primary backup usage)
              </li>
              <li>
                <strong>Depth</strong> – Effective share at least 10% and below
                20%
              </li>
              <li>
                <strong>Non Contributor</strong> – Effective share &lt;10%
              </li>
            </ul>
            <p>
              Overall role comes from the <strong>average</strong> of each
              season&apos;s role weight (0–4). Strong years and weak or inactive
              years blend together, so a pick that was a star for several
              seasons but missed a full year will land below a steady starter.
              Core Starter % uses the same representative role (mean-based), not
              a separate peak-only tally.
            </p>

            <h4>Role weights &amp; score</h4>
            <table className="info-view__table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Core Starter</td>
                  <td>4</td>
                </tr>
                <tr>
                  <td>Starter when healthy</td>
                  <td>4</td>
                </tr>
                <tr>
                  <td>Significant Contributor</td>
                  <td>3</td>
                </tr>
                <tr>
                  <td>Contributor</td>
                  <td>2</td>
                </tr>
                <tr>
                  <td>Depth</td>
                  <td>1</td>
                </tr>
                <tr>
                  <td>Non Contributor</td>
                  <td>0</td>
                </tr>
              </tbody>
            </table>
            <p>
              <strong>Rolling draft score</strong> (over your selected season
              span) = (sum of player role weights) ÷ (total picks). Core Starter
              % and Retention % are computed as the share of picks that reached
              that status.
            </p>
            <p>
              <strong>Retention</strong> means the player is still on the
              drafting team (same franchise). Relocations (STL→LAR, SD→LAC,
              OAK→LV) are handled.
            </p>
          </section>

          <section>
            <h3>Data Sources</h3>
            <p>
              All draft and player data comes from{' '}
              <a
                href="https://github.com/nflverse/nflverse-data"
                target="_blank"
                rel="noopener noreferrer"
              >
                nflverse
              </a>
              , an open NFL data project.
            </p>
            <ul>
              <li>
                <strong>Draft picks</strong> – Who was drafted, when, and by
                which team
              </li>
              <li>
                <strong>Snap counts</strong> – Games played and snap share
                (offense, defense, special teams) per player per season
              </li>
              <li>
                <strong>Injury reports</strong> – Used to infer team affiliation
                when a player has no snaps (e.g., season-long injury)
              </li>
              <li>
                <strong>Player headshots</strong> – Embedded in nflverse players
                dataset
              </li>
            </ul>
            <p>
              Data is pre-processed and stored as JSON in{' '}
              <code>public/data/draft-&#123;year&#125;.json</code>. Run{' '}
              <code>npm run update-data</code> to regenerate from nflverse.
            </p>
            <h4>Images</h4>
            <ul>
              <li>
                <strong>Team logos</strong> – Courtesy of{' '}
                <a
                  href="https://www.sportslogos.net/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  SportsLogos.net
                </a>
              </li>
              <li>
                <strong>Player headshots</strong> – URLs from nflverse players
                dataset (hosted by nflverse/source providers)
              </li>
              <li>
                <strong>Depth chart link</strong> – Links to ESPN.com depth
                chart for the selected team
              </li>
            </ul>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
              Team logos are the property of their respective owners. We do not
              own these logos and use them under a fair use argument: small
              resolution images for educational purposes only, which do not
              impact the economic viability of the logos for their owners. This
              is not legal advice.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
