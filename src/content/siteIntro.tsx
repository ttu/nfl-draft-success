/**
 * Shared copy for what this site does — landing banner and About modal intro.
 */
export function SiteIntroContent() {
  return (
    <>
      <p>
        <strong>NFL Draft Success</strong> measures how well each team has
        drafted over a chosen span of years. It uses nflverse data on snap
        share, games played, and whether picks stayed with the drafting team,
        then rolls that into role-based weights and a team draft score you can
        compare across all 32 teams.
      </p>
      <p>
        Pick a team to see every retained pick in that window, how each player
        was classified (from usage), and team-level metrics like core starter
        rate and retention.
      </p>
    </>
  );
}
