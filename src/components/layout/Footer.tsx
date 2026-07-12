export function Footer() {
  return (
    <footer className="app-footer">
      <span>Independent analytics · not affiliated with the NFL</span>
      <span>
        Data via{' '}
        <a
          href="https://github.com/nflverse"
          target="_blank"
          rel="noopener noreferrer"
        >
          nflverse
        </a>{' '}
        · Source on{' '}
        <a
          href="https://github.com/ttu/nfl-draft-success"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </span>
    </footer>
  );
}
