import { getTeamLogoUrl } from '../data/teamColors';
import type { TeamRanking } from './FiveYearScoreCard';

export interface TeamRankingsViewProps {
  rankings: TeamRanking[];
  yearCount: number;
  onTeamSelect: (teamId: string) => void;
  onBack: () => void;
}

export function TeamRankingsView({
  rankings,
  yearCount,
  onTeamSelect,
  onBack,
}: TeamRankingsViewProps) {
  return (
    <section className="team-rankings-view" aria-label="Team draft rankings">
      <div className="team-rankings-view__header">
        <button
          type="button"
          className="team-rankings-view__back"
          onClick={onBack}
        >
          ← Back
        </button>
        <h2 className="team-rankings-view__title">
          {yearCount}-Year Draft Score Rankings
        </h2>
      </div>
      <ul className="team-rankings-view__list" role="list">
        {rankings.map((r) => (
          <li key={r.teamId}>
            <button
              type="button"
              className="team-rankings-view__item"
              onClick={() => onTeamSelect(r.teamId)}
            >
              <span className="team-rankings-view__rank">{r.rank}</span>
              <img
                src={getTeamLogoUrl(r.teamId)}
                alt=""
                className="team-rankings-view__logo"
              />
              <span className="team-rankings-view__name">{r.teamName}</span>
              <span className="team-rankings-view__score">
                {r.score.toFixed(2)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
