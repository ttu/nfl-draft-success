import { Link } from 'react-router-dom';

interface StatBlockProps {
  label: string;
  value: string;
  sub?: string;
  /** Renders the value in the accent face, for the standout figure. */
  accent?: boolean;
  /** When set, the value becomes a link to that page. */
  href?: string;
}

/**
 * One headline figure in a page hero: a kicker label, a large serif value, and
 * an optional caption.
 *
 * Shared by the draft rankings hero and the current-roster board so the two
 * boards' figures sit on the same baseline and read as one page.
 */
export function StatBlock({ label, value, sub, accent, href }: StatBlockProps) {
  const valueClass = `statblock__value${accent ? ' statblock__value--accent' : ''} tnum`;
  return (
    <div>
      <div className="kicker" style={{ marginBottom: 8 }}>
        {label}
      </div>
      {href ? (
        <Link
          to={href}
          className={`${valueClass} statblock__value--link`}
          aria-label={`${label}: view ${value}`}
        >
          {value}
        </Link>
      ) : (
        <div className={valueClass}>{value}</div>
      )}
      {sub && <div className="statblock__sub">{sub}</div>}
    </div>
  );
}
