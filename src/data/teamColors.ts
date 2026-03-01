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

/** Team logo URLs from SportsLogos.net (small thumbnails for educational/fair use). */
const TEAM_LOGO_URL: Record<string, string> = {
  ARI: 'https://content.sportslogos.net/logos/7/177/thumbs/kwth8f1cfa2sch5xhjjfaof90.gif',
  ATL: 'https://content.sportslogos.net/logos/7/173/thumbs/299.gif',
  BAL: 'https://content.sportslogos.net/logos/7/153/thumbs/318.gif',
  BUF: 'https://content.sportslogos.net/logos/7/149/thumbs/n0fd1z6xmhigb0eej3323ebwq.gif',
  CAR: 'https://content.sportslogos.net/logos/7/174/thumbs/f1wggq2k8ql88fe33jzhw641u.gif',
  CHI: 'https://content.sportslogos.net/logos/7/169/thumbs/16975942023.gif',
  CIN: 'https://content.sportslogos.net/logos/7/154/thumbs/15420492021.gif',
  CLE: 'https://content.sportslogos.net/logos/7/155/thumbs/15566962024.gif',
  DAL: 'https://content.sportslogos.net/logos/7/165/thumbs/406.gif',
  DEN: 'https://content.sportslogos.net/logos/7/161/thumbs/9ebzja2zfeigaziee8y605aqp.gif',
  DET: 'https://content.sportslogos.net/logos/7/170/thumbs/17013982017.gif',
  GB: 'https://content.sportslogos.net/logos/7/171/thumbs/dcy03myfhffbki5d7il3.gif',
  HOU: 'https://content.sportslogos.net/logos/7/157/thumbs/15758902024.gif',
  IND: 'https://content.sportslogos.net/logos/7/158/thumbs/593.gif',
  JAX: 'https://content.sportslogos.net/logos/7/159/thumbs/15988562013.gif',
  KC: 'https://content.sportslogos.net/logos/7/162/thumbs/kansas_city_chiefs_logo_primary_1972sportslogosnet6237.gif',
  LAC: 'https://content.sportslogos.net/logos/7/6446/thumbs/644616602020.gif',
  LAR: 'https://content.sportslogos.net/logos/7/5941/thumbs/594183342020.gif',
  LV: 'https://content.sportslogos.net/logos/7/6708/thumbs/670885212020.gif',
  MIA: 'https://content.sportslogos.net/logos/7/150/thumbs/miami_dolphins_logo_primary_2018sportslogosnet4756.gif',
  MIN: 'https://content.sportslogos.net/logos/7/172/thumbs/17227042013.gif',
  NE: 'https://content.sportslogos.net/logos/7/151/thumbs/y71myf8mlwlk8lbgagh3fd5e0.gif',
  NO: 'https://content.sportslogos.net/logos/7/175/thumbs/907.gif',
  NYG: 'https://content.sportslogos.net/logos/7/166/thumbs/919.gif',
  NYJ: 'https://content.sportslogos.net/logos/7/152/thumbs/15274172024.gif',
  PHI: 'https://content.sportslogos.net/logos/7/167/thumbs/960.gif',
  PIT: 'https://content.sportslogos.net/logos/7/156/thumbs/970.gif',
  SEA: 'https://content.sportslogos.net/logos/7/180/thumbs/pfiobtreaq7j0pzvadktsc6jv.gif',
  SF: 'https://content.sportslogos.net/logos/7/179/thumbs/17994552009.gif',
  TB: 'https://content.sportslogos.net/logos/7/176/thumbs/17683632020.gif',
  TEN: 'https://content.sportslogos.net/logos/7/160/thumbs/1053.gif',
  WAS: 'https://content.sportslogos.net/logos/7/6832/thumbs/683260482022.gif',
};

/** NFL league logo (SportsLogos.net) – use on rankings/list view when no team selected */
export const NFL_LOGO_URL =
  'https://content.sportslogos.net/logos/7/1007/thumbs/dwuw5lojnwsj12vfe0hfa6z47.gif';

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
