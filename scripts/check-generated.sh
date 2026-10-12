#!/bin/sh
#
# Fails when `pnpm run build` has rewritten a tracked artifact.
#
# The build regenerates these from `src/` and `public/data/`, so a change to
# scoring or to the data moves them. They are committed, which means they can
# go stale — and the way they go stale is quiet. In the pre-commit hook the
# build runs *after* lint-staged has staged everything, so a regenerated
# artifact is simply left dirty in the working tree and the commit succeeds
# without it. That is how `default-rankings.json` came to sit one commit behind
# the change that moved it.
#
# Run after the build, in the hook and in CI both. Compares the working tree
# against the index, so it passes once the artifacts are staged (the hook) or
# once they match what was committed (CI).

ARTIFACTS="public/data/default-rankings.json
public/data/lagged-draft-rankings.json
public/data/team-success.json
public/sitemap.xml
public/og-image.png"

# Word-splitting on the newline-separated list is the point here.
# shellcheck disable=SC2086
if git diff --quiet -- $ARTIFACTS; then
  exit 0
fi

echo ""
echo "✗ The build rewrote tracked artifacts that are not in this commit:"
# shellcheck disable=SC2086
git diff --name-only -- $ARTIFACTS | sed 's/^/    /'
echo ""
echo "  They are generated from the code and data you are committing, so they"
echo "  belong in the same commit. Stage them and commit again:"
echo ""
# shellcheck disable=SC2086
git diff --name-only -- $ARTIFACTS | tr '\n' ' ' | sed 's/^/    git add /;s/ $/\n/'
echo ""
exit 1
