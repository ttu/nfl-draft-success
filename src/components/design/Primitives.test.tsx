import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerAvatar, TeamLogo } from './Primitives';

/**
 * Long lists mount hundreds of these at once — a single draft year renders ~520
 * images, over 95% of them below the fold — so both remote images must defer
 * until they are near the viewport rather than firing on mount.
 */
describe('remote image loading', () => {
  it('defers the player headshot until it is near the viewport', () => {
    render(
      <PlayerAvatar name="Trey Smith" teamId="KC" src="https://x/h.png" />,
    );

    const img = screen.getByAltText('Trey Smith');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('defers the team logo until it is near the viewport', () => {
    const { container } = render(<TeamLogo teamId="KC" />);

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('renders the initials fallback, not an image, when no headshot exists', () => {
    render(<PlayerAvatar name="Trey Smith" teamId="KC" />);

    expect(screen.queryByAltText('Trey Smith')).toBeNull();
    expect(screen.getByText('TS')).toBeInTheDocument();
  });
});

/**
 * The headshot URLs in our data point at full studio originals — 3400×2450,
 * ~5 MB each. Painting those into a 44 px circle cost ~840 ms of decode per
 * viewport resize on the highlights page; requesting the crop we actually show
 * brings it to ~4 ms.
 */
describe('headshot sizing', () => {
  const ORIGINAL =
    'https://static.www.nfl.com/image/upload/f_auto,q_auto/league/skoecv9k14idjai4ok42';

  it('requests a crop scaled to the avatar rather than the full original', () => {
    render(
      <PlayerAvatar name="Trey Smith" teamId="KC" src={ORIGINAL} size={44} />,
    );

    expect(screen.getByAltText('Trey Smith')).toHaveAttribute(
      'src',
      'https://static.www.nfl.com/image/upload/f_auto,q_auto,w_96,h_96,c_fill,g_face/league/skoecv9k14idjai4ok42',
    );
  });

  it('scales the request with the avatar, so the detail hero stays sharp', () => {
    render(
      <PlayerAvatar name="Trey Smith" teamId="KC" src={ORIGINAL} size={104} />,
    );

    expect(screen.getByAltText('Trey Smith').getAttribute('src')).toContain(
      'w_256,h_256',
    );
  });

  it('still renders a headshot from a host it cannot resize', () => {
    render(
      <PlayerAvatar name="Trey Smith" teamId="KC" src="https://x/h.png" />,
    );

    expect(screen.getByAltText('Trey Smith')).toHaveAttribute(
      'src',
      'https://x/h.png',
    );
  });
});
