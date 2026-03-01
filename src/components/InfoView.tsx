import { useEffect, useRef } from 'react';

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
              Each player is classified into one of five roles based on their
              snap share and games played per season:
            </p>
            <ul>
              <li>
                <strong>Core Starter</strong> – Snap share ≥65% and played in
                ≥50% of team games
              </li>
              <li>
                <strong>Starter when healthy</strong> – Snap share ≥65% but
                played in &lt;50% of team games (e.g., injured)
              </li>
              <li>
                <strong>Significant Contributor</strong> – Snap share ≥35%
              </li>
              <li>
                <strong>Depth</strong> – Snap share ≥10%
              </li>
              <li>
                <strong>Non Contributor</strong> – Snap share &lt;10%
              </li>
            </ul>
            <p>
              A player&apos;s overall role is their highest achieved role across
              all seasons. If the most recent season has 0 games played (e.g.,
              cut or holdout), they are classified as Non Contributor.
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
                  <td>3</td>
                </tr>
                <tr>
                  <td>Starter when healthy</td>
                  <td>3</td>
                </tr>
                <tr>
                  <td>Significant Contributor</td>
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
              <strong>5-Year Draft Score</strong> = (sum of player role weights)
              ÷ (total picks). Core Starter % and Retention % are computed as
              the share of picks that reached that status.
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
