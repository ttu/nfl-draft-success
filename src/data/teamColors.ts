/**
 * NFL team primary accent colors (approximate brand colors)
 */
export const TEAM_COLORS: Record<string, string> = {
  ARI: '#97233f',
  ATL: '#a71930',
  BAL: '#241773',
  BUF: '#00338d',
  CAR: '#0085ca',
  CHI: '#0b162a',
  CIN: '#fb4f14',
  CLE: '#311d00',
  DAL: '#003594',
  DEN: '#fb4f14',
  DET: '#0076b6',
  GB: '#203731',
  HOU: '#03202f',
  IND: '#002c5f',
  JAX: '#006778',
  KC: '#e31837',
  LAC: '#0080c6',
  LAR: '#003594',
  LV: '#000000',
  MIA: '#008e97',
  MIN: '#4f2683',
  NE: '#002244',
  NO: '#d3bc8d',
  NYG: '#0b2265',
  NYJ: '#125740',
  PHI: '#004c54',
  PIT: '#ffb612',
  SEA: '#69be28',
  SF: '#aa0000',
  TB: '#d50a0a',
  TEN: '#0c2340',
  WAS: '#5a1414',
};

/** Team logo URLs: Wikipedia (Wikimedia Commons) per nflverse teams_colors_logos; TEN from nflverse (no Wikipedia asset). */
const TEAM_LOGO_URL: Record<string, string> = {
  ARI: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/72/Arizona_Cardinals_logo.svg/179px-Arizona_Cardinals_logo.svg.png',
  ATL: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/c5/Atlanta_Falcons_logo.svg/192px-Atlanta_Falcons_logo.svg.png',
  BAL: 'https://upload.wikimedia.org/wikipedia/en/thumb/1/16/Baltimore_Ravens_logo.svg/193px-Baltimore_Ravens_logo.svg.png',
  BUF: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/77/Buffalo_Bills_logo.svg/189px-Buffalo_Bills_logo.svg.png',
  CAR: 'https://upload.wikimedia.org/wikipedia/en/thumb/1/1c/Carolina_Panthers_logo.svg/100px-Carolina_Panthers_logo.svg.png',
  CHI: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Chicago_Bears_logo.svg/100px-Chicago_Bears_logo.svg.png',
  CIN: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Cincinnati_Bengals_logo.svg/100px-Cincinnati_Bengals_logo.svg.png',
  CLE: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d9/Cleveland_Browns_logo.svg/100px-Cleveland_Browns_logo.svg.png',
  DAL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Dallas_Cowboys.svg/100px-Dallas_Cowboys.svg.png',
  DEN: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/44/Denver_Broncos_logo.svg/100px-Denver_Broncos_logo.svg.png',
  DET: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/71/Detroit_Lions_logo.svg/100px-Detroit_Lions_logo.svg.png',
  GB: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Green_Bay_Packers_logo.svg/100px-Green_Bay_Packers_logo.svg.png',
  HOU: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/28/Houston_Texans_logo.svg/100px-Houston_Texans_logo.svg.png',
  IND: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Indianapolis_Colts_logo.svg/100px-Indianapolis_Colts_logo.svg.png',
  JAX: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/74/Jacksonville_Jaguars_logo.svg/100px-Jacksonville_Jaguars_logo.svg.png',
  KC: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e1/Kansas_City_Chiefs_logo.svg/100px-Kansas_City_Chiefs_logo.svg.png',
  LAC: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/72/NFL_Chargers_logo.svg/100px-NFL_Chargers_logo.svg.png',
  LAR: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8a/Los_Angeles_Rams_logo.svg/100px-Los_Angeles_Rams_logo.svg.png',
  LV: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/48/Las_Vegas_Raiders_logo.svg/100px-Las_Vegas_Raiders_logo.svg.png',
  MIA: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/37/Miami_Dolphins_logo.svg/100px-Miami_Dolphins_logo.svg.png',
  MIN: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/48/Minnesota_Vikings_logo.svg/98px-Minnesota_Vikings_logo.svg.png',
  NE: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b9/New_England_Patriots_logo.svg/100px-New_England_Patriots_logo.svg.png',
  NO: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/New_Orleans_Saints_logo.svg/98px-New_Orleans_Saints_logo.svg.png',
  NYG: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/New_York_Giants_logo.svg/100px-New_York_Giants_logo.svg.png',
  NYJ: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6b/New_York_Jets_logo.svg/100px-New_York_Jets_logo.svg.png',
  PHI: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8e/Philadelphia_Eagles_logo.svg/100px-Philadelphia_Eagles_logo.svg.png',
  PIT: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Pittsburgh_Steelers_logo.svg/100px-Pittsburgh_Steelers_logo.svg.png',
  SEA: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8e/Seattle_Seahawks_logo.svg/100px-Seattle_Seahawks_logo.svg.png',
  SF: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/San_Francisco_49ers_logo.svg/100px-San_Francisco_49ers_logo.svg.png',
  TB: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Tampa_Bay_Buccaneers_logo.svg/100px-Tampa_Bay_Buccaneers_logo.svg.png',
  TEN: 'https://github.com/nflverse/nflverse-pbp/raw/master/titans.png',
  WAS: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Washington_commanders.svg/100px-Washington_commanders.svg.png',
};

/** NFL league logo (nflverse) – use on rankings/list view when no team selected */
export const NFL_LOGO_URL =
  'https://raw.githubusercontent.com/nflverse/nflverse-pbp/master/NFL.png';

export function getTeamLogoUrl(teamId: string): string {
  return TEAM_LOGO_URL[teamId] ?? '';
}

/** ESPN team URL slug: lowercase; override where abbreviation differs (JAX→jax, LAR→lar, WAS→wsh). */
const ESPN_TEAM_ID: Record<string, string> = {
  JAX: 'jax',
  LAR: 'lar',
  WAS: 'wsh',
};

export function getTeamDepthChartUrl(teamId: string, teamName: string): string {
  const espnId = ESPN_TEAM_ID[teamId] ?? teamId.toLowerCase();
  const slug = teamName.toLowerCase().replace(/\s+/g, '-');
  return `https://www.espn.com/nfl/team/depth/_/name/${espnId}/${slug}`;
}
