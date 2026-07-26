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
